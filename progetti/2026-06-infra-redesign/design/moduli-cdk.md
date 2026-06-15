# Moduli della nuova libreria CDK — riferimento

> Dettaglio degli 8 moduli (Fase C). Ogni modulo: scopo, costrutti pubblici, default ribaltati, feature
> flag, dipendenze, interventi implementati, note di migrazione, cose da preservare, domande aperte.
> Visione d'insieme in `architettura-target.md`. Nome libreria proposto: `laif_infra` (sostituisce `laif_cdk`).

Convenzione: ogni modulo è ON-by-default dove la sicurezza/affidabilità lo richiede, con **opt-out** esplicito;
i moduli "additivi" (OBS, JOBS) si compongono solo se la scheda li richiede.

---

## NET — Networking & VPC  *(modulo: `networking`)*
**Scopo**: VPC a 3 tier che sostituisce `networks.py` (oggi una sola subnet PUBLIC). Radice del grafo:
tutti gli altri moduli consumano la sua topologia. Implementa **NETSEC-01, NETSEC-07**.

**Costrutti**: `LaifVpc` (3 tier: public=solo ALB, private=ECS/Lambda, isolated=RDS; 2 AZ; gateway
endpoint S3/DynamoDB; Flow Logs) · `VpcEndpoints` (i 5 interface endpoint per-account: ecr.api, ecr.dkr,
logs, secretsmanager, ssm, sts) · `FckNatProvider` (t4g.nano, solo se egress reale) · `VpcFlowLogs` ·
`subnets_for(tier)` (helper che **chiude il bug Lambda-in-VPC**) · `ImportedLaifVpc` (per migrazione).

**Default ribaltati**: subnet PUBLIC→3-tier · RDS→`PRIVATE_ISOLATED` (no `publicly_accessible`) · egress
"IP pubblico per tutti"→**interface endpoints per-account** (no NAT condiviso, coerente con isolamento) ·
Flow Logs assenti→ON (REJECT, 14gg) · `max_azs` 3→2 · Lambda-in-VPC rotta→`subnets_for('private')`.

| Feature flag | Default | Effetto |
|---|---|---|
| `egress_mode` | `interface-endpoints` | endpoint per-account (no internet); `nat-instance` (fck-nat ~3-4 $/mese) per egress reale; `none` |
| `flow_logs.traffic_type` | `REJECT` | economico; `ALL` per debug |
| `endpoints.extra_interface` | `[]` | es. `bedrock-runtime` per i progetti GenAI (Bedrock in crescita), `kms`, `sqs` |
| `max_azs` | `2` | 3 per più resilienza prod (ma più ENI/IP) |

**Migrazione**: cambiare la topologia di una VPC esistente = **REPLACE** (ricrea VPC/RDS/ECS). Quindi:
clienti **nuovi** nascono su `LaifVpc`; clienti **esistenti** via `ImportedLaifVpc` finché non si fa un
**cutover** pianificato (account/stack target + snapshot RDS + swap DNS). Validare che gli interface endpoint
coprano le dipendenze dell'app (se chiama API esterne → `nat-instance`). Pilota su 2-3 dev.
**Preserva**: gateway endpoint S3/DynamoDB gratis; import VPC token-safe; assenza NAT come default economico.
**Domande aperte**: CIDR per-account vs unico /16; ECS Exec → servono `ssmmessages`/`ec2messages`?;
`bedrock-runtime` tra gli extra di default sui progetti GenAI?; conteggio ENI endpoint con 2 AZ.

---

## DATA — Dati / RDS  *(modulo: `data` / `PostgresDatabase`)*
**Scopo**: RDS PostgreSQL sicuro-by-default. Implementa **NETSEC-01 (DB), MON-01/03 (RDS), SCALE-07,
COST-RDS-BACKUP-RETENTION, COST-RDS-DEV-TURNOFF**.

**Costrutti**: `PostgresDatabase` (PRIVATE_ISOLATED, SG dedicato, secret, Enhanced Monitoring role, alarm) ·
`RdsConfig` (pydantic, valida multi_az-solo-prod, retention dev<prod) · `RdsAlarms` (FreeableMemory,
CPUCredit/CPU, FreeStorageSpace, Connections → SNS Wolico) · `RdsSecurityGroup` (default-deny, solo
`allow_from(peer_sg)`, `allow_all_outbound=False`) · `RdsDevTurnoff` (EventBridge Scheduler stop/start,
CDK-owned — sostituisce il tag `Auto-TurnOff` letto da script esterno).

