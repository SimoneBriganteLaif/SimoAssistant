# Anatomia di `TemplateStack` (laif-cdk) — lo stack che regge ~tutta la flotta

Analisi del 2026-06-10. Fonti: codice in `/Users/simonebrigante/LAIF/repo/laif-cdk` (HEAD `85ca96b`, ultimo commit 2026-06-10 13:17) + synth CDK reale eseguita in locale (read-only, nessun deploy). Repo cliente di confronto: `nivi-infra`.

---

## 1. Numeri chiave

| Cosa | Quanto |
|---|---|
| `laif_cdk/stacks/template_stack.py` | **804 righe**, 1 classe, 2 metodi (`__init__` righe 44–602, `_setup_bedrock_policies` righe 608–805) |
| Parametri di `TemplateStack.__init__` | **56 named** + `**kwargs` (un 57° parametro nascosto: `backend_container_kwargs` pescato da kwargs a riga 517) |
| Parametri raggiungibili dallo YAML (via `app.py` template) | **17 su 56** (~30%). Gli altri 39 richiedono di editare `app.py` nella repo del cliente |
| `settings.py` / `constants.py` / `utils.py` | 193 / 75 / 100 righe |
| Libreria intera | `stacks/` 3.500 righe in 14 file; `constructs/` ~3.970 righe in 22 file |
| Stack esportati in `stacks/__init__.py` | 7 su 11 moduli; **commentati**: RemoteStack, k8scluster (940 righe!), QueueStack (391), StepFunctionStack |
| `cookiecutter.json` | 17 chiavi |
| `dev.yaml`/`prod.yaml` template | 49 righe, ~30 chiavi in 4 sezioni (`default_stack`, `lambda_rds_turnoff`, `waf_stack`, `etl_stack`) |
| Risorse CloudFormation sintetizzate | **48** con `deploy_services: false`, **55** con `true`, **+4** nello stack di supporto Lambda@Edge in us-east-1 |
| `AWS::CloudWatch::Alarm` nel template | **0** |
| `AWS::ApplicationAutoScaling::*` nel template | **0** |
| Repo cliente `*-infra` locali che usano questo schema | 24 |
| Versioni | `pyproject.toml` dice `0.1.0`, `cookiecutter.json` dice `laif_cdk_version: 1.40`, il changelog si ferma a `1.30` — tre verità diverse |

Verifica empirica: ho sintetizzato `tests/app.py` con `aws-cdk-lib 2.254` (Python 3.12). Nota a margine già indicativa: **la config di test della repo stessa è rotta** — `tests/dev.yaml:5` ha `ACCOUNT_ID` non quotato (pydantic la rifiuta) e manca la chiave `auto_turnoff` (KeyError in `tests/app.py:34`). Ho dovuto correggerla in una copia in /tmp per riuscire a fare synth: i test non vengono eseguiti da tempo.

---

## 2. Cosa crea lo stack, risorsa per risorsa

Tutto in **un solo stack CloudFormation** (più uno di supporto in us-east-1). Dal template sintetizzato (55 risorse, `deploy_services: true`):

### Rete (`VpcWithSubnet`, constructs/networks.py:18-79)
- 1 VPC `10.0.0.0/16`, `max_azs=3`, **solo subnet PUBBLICHE** (1 sola `SubnetConfiguration` di tipo `PUBLIC`, mask `/18` dal default di template_stack.py:52) → 3 Subnet + 3 RouteTable + 3 Route + IGW. **Niente subnet private, niente NAT.**
- 2 Gateway Endpoint (S3, DynamoDB).
- 1+N `CfnOutput` esportati (`{id}-VpcId`, `{id}-PublicSubnetNId`, template_stack.py:213-229) per il cross-stack con l'ETL → lock CloudFormation sugli export.

