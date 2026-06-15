# Sintesi A.0 — Findings consolidati e cause radice

> Consolida i 10 documenti di `analisi/` in un quadro unico, prioritizzato, orientato alla decisione.
> Ogni finding ha **evidenza** (file:riga o comando AWS) e collega il problema del brief alla sua **causa
> radice**. È la base per il catalogo interventi (Fase B) e l'architettura target (Fase C).
> Data: 2026-06-11.

## 0. La tesi in una frase

**Tutta la flotta (~24 clienti, ~60 account) è clonata da un'unica libreria — `laif-cdk` — i cui
*default* codificano i problemi del brief**, e viene deployata da tooling imperativo (`laif-cli` +
`laif-deployer`) che crea risorse fuori da CloudFormation. Non ci sono ~24 problemi diversi: c'è **un
problema, ripetuto 24 volte**. Questo è anche la buona notizia: si corregge alla fonte (la libreria) e
si propaga a tutti.

Prova della clonazione: **10 repo `<cliente>-infra` su 24 hanno `app.py` byte-identico** (md5 uguale),
13/24 hanno drift ≤4 righe (`analisi/05` §2). Le repo infra sono gusci: il contenuto utile è ~15 righe
di YAML.

## 1. Mappa: problema del brief → causa radice → evidenza

| # Brief | Problema dichiarato | Causa radice (dove vive) | Evidenza |
|---|---|---|---|
| 1 | **Zero monitoring** (i down li scoprono i clienti) | In 3.970 righe di construct **non esiste un solo `cloudwatch.Alarm`/SNS/dashboard**; Container Insights off, Performance Insights off, log RDS off, enhanced monitoring off | `analisi/03` §1, §Focus2-3; live Casartelli/Nivi: solo 2 alarm auto-ECS, nessun SNS (`analisi/07` §11, `analisi/08` §1) |
| 2 | **Zero scalabilità orizzontale** (un picco butta giù il backend) | `add_capacity_provider` default `max_capacity=1`, `enable_managed_scaling=False`; **nessun autoscaling applicativo** (`auto_scale_task_count` mai chiamato) | `laif-cdk/.../constructs/ecs.py:200-208`; live: `describe-scalable-targets → []` su Casartelli e Nivi |
| 3 | **Risposta sbagliata ai down** (scale-up a mano) | Default 1 task + health check killer + **Multi-AZ inesistente** su RDS; nessun circuit breaker | Caso Nivi: upsize +26,6 $/mese **non ha risolto** (t4g.medium = stessi 2 vCPU) — `analisi/08` §3 |
| 4 | **Nessuna soluzione pulita per ETL/task** | ETL = stack EC2 sempre acceso (4/24 repo) o background task nel backend o workflow GH gemello con `FLG_ETL=1`; 5 varianti copia-incollate | `analisi/05` §2 (gmm/andriani/ferrari/prima-power/coci), `analisi/04` §2.4 |
| 5 | **laif-cdk sporco e ridondante** (~90% non usato) | **4 stack su 14 usati**; 8 mai importati; ~1.300 righe di Step Functions che reimplementano il DSL CDK nativo; zero test reali | `analisi/05` §5, `analisi/03` §step_functions |
| 6 | **DB non in rete privata** | `networks.py:29` VPC **solo subnet PUBLIC**; `db.py:72` RDS in subnet PUBLIC → `publicly_accessible=true` | Verificato live: `prod-nivi-db` e `*-casartelli-db` **PubliclyAccessible=true** con EIP pubblico (`analisi/07` §5, `analisi/08`) |
| 7 | **Load balancer pagati ma non sfruttati** | L'ALB punta all'**ASG di istanze EC2**, non al servizio ECS (`listener.add_targets(targets=[asg])`); bridge mode + hostPort statico → max 1 task/istanza | `ecs.py:688-698`, `:717`; live: ECS service `loadBalancers: []`, ALB bilancia 1 target (`analisi/07` §4,§6); LCU org-wide 0,83 $ (`analisi/09` §3) |
| 8 | **Account isolati** (valutare alternative) | Modello 1 account/cliente/ambiente × ~60; **43-52% della bolletta è floor fisso** di isolamento | `analisi/09` §6, `sintesi/01` §2 |

## 2. Il "deployment tipo" (stato day-zero, Casartelli 2026-06-10)

La foto di un cliente nuovo *prima* di ogni deriva manuale — cioè cosa `laif-cdk` produce **oggi**:

```
CloudFront ──(http chiaro)──> ALB internet-facing :80 ──> ASG (2× t4g.small) ──> 1 task ECS
   │                                                            (1 istanza idle/unhealthy)
   └──> S3 website bucket PUBBLICO (no OAC)        RDS Postgres db.t4g.micro PUBBLICO (EIP)
VPC: solo subnet pubbliche · 0 NAT · 0 WAF · 0 autoscaling · 0 alarm utili · :latest mutabile
```

- Dev e prod **identici al byte**: prod non ha nulla in più (no Multi-AZ, no repliche, no WAF), dev nulla
  in meno (gira h24). La "configurabilità per ambiente" del brief **oggi non esiste** (`analisi/07` §14).
- Costo a riposo: **~170 $/mese/cliente** prima di una sola richiesta utente (`analisi/07` §16).
- **In quel preciso momento 1 target era unhealthy e nessun alarm lo segnalava** (`analisi/07` §11).

## 3. Il caso Nivi: prova che "scale up a mano" è la strategia sbagliata

- **Causa del down**: health check container `curl / ogni 5s, timeout 5s, retries 2` (hardcoded
  `template_stack.py:501-506`) uccide l'**unico** task appena il backend single-worker satura **1 vCPU**
  (CPU inchiodata al 50% di un host 2-vCPU). `desired_count=1` → ogni kill = 2-5 min di 502/503.
  **127 minuti di down tra 27/5 e 10/6.**
- **L'upsize fatto** (EC2 t4g.small→medium, RDS micro→small + Postgres 15→17) **non ha risolto**: il
  medium ha gli **stessi 2 vCPU**; il 10/6 (dopo entrambi gli upsize) il task è stato ucciso ancora 3 volte.
  Costo: **+26,6 $/mese (+103% sul compute)**, oggi mascherato dai crediti.
- **Il fix vero costa 0 $**: defangare l'health check, 2+ worker, `desired_count=2`, 4 alarm CloudWatch.
- **Config drift**: `nivi-infra/prod.yaml` dice ancora Postgres 15 / nessun instance type → **la repo non
  riproduce la prod** (deploy da working copy mai committata). `analisi/08` §3.

## 4. Il monitoring NON è a zero: c'è Checkmk (ma è black-box e manuale)

`laif-cli lcp register` registra gli host su **Checkmk** (via "Laif Control Panel") per health-check
up/down, alert e downtime programmato (`analisi/02` §3). Esiste anche un **error-reporting verso Wolico**
(scan ogni 5 min, `analisi/06` §4). Quindi:
- **C'è** un ping black-box "l'host risponde?" + report errori applicativi.
- **Manca** tutto il white-box: CPU/RAM/disco delle macchine, metriche RDS, code, latenze, saturazione →
  il "perché va giù" non lo vede nessuno (nessuno guarda CloudWatch, che infatti costa 39 $/mese).