**Default ribaltati**: subnet PUBLIC→`PRIVATE_ISOLATED` · `add_ingress_rule("ANY")`/IP hardcoded→solo
`allow_from(SG backend)` · PI/Enhanced Mon/log export OFF→**ON** · `allow_all_outbound` True→False ·
backup ≥14gg fisso→configurabile (dev 7/prod ≥14) · `allow_major_version_upgrade` True→False (drift Nivi
15→17) · engine default conservativo (no auto-major).

| Feature flag | Default | Effetto |
|---|---|---|
| `multi_az` | `false` (gate: solo prod) | Multi-AZ (raddoppia il costo istanza) |
| `performance_insights` | `true` | PI (free 7gg) + Enhanced Monitoring |
| `backup_retention_days` | dev 7 / prod 14 | finestra PITR |
| `auto_turnoff` | `false` (true nei dev) | stop/start schedulato dell'istanza |
| `secret_rotation` | `false` | rotation Lambda (richiede endpoint Secrets+STS) |

**Migrazione**: PI/Enhanced Mon/alarm/backup-7gg-dev sono **modify in-place** (rischio ~0) → quick win
**prima** del resto. `publicly_accessible=false` in-place. Lo spostamento in subnet privata è invece
**REPLACE** → finestra + snapshot restore. Preserva: encryption, deletion_protection, RETAIN, GP3 autoscaling.
**Domande aperte**: DB condiviso multi-schema **solo same-account multi-app** (mai cross-cliente: viola
l'isolamento) — vale la complessità?; alarm CPUCredit solo su classi burstable; engine major standard di flotta.

---

## COMPUTE — Backend ECS + ALB + Scaling  *(modulo: `compute`)*  ← rework più importante
**Scopo**: backend long-running + ALB **condiviso** per account + scaling. Implementa **SCALE-01..06/08,
COST-EC2-IDLE, MON-01/02, brief #2/#3/#7**. Default = **Fargate** (awsvpc nativo); EC2 opt-out per GPU/costo.

**Costrutti**: `ComputeCluster` (Container Insights ON; capacity provider solo se EC2) · `BackendService`
(taskdef awsvpc, servizio registrato come **target IP dell'ALB**, non l'ASG; health check sano; circuit
breaker+rollback) · `SharedAlb` (1 ALB internet-facing per account, listener 443) · `AppRoute` (listener
rule host/path + target group per app → multi-app) · `ServiceAutoscaling` (target tracking on/off) ·
`ComputeAlarms` (5xx, UnHealthyHost, CPU/RAM, running<desired → SNS Wolico).

**Default ribaltati** (sono il fix del caso Nivi): ALB→ASG **→ ALB→servizio ECS (awsvpc)** · BRIDGE+hostPort
statico→awsvpc (scaling reale) · desired 1→**2 prod** · health check `curl / 5s/5s/2`→`/health 30s/3-5,
grace 60s` · circuit breaker off→**on** · launch type EC2→**Fargate** · `assign_public_ip` True→False ·
subnet PUBLIC→PRIVATE_WITH_EGRESS · autoscaling mai cablato→`ServiceAutoscaling` on/off · `:latest`→tag
**immutabile** (rifiutato a synth) · 1 ALB/servizio→**1 ALB condiviso/account** · `expose_*("ANY")`→rimossi.

| Feature flag | Default | Effetto |
|---|---|---|
| `launch_type` | `fargate` | `ec2` opt-out (GPU/costo, con managed scaling on) |
| `autoscaling.enabled` | `false` | target tracking CPU/req (lo scaling orizzontale del brief) |
| `deploy.circuit_breaker/rollback` | `true` | deploy fallito → rollback automatico |
| `routing.alb` | `shared` | ALB unico/account multi-app; `dedicated` sconsigliato |
| `alarms.enabled` | `true` | i 4 alarm anti-Nivi → Wolico |

**Migrazione**: per-cliente, NON big-bang. Il fix Nivi (health check + desired=2 + circuit breaker) è quick
win a **0 $ subito** sul vecchio stack; il vero 0 $ su desired=2 arriva con awsvpc/Fargate (1 task/istanza
oggi). awsvpc consuma 1 ENI/task → verificare i limiti; pilota su un dev day-zero; blue/green sul CNAME
CloudFront per zero downtime. Preserva: scan ECR, log retention, import ALB (rifattorizzato pulito), SSM
Session Manager (no SSH). **Domande aperte**: `/health` servito da worker dedicato (lato app); NON usare
`/api/health/database` come health check ALB (un DB lento ucciderebbe il task = altra variante Nivi);
soglia Fargate-vs-EC2 sul costo; dove vive/ruota il secret dell'header ALB; metrica autoscaling (CPU vs
ALBRequestCountPerTarget).