### Storage
- **Data bucket** (`PrivateBucket`, buckets.py:31-65): `dev-{app}-data-bucket`, BLOCK_ALL, ma `RemovalPolicy.DESTROY` (buckets.py:62) — il bucket *dati* di produzione è marcato per distruzione con lo stack. Niente versioning, niente lifecycle.
- **Frontend bucket** (`FrontendBucket`, buckets.py:101-139): `dev-{app}-fe-build`, **S3 website hosting completamente pubblico** — `public_read_access=True` e i 4 flag di `BlockPublicAccess` tutti `False` (buckets.py:128-134). Confermato nel synth: `PublicAccessBlock: {BlockPublicAcls: False, ...}`.
- **3° bucket implicito**: log CloudFront (`enable_logging=True`, cloudfront.py:73), senza lifecycle → log accumulati per sempre.

### Database (`PostgresRds`, constructs/db.py:53-197)
- 1 `AWS::RDS::DBInstance` Postgres 17.10, `db.t4g.micro`, 20→100 GB gp3, cifrato, deletion protection, RETAIN, backup 14gg (minimo forzato, db.py:119-120), Performance Insights attivo (template_stack.py:267).
- **`PubliclyAccessible: True`** nel template sintetizzato: subnet `PUBLIC` (default di `rds_subnet_type=None` → `vpc.get_subnet_type()` → PUBLIC) fa derivare a CDK l'accessibilità pubblica. **MultiAZ: assente** (single-AZ).
- Security group con ingress **hardcoded di default verso `54.246.152.243/32` porta 5432** (template_stack.py:169). Supporta anche `"ANY"` (0.0.0.0/0) con solo un `print` di warning (db.py:199-209).
- Secret credenziali generato con nome convenzionale `{env}-{customer}[-{id}]-db-sysuser-secrets`.

### Container & compute
- 1 ECR (`BasicContainerRegistry`, ecr.py:20-44): scan on push, lifecycle "keep 5", `RemovalPolicy.DESTROY`.
- 1 ECS Cluster + SG di default `allow_all_outbound` (ecs.py:105-119). **Niente Container Insights.**
- Capacity provider (ecs.py:193-338): IAM Role (solo `AmazonSSMManagedInstanceCore`), LaunchTemplate (t4g.small ARM, AL2023, EBS 30GB gp3 cifrato), **ASG min=0 / desired=1 / max=2**, `AsgCapacityProvider` con managed scaling + termination protection. Default `backend_cluster_max_capacity=2` con `assert > 1` (template_stack.py:360) — paradossale: obbliga max≥2 ma il servizio non scalerà mai oltre 1 task (vedi §6.2).
- Opzione EIP: crea un EIP e lo associa **via user-data che installa AWS CLI al boot e chiama `ec2 associate-address`** (ecs.py:264-273), con policy `ec2:AssociateAddress` su `*`.
- 1 `Ec2TaskDefinition` in rete **bridge** con port mapping fisso **80:8000** (template_stack.py:173) + 1 LogGroup CloudWatch retention **2 settimane hardcoded** (ecs.py:735-741).
- Container "backend": memory_reservation 1024 MiB, health check `curl -f http://localhost:8000/` ogni 5s hardcoded (template_stack.py:500-506), env var infrastrutturali iniettate (DB_SECRET_ARN, versioni cdk/laif-cdk/laif-cli, ecc., righe 336-348). Nota: riga 354 stampa **tutte le env del container in chiaro** a ogni synth.

### Esposizione (solo con `deploy_services: true`)
- 1 `Ec2Service` con **`DesiredCount: 1` fisso** (riga 377: `self.desired_capacity = 1`).
- 1 ALB **internet-facing**, listener **HTTP:80** (HTTPS solo se `listener_port=443` + certificato, ecs.py:573-580), SG ingress solo dal prefix list CloudFront `pl-4fa04526` (hardcoded per eu-west-1 in settings.py:187-193; **qualsiasi altra regione → `ValueError`**).
- 1 TargetGroup: **`listener.add_targets(targets=[asg])`** (ecs.py:688-698) — l'ALB punta alle *istanze EC2 dell'ASG*, **non al servizio ECS** (vedi §6.3).
- 1 Lambda@Edge `url_changer` (NodeJS 22) che riscrive `/api/*` → `/*` — **creata sempre, anche con `deploy_services: false`** (template_stack.py:556, fuori da ogni if), generando uno stack di supporto da 4 risorse in us-east-1 per ogni app.
- 1 CloudFront Distribution: default origin = **S3 website endpoint in HTTP-only**, PriceClass 100, behavior `/api/*` → ALB **in HTTP** (cloudfront.py:188: `protocol_policy=HTTP_ONLY` di default), cache policy custom "no-cache".
- (opz. `waf_enable`) 1 `Custom::CrossRegionStringParameterReader` (AwsCustomResource + Lambda) che legge l'ARN della WebACL da SSM us-east-1 con policy `ANY_RESOURCE` (ssm_parameter_reader.py:38-40).