**Decisione strategica per Fase C** (la più impattante sul brief #1): tenere Checkmk per l'up/down +
**aggiungere CloudWatch (alarm/dashboard/Insights) per le risorse**, oppure migrare tutto su CloudWatch+SNS.

## 5. Tooling: tre generazioni che convivono, una migrazione già iniziata

| Tool | Stato | Ruolo |
|---|---|---|
| `laif-cli` (v2.3.29) | **congelato** da ott-2025, README ancora Bitbucket | 705 righe di **AWS imperativo** (IAM/cert/secret fuori da CFN) + wrapper `cdk deploy` + monitoring LCP |
| `laif-deployer` | immagine Docker 764 MB, submodule non pinnati | impacchetta cli+cdk+cdk-node; su Mac ARM **emulato** |
| `laif` (laif-factory) | **parziale**, branch `feat/new-app-skill` non mergiato | sta già **ri-portando** `init`/`deploy` su host (via `uv`) → il deployer non servirebbe più |

- **Eliminare laif-cli/deployer = ricollocare 8 responsabilità** (mappa in `analisi/02` §6). Solo 3 hanno
  valore non banale: monitoring LCP, glue DNS/cert post-deploy, richiesta cert ACM. Il resto è 1 comando
  nativo o **sparisce** rendendo le risorse CDK-owned (es. `wipeout` non serve più).
- **Onboarding nuovo cliente oggi = ~21-37 passi manuali**, 11+ sistemi, 2 approvazioni umane, **2 deploy
  che falliscono "by design"**, 4 deploy infra, doppio passaggio `deploy_services: false→true` per la race
  del certificato (`analisi/06` §2, `analisi/04` §4).
- **Rischio**: il branch `feat/new-app-skill` **automatizza il processo esistente con tutte le sue
  assurdità**. Se l'infra viene ridisegnata, gran parte dei 24 script va riscritta → **farli convergere**,
  non stabilizzare due volte (`analisi/06` §5).

## 6. Classifica dei difetti per severità (dal codice + live)

**🔴 Bloccanti di sicurezza**
1. RDS pubblico by default (`db.py:72` + `networks.py:29`) — verificato live nivi+casartelli.
2. Bucket frontend interamente pubblico senza OAC (`buckets.py:124-139` + `cloudfront.py:190-193`).
3. ALB raggiungibile da qualsiasi distribuzione CloudFront (no custom header), CloudFront→ALB in HTTP chiaro.
4. SG EFS apre **SSH al mondo** (`efs.py:61-65`); EC2 con utenti **password=username** + sudo (`constants.py`).
5. `add_ingress_rule("ANY")`/`expose_ssh("ANY")` aprono al mondo con un `print` (db/ecs/cache).
6. CI con **access key statiche** larghissime (`ecr:* ecs:* s3:*` su `*`), non OIDC.

**🔴 Bloccanti di affidabilità (le cause dei down)**
7. `max_capacity=1` + managed scaling off (`ecs.py:200-208`).
8. ALB → ASG invece che → servizio ECS + bridge/hostPort statico → max 1 task/istanza (`ecs.py:688-717`).
9. Multi-AZ inesistente su RDS; nessun circuit breaker/rollback sui deploy ECS; health check killer.

**🟠 Zero monitoring** — nessun alarm in tutta la libreria; Insights/PI/log-export off (§4).

**🟡 Costi** — 1 ALB per servizio; bucket log CloudFront illimitati; log Lambda retention infinita; ECR
senza lifecycle; Fargate task con IP pubblico; auto-turnoff deployato ma **OFF** (`analisi/07` §10).

**🐛 Bug veri (codice rotto)** — `SubnetType.PRIVATE` inesistente → **Lambda-in-VPC impossibile**
(`lambdas.py:61,118`); `**ec2ServiceProps` mai inoltrato; kwargs Fargate scartati; `subnet_selection`
scheduled task ignorato; crawler dependency su se stesso (`glue.py:275-278`); `get_values` ignora i
parametri; `user_data="None"` stringa. (`analisi/03` §classifica).

## 7. Cosa è fatto BENE (da preservare nel ridisegno)

- RDS: `storage_encrypted`, `deletion_protection`, `RemovalPolicy.RETAIN`, backup ≥14gg, GP3 autoscaling.
- ECR: `image_scan_on_push=True`. WAFv2: rate limit + 5 managed rule (ma deployato 0/24).
- CloudFront: `PriceClass_100`, `REDIRECT_TO_HTTPS`.
- Glue: l'unico modulo con validatori pydantic e default sensati (ma bug di dipendenza).
- Assenza di NAT = l'unica scelta *economica* (un NAT h24 ≈ 35 $/mese × 60 account ≈ 2.000 $/mese): il
  ridisegno "subnet private" **deve** confrontare NAT condiviso vs interface endpoints, o la bolletta esplode.
- Idee da automatizzare (non da buttare): glue DNS/cert post-deploy, scheduled downtime monitoring, il
  filtro stack `disabled` (seme della modularità on/off).

## 8. Le 3 decisioni strategiche che sbloccano tutto (input per Fase C)

1. **Modello account/rete**: restare 1-account-per-cliente (isolamento, ma 52% floor) vs VPC/account
   condivisi per ambiente vs ibrido (prod isolati, dev consolidati). È la leva di risparmio più grande.
2. **Monitoring**: Checkmk (up/down) + CloudWatch (risorse) vs CloudWatch+SNS unico. Risolve il brief #1.
3. **Tooling**: completare e far convergere `laif` (laif-factory) sul nuovo CDK, eliminando
   laif-cli/deployer, **tenendo** laif-dns — invece di stabilizzare il branch attuale sul vecchio flusso.

## 9. Nota su laif-dns (da tenere)
`laif-dns/prod.yaml` è un monolite di **1705 righe / 207 record CNAME**; la pipeline **non sa modificare
un record in-place** (serve rimuovi-deploy-riaggiungi-deploy) e ogni cambio richiede PR approvata a mano
(`analisi/06` §2). Si tiene la **funzione DNS**, ma va resa modulare/automatizzata (delega di zona o API)
o resterà un collo di bottiglia dell'onboarding.