---

## EDGE — Frontend / CDN / WAF  *(modulo: `edge`)*
**Scopo**: front door pubblico sicuro. Implementa **NETSEC-02/03/04** (il "trittico": vanno insieme).

**Costrutti**: `FrontendBucket` (PRIVATO, servito solo via OAC, bucket policy con `aws:SourceArn`) ·
`Distribution` (OAC + `error_responses` SPA + `add_api_behavior` HTTPS_ONLY verso ALB + header segreto;
espone `distribution_id` come property → no più copia a mano) · `OriginSecret` (header segreto
CloudFront→ALB in Secrets Manager, consumato dalla listener rule ECS) · `WebAcl` (WAFv2 **on**, rate-limit
2000/IP + 5 managed rule, modalità COUNT→BLOCK, logging).

**Default ribaltati**: bucket FE pubblico/website→**privato + OAC** · `BlockPublicAccess` tutto-False→
BLOCK_ALL · origine S3 website→`S3BucketOrigin` SigV4 · CloudFront→ALB HTTP_ONLY→**HTTPS_ONLY + header
segreto** · WAF 0/24→**on** · managed rule BLOCK diretto→COUNT poi BLOCK · rate_limit 500→2000 · log
CloudFront illimitati→retention 90gg · aggiunti `enforce_ssl`/encryption.

| Feature flag | Default | Effetto |
|---|---|---|
| `waf.enabled` / `waf.mode` | `true` / `count` | WAF on; COUNT al primo deploy poi `block` |
| `origin.secret_header.enabled` | `true` | header segreto CloudFront→ALB (NETSEC-03) |
| `frontend.spa` | `true` | `error_responses` 403/404→index.html |
| `frontend.versioned` | prod true/dev false | versioning bucket per rollback FE |

**Migrazione**: una distribuzione alla volta, da un dev pilota. **Ordine**: (1) WAF in COUNT (basso rischio);
(2) header segreto + HTTPS origin coordinato con ECS (regola in sola aggiunta → poi default-action 403, no
finestra di 403 sul traffico buono); (3) bucket privato+OAC (il più delicato: il FE bucket è
`removal_policy=DESTROY` → impostare RETAIN + sync prima); (4) logging/retention. **Prerequisito**: due
cert ACM DNS-validated (regionale eu-west-1 per origin ALB + us-east-1 per viewer CloudFront → TOOL-06).
Preserva: rate-limit + 5 managed rule, override falsi-positivi, IP allow-list, PriceClass_100,
REDIRECT_TO_HTTPS, compress. **Domande aperte**: cert us-east-1 in TOOL-06?; rotazione header segreto;
WAF log in us-east-1 → pipeline Wolico cross-region; COUNT→BLOCK manuale per-cliente.

---

## OBS — Monitoring & integrazione Wolico  *(modulo: `observability`)*
**Scopo**: il white-box che oggi non esiste, convogliato su **Wolico** (NON Checkmk, eliminato). Implementa
**MON-01..06**; **sostituisce MON-07/08** (Checkmk) con "CloudWatch → SNS → ingest Wolico".

**Costrutti**: `Observability` (facade montata dall'AppStack) · `AlarmSet` (alarm di default backend/ALB/RDS;
`treat_missing_data=BREACHING` sul liveness = la lezione Nivi) · `WolicoSink` (**il cuore**: SNS → Lambda
forwarder per-account → `POST /api/ingest/infra-alarm` su Wolico, con DLQ + email fallback; Lambda
**fuori-VPC** di default per raggiungere Wolico senza NAT) · `Dashboard` (CloudWatch tecnica, OFF di default)
· `LogConfig` (retention disciplinata: dev 1 settimana/prod 1 mese — niente più retention infinita).

**Default ribaltati**: 0 alarm→alarm-set on · `running_tasks_low` con `treat_missing=BREACHING` (il buco che
rese invisibili i 127 min Nivi) · Container Insights off→on · RDS PI/Enhanced/log off→on · log retention
infinita→disciplinata · nessun SNS→topic + sink Wolico · Checkmk→**eliminato**.