### IAM del task (template_stack.py:440-495 + Bedrock 608-805)
- `secretsmanager:GetSecretValue/Describe/List/**Update***` su **`resources=["*"]`** (righe 440-449) — il backend può *modificare qualunque segreto dell'account*.
- `ecs:RunTask`, `ecs:Describe*`, `ec2:Describe*` su `*` (per lanciare task ETL).
- `iam:PassRole` su `*` (condizionato a ecs-tasks).
- Con `enable_bedrock=True`: ruolo KB con **nome fisso `AmazonBedrockExecutionRoleForKnowledgeBase_MAIN`** (riga 627) — un secondo TemplateStack nello stesso account fallisce per name collision; invoke su `foundation-model/*`, `aws-marketplace:Subscribe`, S3 Vectors `bucket/*`.

### Stack companion istanziati dall'`app.py` template (cookiecutter)
- **AutoTurnOff** (autoturnoff_stack.py): Lambda Python schedulata **ogni ora al minuto 45** che spegne ogni RDS taggato `Auto-TurnOff=True`; policy `rds:Stop/StartDBInstance` su `*`. Nel YAML template è **`disabled: false` di default sia in dev che in prod** → ogni account prod ha una Lambda oraria capace di spegnere qualunque RDS, gated solo da un tag.
- **WAFStack** (us-east-1, rate limit 550): `disabled: true` di default — il WAF c'è ma non viene quasi mai acceso.
- **ETLStack**: `disabled: true` di default; quando attivo dipende da TemplateStack sia via riferimenti Python diretti (`app_stack.db`, `app_stack.vpc`) sia via export CFN.

---

## 3. La catena di configurazione (4 livelli, 3 linguaggi)

```
cookiecutter.json (17 chiavi) ──genera──▶ <cliente>-infra/{dev,prod}.yaml (~30 chiavi)
        │                                          │ pydantic-settings (extra="allow", NON tipizzato)
        └──genera──▶ app.py (82 righe, COPIA)──────┴──▶ TemplateStack(56 parametri) + 3 stack companion
```

1. **`cookiecutter.json`**: customer_name, account id/profili/regioni dev+prod, domini (`<app>-dev.app.laifgroup.com`), maintainer hardcoded `marco.vita@laifgroup.com`.
2. **`dev.yaml`/`prod.yaml`**: 4 chiavi top-level (CUSTOMER_NAME, ACCOUNT_ID, PROFILE_NAME, REGION) + 4 sezioni. Le sezioni stack sono **dict liberi senza schema**: `Settings` (settings.py:67-97) tipizza solo le 4 chiavi top-level; `default_stack` & co. passano grazie a `extra='allow'`.
3. **`app.py` generato**: indicizza i dict a mano (`config.default_stack["auto_turnoff"]`) → una chiave mancante = **KeyError a synth-time**, una chiave in più = silenziosamente ignorata. Nessuna validazione, nessun default centralizzato.
4. **`TemplateStack`**: i default veri vivono nella firma Python (56 parametri), distanti 2 livelli dallo YAML.

**Quali parametri sono YAML-raggiungibili** (17): id, app_name, vpc_id, certificate_arn, domain, deploy_services, db_name, rds_identifier, rds_preferred_backup/maintenance_window, rds_major/full_version, auto_turnoff, existing_alb (arn/sg/dns), waf_enable, waf_acl_parameter_name.