| Feature flag | Default | Effetto |
|---|---|---|
| `observability.enabled` | `true` | master switch |
| `wolico` | `true` | crea il sink verso Wolico; off → solo email fallback |
| `dashboard` | `false` | dashboard tecnica (deep-dive), il canale primario è Wolico |
| `logs.container_insights` / `rds.performance_insights` | `true` | metriche white-box (off nei dev per risparmio) |

**Integrazione Wolico (contratto proposto)**: `POST /api/ingest/infra-alarm`, auth HMAC, `Idempotency-Key =
alarm_arn+state_change_time`, body `{cod_application, environment, account_id, region, alarm_name, metric,
state(ALARM|OK), threshold, value, timestamp, source:'cloudwatch'}`. Wolico mappa state→severità, aggiorna
`Applications.health` (o nuova entità `InfraAlarm`) e **riusa il routing maintainer + soglie email** già
esistenti → single pane of glass (errori app + alarm infra + health). **Lato libreria**: alarm+SNS+Lambda
forwarder+DLQ+secret+retention. **Lato Wolico**: endpoint, auth, modello, mapping severità, dedup,
silenziamento (lo "scheduled downtime" da preservare).
**Migrazione**: 1) **lato Wolico** crea l'endpoint (one-off); 2) per account: secret + deploy del modulo
(**additivo**, nessun replace → basso rischio); 3) pilota su cliente non critico; 4) **Nivi** = validazione
del valore (i 4 alarm si accendono sulla causa nota); 5) eliminare Checkmk/LCP **solo dopo** che il modulo è
live. **Domande aperte**: auth HMAC vs API key; push per-account (scelto) vs pull cross-account (sconsigliato,
viola isolamento); Lambda fuori-VPC ok?; dedup lato Wolico; alarm composite anti-rumore.

---