**Quali NO** (39, modificabili solo editando l'app.py del cliente): tutto il sizing (rds_instance_type, rds_allocated_storage, backend_cluster_instance_type, memory_reservation/limit, disk_size), tutta la rete (vpc_cidr, subnet types, cidr_mask), l'esposizione (rds_expose_to_ips, backend_expose_to_ips, listener_port), lo scaling (backend_cluster_max_capacity, enable_managed_scaling, scale_in_protection), eip, enable_bedrock, container_environments, backend_command, health check, keypair, ecr lifecycle...

**Selezione ambiente**: `cdk -c env=dev|prod` → `get_config_by_context` → `DevSettings`/`ProdSettings` che cercano `dev.yaml`/`prod.yaml` **nella CWD** (settings.py:37-64), con singleton `lru_cache` (riga 154). Convenzione su file + directory corrente: fragile e non testabile in parallelo.

### Flag e percorsi opzionali (matrice reale)
| Flag | Default | Effetto |
|---|---|---|
| `deploy_services` | **false** | senza: niente Service/ALB/TargetGroup (48 vs 55 risorse). È il workaround al chicken-egg "ECR vuoto al primo deploy": **ogni nuovo progetto richiede 2 deploy** + push immagine in mezzo, documentato solo da un `print_warning` (righe 543-546) |
| `auto_turnoff` | false | desired=0, **niente ALB**, tag su RDS per la Lambda oraria. Accoppia 3 stack; riaccensione manuale dell'RDS pena errore CFN (docs/Template.md:24) |
| `waf_enable` | false (yaml `disabled: true`) | aggiunge custom resource cross-region + WebACL su CloudFront |
| `enable_bedrock` | false | +ruolo KB singleton + 4 policy `*` sul task |
| `eip` / `elasticip_id` | false/None | EIP via hack user-data; sensato solo con 1 nodo (in contrasto con `assert max_capacity > 1`) |
| `vpc` / `vpc_id`, `rds`, `data_bucket`, `frontend_bucket`, `backend_registry`, `db_secret_arn`, `existing_alb_*` | None | injection di risorse esistenti (l'unico vero punto di modularità) |
| `scale_in_protection` / `enable_managed_scaling` | true/true | sull'ASG, non sul servizio |

---

## 4. Hardcoded notevoli (con riga)

- **`rds_expose_to_ips = ["54.246.152.243/32"]`** — template_stack.py:169: IP (VPN LAIF?) cablato nella libreria; la doc (docs/Template.md:80) cita *un altro IP* (213.209.202.66), segno che è già cambiato una volta a mano.
- Prefix list CloudFront `pl-4fa04526`/`pl-a3a144ca` solo per eu-west-1/eu-central-1 — settings.py:187-193: ogni altra regione → eccezione. Multi-region impossibile.
- Porta DB 5432 nella regola SG cluster→db — template_stack.py:423-425.
- `desired_capacity = 1` — template_stack.py:377. Non esiste parametro per avere 2 task.
- Port mapping `["80:8000"]` e health check `curl localhost:8000` — righe 173, 82.
- Health check ECS: interval 5s, retries 2, start 60s — righe 500-506, non parametrizzabili.
- Log retention 2 settimane — ecs.py:739.
- Nome ruolo Bedrock `..._MAIN` — riga 627 (singleton per account).
- Nome secret DB ricostruito per convenzione stringa — righe 300-314: se cambi `CUSTOMER_NAME` o `rds_identifier` il backend punta a un segreto inesistente.
- Backup retention minimo 14 giorni forzato con `raise` — db.py:119-120 (anche in dev, dove costa e basta).
- ID del VPC construct «hardcoded di proposito» (commento in italiano, righe 202-204).
- Cron AutoTurnOff `45 * * * *` — autoturnoff_stack.py:24-28.

---

## 5. Grafo delle dipendenze

```
VPC ──▶ RDS (subnet PUBLIC, SG) ◀── allow_to 5432 ── ECS Cluster SG
 │  └─▶ ASG/LaunchTemplate ──▶ CapacityProvider ──▶ Ec2Service (count=1)
 │                                   ▲ TaskDef(bridge 80:8000) ◀── ECR ◀── (push manuale tra deploy 1 e 2!)
 ├─▶ ALB (public, HTTP:80) ── targets ──▶ **ASG instances** (non il service!)
 │        ▲ SG ingress ◀── CloudFront prefix-list (solo eu-west-1)
 └─▶ CfnOutput exports ──▶ ETLStack (Fn.import_value) ──── lock sugli export
CloudFront ◀── FrontendBucket(pubblico) + ALB(/api/*) + Lambda@Edge(us-east-1) + ACM(us-east-1) + SSM WAF ARN(us-east-1, custom resource)
RDS tag Auto-TurnOff ◀──(ogni ora)── AutoTurnOff Lambda (stack separato, rds:Stop* su "*")
secret DB ◀──per nome-convenzione──── task backend (secretsmanager:* su "*")
```

Tre accoppiamenti trasversali particolarmente costosi: (a) ETL↔Template via export CFN *e* riferimenti oggetto, (b) auto_turnoff che attraversa 3 stack e cambia la *forma* dello stack (rimuove l'ALB → CloudFront perde il behavior `/api/*`), (c) us-east-1 obbligatorio per Edge/ACM/WAF con custom resource cross-region.

---

## 6. Difetti di design specifici

### 6.1 God-stack monolitico
1 stack = VPC + S3×3 + RDS + ECR + ECS + ALB + CloudFront + Lambda@Edge + IAM: 56 parametri, 55 risorse, blast radius totale. Ogni modifica passa da un update dell'intero stack; gli export CFN verso l'ETL impediscono refactor della rete senza toccare 2 stack in ordine preciso.

### 6.2 Zero scalabilità orizzontale (conferma del problema #2/#7 del brief)
- `DesiredCount: 1` cablato (riga 377); nessuna chiamata a `auto_scale_task_count` nel percorso del template (l'unica nella libreria è in `queue_stack.py:186`, **commentato fuori da `__init__.py`**).
- Il managed scaling dell'ASG può aggiungere istanze EC2, ma ECS non chiederà mai un 2° task → **l'ALB (≈18-25 $/mese fissi) bilancia per sempre 1 solo task**.
- Rete `bridge` con host port **fisso 80** → max 1 task per istanza *by construction*: anche alzando desired_count a mano, due task non coesistono sulla stessa EC2.

### 6.3 L'ALB punta alle istanze, non al servizio ECS
`listener.add_targets(targets=[asg])` (ecs.py:688-698) registra le **EC2 dell'ASG** come target; il `Ec2Service` è creato separatamente (ecs.py:480-490) senza `load_balancers`/`attach_to_application_target_group`. Conseguenze: l'health check ALB vede la *macchina*, non il *task*; niente connection draining coordinato con ECS; durante un deploy con 1 istanza il vecchio task va ucciso per liberare la porta 80 prima che parta il nuovo (`minimumHealthyPercent` 50% di 1 = 0) → **ogni deploy è un down breve "by design"**.

### 6.4 Zero monitoring (conferma del problema #1 del brief)
0 `AWS::CloudWatch::Alarm`, 0 dashboard, 0 SNS topic, 0 Container Insights nel template sintetizzato. Grep su tutta la libreria: nessuna occorrenza di "alarm". L'unico "monitoraggio" è il Performance Insights di RDS (attivo ma non guardato da nessun allarme) e l'health check ALB. Il cliente si accorge del down prima di LAIF perché *nessuna risorsa può notificare nulla*.

### 6.5 Database pubblico (conferma del problema #6 del brief)
Sintetizzato: `PubliclyAccessible: True`, subnet pubblica, IP pubblico, SG aperto a un IP cablato nella libreria (`54.246.152.243/32`), opzione `"ANY"` che apre 0.0.0.0/0 con un semplice print. Il VPC di default **non ha proprio subnet private** (networks.py:56-62: una sola SubnetConfiguration PUBLIC), quindi anche volendo, `rds_subnet_type: PRIVATE` fallirebbe senza rifare il VPC. Single-AZ, nessuna read replica.

### 6.6 Frontend bucket S3 pubblico in website mode
`public_read_access=True` + BlockPublicAccess tutto disabilitato (buckets.py:128-134) + origin CloudFront→S3 website **in HTTP**. Pattern deprecato da anni: bucket privato + OAC. Chiunque può bypassare CloudFront (e quindi il WAF, quando attivo) colpendo direttamente l'endpoint S3.

### 6.7 IAM lasco
`secretsmanager:Update*` su `*` (righe 440-449), `ecs:RunTask` su `*`, `iam:PassRole` su `*`, Bedrock invoke su `*`, custom resource SSM con `ANY_RESOURCE`, AutoTurnOff con `rds:StopDBInstance` su `*` **deployata di default anche in prod** (yaml: `lambda_rds_turnoff.disabled: false`). Un container backend compromesso può riscrivere tutti i segreti dell'account e lanciare task arbitrari.

### 6.8 TLS interrotto a metà
CloudFront→ALB in HTTP:80 in chiaro (default `listener_port=80`, origin `HTTP_ONLY` cloudfront.py:188); HTTPS sul listener solo configurando 443+cert a mano. Il prefix-list SG limita le sorgenti ma non cifra.

### 6.9 Config non validata + drift della flotta
- Dict YAML senza schema → KeyError a runtime (dimostrato: la stessa `tests/dev.yaml` della repo non sintetizza).
- `app.py` è una **copia cookiecutter per cliente**: `nivi-infra/app.py` è una versione vecchia senza `vpc_id`/`existing_alb` → 24 repo infra con 24 app.py potenzialmente tutti diversi, non aggiornabili centralmente.
- Doc divergente dal codice: docs/Template.md dichiara ECR default 4/UNTAGGED (codice: 5/ANY, righe 59-60), instance `t3.micro` (codice `t4g.small`), IP LAIF diverso.

### 6.10 Dead code ≈ metà libreria (conferma del problema #5 del brief)
k8scluster.py (940 righe), queue_stack.py (391), remote_stack.py (208), step_functions_stack.py + constructs/step_functions.py (319), constants.py REMOTE (75 righe di user-data apt per VM dev): tutti non esportati o commentati in `stacks/__init__.py`. Più doppioni storici di template_stack: `backendwithworkers.py` (308) e `webstackwithworkers.py` (164). Stima: **>2.000 righe morte su ~7.500 di libreria**.

### 6.11 Varie ma indicative
- `RemovalPolicy.DESTROY` sul **data bucket** (buckets.py:62).
- Lambda@Edge creata anche senza servizi (riga 556): stack us-east-1 inutile per ogni app "spenta".
- `pkg_resources` deprecato in utils.py:2 (è ciò che rompe il venv su Python 3.13).
- `print_info` delle env complete del container a ogni synth (riga 354) — leak di configurazione nei log CI.
- Messaggi/typo: "grater then 1" (riga 361), docstring che documenta parametri inesistenti (`flower_command`, `worker_cluster_*`, righe 147-155, copiati da webstackwithworkers).
- Nessun unit test per TemplateStack (in `tests/unit/` ci sono 3 file per altri stack, uno dei quali si chiama `...copy.py`).

---

## 7. Cosa significa per il redesign

1. I problemi 1, 2, 5, 6, 7 del brief sono **confermati a livello di codice e di template sintetizzato**, non sono incidenti di configurazione dei singoli clienti: ogni cliente che usa il default ha DB pubblico, 1 task fisso dietro un ALB pagato, zero allarmi.
2. Le quick win a costo quasi zero emergono già da qui: (a) collegare l'ALB al *servizio* ECS invece che all'ASG + `auto_scale_task_count`, (b) togliere il listener HTTP/forzare 443, (c) subnet private+NAT o almeno `PubliclyAccessible=False` + accesso via SSM/bastion, (d) un construct `Alarms` minimale (CPU/mem/5xx/DB connections + SNS) iniettabile, (e) spegnere la Lambda AutoTurnOff in prod.
3. La nuova libreria deve invertire il modello: **moduli piccoli composti dall'app del cliente** (Rds, EcsBackend, StaticFrontend, Etl, Monitoring) con config tipizzata (pydantic *vero*, schema per modulo) invece di un super-stack con 56 parametri e un dict YAML libero. Il punto di iniezione risorse esistenti (`vpc/rds/bucket=...`) è l'unica idea da salvare.
4. Eliminare la copia cookiecutter di `app.py` (o ridurla a 10 righe di composizione): è la fonte del drift di flotta che rende oggi impossibile un upgrade centralizzato.