## JOBS — Jobs / ETL / Task  *(modulo: `jobs`)*
**Scopo**: modulo dichiarativo unico per **tutti** i task (brief #4). Implementa **TASK-01..06**. Collassa i
5 fork attuali (ETLStack EC2, EcsEC2Task a mano, workflow GH `FLG_ETL`, background-task nel backend, factory
Step Functions custom ~1.640 righe).

**Costrutti**: `JobsModule` (facade, itera `jobs:[]`) · `ScheduledJob` (Fargate + EventBridge Scheduler,
RunTask one-shot, **zero istanze tra i run**) · `OnDemandJob` (taskdef Fargate avviabile via RunTask/SFN) ·
`QueueJob` (SQS + **DLQ sempre** + consumer Fargate con autoscaling su profondità coda; visibility = 6×
timeout) · `WorkflowJob` (**Step Functions native**, non la factory) · `JobTaskDefinition` (helper: immagine
per digest, secret iniettati come `secrets` ECS, IAM scoping).

**Default ribaltati**: EC2 capacity provider h24→**Fargate one-shot** · subnet PUBLIC+EIP→PRIVATE_ISOLATED ·
SQS visibility 43200 + no DLQ→`6×timeout` + DLQ sempre · `:latest`→digest · secret env-in-chiaro→`secrets`
ECS · IAM `resources=['*']`→scoping sull'ARN dichiarato in `needs` · EventBridge Rule→Scheduler · factory
custom→SFN native · niente alarm→alarm su fallimento → Wolico.

| Feature flag | Default | Effetto |
|---|---|---|
| `jobs:` (presenza) | assente | se assente, zero risorse (puro config-driven) |
| `<job>.compute` | `fargate` | `ec2` opt-out (GPU/oltre i limiti Fargate) |
| `<job>.autoscale` (queue) | `false` | scala i consumer sui messaggi in coda |
| `<job>.kind` | — | `scheduled` / `on-demand` / `queue` / `workflow` |

**Migrazione** (per cliente, dopo NET): ETL schedulati (gmm/andriani/prima-power) → `kind:scheduled` 1:1
(cron già nei yaml); coci `EcsEC2Task` → `on-demand` con `size:{cpu,mem}`; workflow GH `FLG_ETL` → stessa
immagine col `command` override; background-task async → `kind:queue` (li toglie dal web = co-causa Nivi);
factory SFN → `kind:workflow` (rischio basso: 0/24 la importano). Preserva: scan ECR + lifecycle "ultime 5
immagini", IAM SSM scoping, flag `enabled`, env di runtime (le immagini ETL girano senza modifiche).
**Domande aperte**: andriani c7g.4xlarge entra nel cap Fargate o resta EC2?; background-task sync vs async;
`needs:[internet]` per chi chiama API esterne (SMTP vs SES); dev a `min_consumers:0`.

---

## CONFIG — Scheda + composizione + naming  *(modulo: `config`)*  ← il collante
**Scopo**: la scheda `values.yaml` come **SSOT** (oggi le info in ≥5 posti). Implementa **TOOL-08** + abilita
i feature flag di tutti i moduli. Modella `apps:[]` come cittadino di prima classe (risolve 1-account/N-app).

**Costrutti**: `LaifConfig` (pydantic: identity, defaults, apps[], environments; **strict=true** → typo =
errore) · `Naming` (deriva stack_id/domain/bucket/secret/rds_identifier — elimina i `# CHANGE ME`) ·
`AppStack` (compone i moduli **solo se il flag è ON** — lo stack off non viene sintetizzato) · `synth_all()`
(app.py **generato**, 4 righe, itera `apps[]`).

**Default ribaltati**: `db_private` false→**true** · `waf` 0/24→**true** · `monitoring` assente→**true** ·
`eip`→**false** · `extra='allow'` (typo silenziosi)→**strict** · naming `# CHANGE ME`→derivato · 2 file
dev/prod→**1 values.yaml** con override · multi-app copia-incolla→`apps:[]` · "disabled a posteriori"→non
sintetizzato.

| Feature flag (per app/ambiente) | Default | Compone |
|---|---|---|
| `monitoring` | `true` | OBS |
| `db_private` | `true` | DATA in PRIVATE_ISOLATED |
| `multi_az` | `false` (solo prod) | DATA Multi-AZ |
| `autoscaling` | `false` | COMPUTE target tracking |
| `waf` | `true` | EDGE WebACL |
| `jobs:` (lista) | assente | JOBS |
| `auto_turnoff` | `false` (true dev) | spegnimento ECS+RDS |

**Migrazione**: pilota su un dev / cliente day-zero; `laif infra migrate` (best-effort: legge dev/prod.yaml+
app.py → propone values.yaml + apps[]); il **`cdk diff` è l'autorità**, non lo script. **Punto critico**:
migrare PRIMA a values.yaml tenendo i flag al valore **attuale** del cliente (`db_private:false` dove oggi è
pubblico, `monitoring:true` subito perché additivo), poi flippare un flag alla volta in PR separate con la
loro finestra. Il `cdk diff` su prod deve essere vuoto/spiegabile (riconcilia il drift Nivi).
**Domande aperte**: gerarchia override (defaults<app<env); 1 values.yaml/repo vs mono-repo flotta; dev
isolation; validazione semantica cross-modulo (soft in Config, hard nel modulo); region per-app.

---

## REPO — Strategia repo + tooling  *(modulo: `tooling`)*
Trattato in dettaglio in **`repo-strategy.md`**. In sintesi implementa **TOOL-01..08 + NETSEC-06**: infra
**dentro la repo di progetto** (`laif.yaml`), libreria pinnata (CodeArtifact), **OIDC** (no access key), CI
infra (reusable workflow centralizzato), cert/DNS nello stack (no doppio deploy), laif-dns modulare (delega
di zona), convergenza su `laif` (kill laif-cli/deployer, `lcp`/Checkmk eliminato).

---

## Domande aperte trasversali (da sciogliere prima/durante l'implementazione)
Raccolte dagli 8 agenti. Le più impattanti:
1. **Contratto endpoint Wolico** (OBS) — auth, payload, dedup: da concordare col team Wolico **prima** di OBS.
2. **Interface endpoints vs egress reale** (NET/JOBS) — mappa per-cliente di chi chiama API esterne non-AWS.
3. **Cert us-east-1 in TOOL-06** (EDGE) — confermare che copra entrambi i cert (origin ALB + viewer CloudFront).
4. **Soglia Fargate-vs-EC2 sul costo** (COMPUTE/JOBS) — per i backend piccoli h24 Fargate può costare più di
   un t4g condiviso: serve un'euristica o si accetta Fargate ovunque per semplicità?
5. **Dev isolation** (NET/DATA/CONFIG) — i dev restano isolati come i prod (default assunto) o si alleggerisce?
6. **CodeArtifact vs tag git** per il packaging (REPO) — costo/onboarding vs immutabilità.
