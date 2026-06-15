# 03 — Analisi dei construct di laif-cdk

> Analisi del 2026-06-10 su `/Users/simonebrigante/LAIF/repo/laif-cdk/laif_cdk/constructs/`
> (branch `main`, ultimo commit `85ca96b` "feat(ecs): support importing an existing ALB").
> Dipendenza: `aws-cdk-lib~=2.254` (pyproject.toml:9). Tutti i riferimenti `file:riga` sono relativi
> a `laif_cdk/constructs/` salvo dove indicato. Evidenze AWS raccolte read-only su `nivi-prod`, `eu-west-1`.

## Sintesi

La cartella conta **3.970 righe** in 22 file + **2.969 righe** in `lib/` (glue + step_functions).
La libreria è un patchwork di stili (wrapper banali di 50 righe, factory dict-driven da 1.000 righe,
moduli pydantic ben fatti solo per Glue) con **zero test reali** (i 3 file in `tests/unit/` sono
interamente commentati, uno si chiama `test_webstackwithworker_stack copy.py`).

I tre problemi del brief sono scritti nei default dei construct:

1. **Zero monitoring**: in TUTTA la libreria non esiste un solo `cloudwatch.Alarm`, SNS topic o
   dashboard. `aws_cloudwatch` è importato solo in ecs.py:28 per tipizzare una metrica custom di
   autoscaling. Container Insights mai abilitato, Performance Insights default off, log Postgres
   mai esportati, enhanced monitoring RDS mai attivato.
2. **Zero scalabilità orizzontale**: `add_capacity_provider` ha default `max_capacity=1` (ecs.py:201)
   e `enable_managed_scaling=False` (ecs.py:208); il target group dell'ALB punta all'**ASG di
   istanze EC2** e non al servizio ECS (ecs.py:688-698) → l'ALB è un passacarte verso 1 macchina.
3. **DB in rete pubblica**: la VPC di default ha SOLO subnet pubbliche (networks.py:29) e il
   costrutto RDS mette il DB in subnet PUBLIC (db.py:72) → CDK imposta `publicly_accessible=true`.
   Verificato in prod: `prod-nivi-db` ha `PubliclyAccessible: true`, `MultiAZ: false`,
   `MonitoringInterval: 0`, `EnabledCloudwatchLogsExports: null`
   (`aws rds describe-db-instances --profile nivi-prod --region eu-west-1`).

---

## Focus 1 — networks.py (134 righe): la VPC

### Cosa incapsula
Tre classi: `VpcWithSubnet` (crea VPC), `VpcImported` (`from_lookup`), `VpcFromAttributes`
(`from_vpc_attributes`). La VPC creata ha: 1 sola tipologia di subnet, max 3 AZ, CIDR /16,
gateway endpoint S3 e DynamoDB.

### Difetti concreti
| Riga | Difetto | Impatto |
|---|---|---|
| networks.py:29 | `default_subnet_type=ec2.SubnetType.PUBLIC` | **Tutta la rete è pubblica by default**: DB, ECS, cache finiscono su subnet con route diretta a IGW. Root cause del problema sicurezza #6 del brief. |
| networks.py:56-62 | Una sola `SubnetConfiguration` per l'intera VPC | **Impossibile avere public+private insieme**: il costrutto non supporta proprio la topologia corretta (ALB pubblico + workload privato). Per metterci un NAT bisogna riscrivere il costrutto. |
| networks.py:70-77 | Solo gateway endpoint S3/DynamoDB (gratuiti, bene); **nessun interface endpoint** (ECR, CloudWatch Logs, Secrets Manager, SSM) | Oggi irrilevante (tutto pubblico); nel redesign con subnet private servono endpoint (~7,3 $/mese ciascuno) o NAT (~35 $/mese + traffico) — da decidere a tavolino. |
| networks.py:– | Nessun VPC Flow Log | Zero visibilità di rete, per sicurezza e debug down. |
| networks.py:8-16 | `IVpc` non è ABC; `get_subnet_type()` legge `self._subnet_type` definito solo nelle sottoclassi | Interfaccia finta: nessun enforcement, AttributeError potenziale. |
| networks.py:99, 134 | `from_lookup`/`from_vpc_attributes` usano `scope` (il padre) invece di `self` come scope | L'oggetto importato vive nello scope del genitore con id `f"{app_name}-vpc"`: rischio collisione id e albero construct fuorviante. |

**Nota costi**: paradossalmente l'assenza di NAT gateway è l'unica scelta *economica* della
libreria (un NAT sempre acceso costa ~32-35 €/mese/account × 60 account ≈ 2.000 €/mese). Il
redesign "subnet private" deve esplicitamente confrontare NAT condiviso vs interface endpoints
vs NAT instance, altrimenti la bolletta esplode.

---

## Focus 2 — db.py (325 righe): RDS Postgres

### Cosa incapsula
`PostgresRds` (DatabaseInstance) e `PostgresRdsFromSnapshot` (quasi copia-incollata, marcata
`# noinspection DuplicatedCode` a db.py:52 e db.py:215). Crea SG dedicato, credenziali generate
in Secrets Manager, parameter group opzionale.

### Default PERICOLOSI
| Riga | Difetto | Impatto |
|---|---|---|
| db.py:72 (e :234) | `subnet_type=ec2.SubnetType.PUBLIC` | DB in subnet pubblica → CDK deduce `publicly_accessible=true`. **Confermato su nivi-prod**. Problema #6 del brief. |
| db.py:199-209 (e :312-322) | `add_ingress_rule("ANY")` apre la porta 5432 a `0.0.0.0/0` con un semplice `print("[WARNING] ...")` | Esporre il DB al mondo è a un parametro di distanza, senza guardrail. In `stacks/template_stack.py:168-169` il default è `rds_expose_to_ips=["54.246.152.243/32"]` (IP hardcoded del VPN LAIF) — il DB è raggiunto **via internet** anche dal backend. |
| db.py:– | **`multi_az` non esiste** come parametro; CDK default = False | Mai Multi-AZ in nessun deploy (confermato nivi-prod `MultiAZ: false`). Un fail dell'AZ = down totale, coerente col problema #3 del brief. Passabile solo via `**rds_props` non documentato. |
| db.py:71 | `allow_major_version_upgrade=True` di default | Un typo nella versione in config può innescare un major upgrade (downtime + migrazione irreversibile). |
| db.py:130 (e :273) | SG con `allow_all_outbound=True` | Minore, ma nessuna egress discipline. |
| db.py:176-179 | Secret generato senza **rotation** | Credenziali eterne. |
| db.py:233 | `PostgresRdsFromSnapshot` default `VER_14_7` | Versione vecchia (il costrutto principale default 17.10, db.py:69): i restore da snapshot nascono già indietro. |

### Default COSTOSI / di monitoring
| Riga | Difetto | Impatto |
|---|---|---|
| db.py:78 | `enable_performance_insights=False` | PI gratis a 7 giorni di retention: tenerlo spento di default è solo perdita di visibilità (nivi l'ha attivato a mano: `pi: true`). |
| db.py:81 | `cloudwatch_logs_exports=None` | Niente log Postgres su CloudWatch (confermato `logs: null` su nivi-prod): impossibile fare diagnosi di slow query/lock durante un down. |
| db.py:– | `monitoring_interval` non esposto → Enhanced Monitoring off (`MonitoringInterval: 0` su nivi-prod) | Zero metriche OS (memoria/IO reali) sul DB. |
| db.py:– | **Zero alarm** (CPU, FreeStorageSpace, connections, burst balance) | Problema #1 del brief. |
| db.py:190 | `performance_insight_encryption_key=self.performance_insights_kms_key_id` passa una **stringa** dove l'API attende `kms.IKey` | Bug latente: chi valorizza il parametro rompe il synth. |
| db.py:83 | `**rds_props: rds.DatabaseInstanceProps` — annotazione fittizia su kwargs liberi | Override silenziosi non validati; pattern ripetuto in tutta la libreria. |

### Cose fatte bene (da conservare nel redesign)
`storage_encrypted=True` (db.py:64), `deletion_protection=True` (db.py:184),
`RemovalPolicy.RETAIN` (db.py:186), backup retention forzata ≥14 giorni (db.py:119-120, con typo
"grater"), storage GP3 con autoscaling fino a `max_allocated_storage=100` GB (db.py:67).

---

## Focus 3 — ecs.py (1.063 righe): cluster, servizi, ALB

### Cosa incapsula
`EcsEC2Cluster` (cluster + capacity provider EC2 + ALB + SG), `EcsTask`/`EcsEC2Task`/
`EcsFargateTask` (task definition + container + scheduled task). È il cuore di ogni backend LAIF.

### Il difetto architetturale: l'ALB non bilancia il servizio ECS
`add_application_load_balanced_service` (ecs.py:546-703):

- ecs.py:688-698 — `listener.add_targets(..., targets=[asg], ...)`: il target group registra
  **le istanze EC2 dell'ASG**, non il servizio ECS. Con `NetworkMode.BRIDGE` di default
  (ecs.py:717) e porta host fissa, ne consegue:
  - 1 task per porta per istanza: `desired_count>1` sulla stessa macchina è impossibile;
  - health check ALB sull'istanza, non sul task: un container morto con istanza viva resta in rotta;
  - i deploy ECS non sono coordinati con l'ALB (niente drain per task, niente rolling sicuro);
  - l'autoscaling ECS, se anche esistesse, non cambierebbe nulla nel routing.
  È esattamente il problema #7 del brief: **"load balancer pagati ma non sfruttati"**.
- ecs.py:638-648 — **un ALB nuovo per ogni servizio** (~16-25 $/mese l'uno, ~22 $/mese tipico):
  nessuna condivisione ALB multi-servizio via host/path rule. Su ~20+ clienti con ALB è la prima
  voce di spreco aggredibile.
- ecs.py:571 → 596-602 — `**ec2ServiceProps` è dichiarato ma **mai inoltrato** a `add_service`:
  qualunque property extra passata dal chiamante viene ignorata in silenzio (bug).
- ecs.py:562-564 — health check default `interval=5s, timeout=4s, healthy_threshold=2`:
  aggressivo (ogni 5 secondi), `unhealthy_threshold` non configurabile.
- ecs.py:555 — `cf_prefix_list_id="pl-4fa04526"` hardcoded (valido solo eu-west-1; esiste
  `get_env_cf_prefix()` in `laif_cdk/settings.py:187-193` ma qui non è usato).
- ecs.py:573-578 — `certificates=[certificate.arn]` passa stringhe ARN dove l'API attende
  `IListenerCertificate`.
- ecs.py:646 — subnet ALB forzata PUBLIC (ok per internet-facing, ma `internet_facing=False`
  con subnet PUBLIC è una combinazione incoerente permessa).
- Nessun redirect HTTP→HTTPS, nessun access log ALB, nessuna deletion protection, nessun alarm
  su 5xx/UnHealthyHostCount.

### Capacity provider: lo scaling è spento by design
`add_capacity_provider` (ecs.py:193-338):

- ecs.py:200-204 — `min_capacity=0, max_capacity=1, desired_capacity=1`: il "cluster" è **una
  singola EC2**. Problema #2 del brief codificato nel default.
- ecs.py:208 — `enable_managed_scaling=False`; la docstring dice "Defaults to True"
  (ecs.py:230-231): **documentazione mendace**. Idem `scale_in_protection` (ecs.py:207 vs 228-229).
- ecs.py:255-273 — user-data che a ogni boot scarica AWS CLI da internet, lo installa e
  auto-associa un Elastic IP all'istanza: pattern "pet con IP fisso", alternativa fai-da-te
  all'ALB. Dipendenza da internet al boot = bootstrap fragile.
- ecs.py:312-318 — policy inline `ec2:AssociateAddress` su `resources=["*"]`.
- ecs.py:198 — AMI AL2023 ARM hardcoded di default con `t4g.small`: ok costi, ma nessun
  warm pool/aggiornamento AMI gestito.

### Cluster e servizi
- ecs.py:105-110 — `ecs.Cluster` senza `container_insights` → **disabled** (confermato:
  `prod-nivi-credit-be-cluster` ha `containerInsights: disabled`,
  `aws ecs describe-clusters --include SETTINGS --profile nivi-prod`). Zero metriche per-service.
- ecs.py:79 — `subnet_type=PUBLIC` default per le istanze del cluster.
- ecs.py:442-448 — `_create_fargate_service` viene chiamato **scartando** `cloud_map_options`,
  `daemon` e `**service_props` (bug) e forza `assign_public_ip=True` (ogni task Fargate con IP
  pubblico: superficie d'attacco + 0,005 $/h per IPv4 pubblico dal 2024).
- ecs.py:500 — Fargate `desired_count=0` di default (incoerente con EC2 = 1).
- ecs.py:– — **Nessun autoscaling applicativo**: mai chiamato `auto_scale_task_count` /
  `scale_on_cpu_utilization`; nessun deployment circuit breaker / rollback automatico.
- ecs.py:340-399 — `expose_port(ip="ANY")` apre `0.0.0.0/0` con un `print`; `expose_ssh`
  (ecs.py:378-387) apre SSH al mondo con la stessa disinvoltura.

### Task definition e scheduled task
- ecs.py:735-741 — log group con retention fissa `TWO_WEEKS` non configurabile e
  `RemovalPolicy.DESTROY`; un solo log driver per tutti i container della task.
- ecs.py:843 — `tag: str = "latest"` default per le immagini: deploy non riproducibili.
- ecs.py:894 e :921 — `add_scheduled_task` accetta `subnet_selection` (default PUBLIC) ma la
  riga che lo inoltra è **commentata** → parametro silenziosamente ignorato (bug); per Fargate
  vale il default PUBLIC di ecs.py:1044-1045.
- ecs.py:999-1000 — Fargate task default 256 CPU / 512 MB.
- Igiene: docstring placeholder "[description]" (ecs.py:233-234, 424-430), TODO aperti
  (ecs.py:101, 545, 744), codice commentato (ecs.py:893, 972-973, 985).

---

## Gli altri construct

### cloudfront.py (266 righe) — `Distribution`
- cloudfront.py:73 — `enable_logging=True` **senza** `log_bucket` → CDK crea un bucket di log
  per ogni distribuzione, senza lifecycle: log che si accumulano per sempre, mai letti
  (costo S3 crescente su ~60 account). O si spegne o si mette lifecycle.
- cloudfront.py:190-193 — origin S3 = `S3StaticWebsiteOrigin` (endpoint website pubblico),
  **niente OAC/OAI**: chiunque può bypassare CloudFront (e quindi il WAF) colpendo direttamente
  il bucket. Va a braccetto col `FrontendBucket` pubblico (vedi sotto).
- cloudfront.py:188 — verso origin custom/ALB il default è `HTTP_ONLY`: il tratto
  CloudFront→origin viaggia in chiaro su internet (il TLS termina all'edge).
- cloudfront.py:130 — usa l'API privata jsii `cf_behavior._values`: si rompe a ogni upgrade CDK.
- cloudfront.py:25 — `web_acl_id: str | None = ""` (stringa vuota come default).
- cloudfront.py:195 — `hasattr(origin, 'load_balancer_arn')` come type check (duck typing fragile).
- Nessuna `error_responses` per SPA (404 sui deep-link), nessun alarm 5xx.
- Buono: `PriceClass.PRICE_CLASS_100` (cloudfront.py:30) e `REDIRECT_TO_HTTPS` (cloudfront.py:162).

### cache.py (122 righe) — `CacheCluster` (ElastiCache)
Qualità da prototipo mai ripulito:
- cache.py:65 — subnet group sulle subnet **PUBLIC** (col TODO "refactor this").
- cache.py:42 — security group chiamato **"prova"**; id construct **"test-id"** (cache.py:70),
  **"some-special-ids"** (cache.py:79), "test-id-cache-cluster" (cache.py:90).
- cache.py:46-56 — engine forzato `redis`, single node (`num_cache_nodes=1`), `CfnCacheCluster`
  invece di ReplicationGroup: **niente replica, niente failover, niente encryption at
  rest/in transit, niente engine_version pinnata, niente snapshot**.
- cache.py:99-106 — `add_ingress_rule("ANY")` apre la 6379 al mondo con un `print`.

### buckets.py (170 righe) — `PrivateBucket`, `FrontendBucket`
- buckets.py:62 e :135 — `removal_policy=RemovalPolicy.DESTROY` su **entrambi** i bucket,
  anche quello dati: un `cdk destroy` (o un rename di id logico) tenta la cancellazione.
  Niente versioning, niente lifecycle, niente `enforce_ssl`.
- buckets.py:124-139 — `FrontendBucket`: `public_read_access=True` + BlockPublicAccess tutto
  a False + website hosting. Bucket interamente pubblico (pattern legacy pre-OAC).
- buckets.py:75-99 vs 147-171 — `get_read_write_policy`/`get_read_policy` duplicate identiche
  nelle due classi.
- buckets.py:11-28 — `IBucket` usa `@abstractmethod` senza ereditare ABC: decorazione inefficace.

### lambdas.py (225 righe) — 4 varianti di Lambda
- **lambdas.py:61 e :118 — `ec2.SubnetType.PRIVATE` NON esiste in aws-cdk-lib 2.254**
  (membri reali verificati con la venv del repo: `PRIVATE_ISOLATED`, `PRIVATE_WITH_EGRESS`,
  `PRIVATE_WITH_NAT`, `PUBLIC`). Passare `vpc=` a `LambdaFromEcr`/`LambdaFromS3` solleva
  `AttributeError`: **mettere una Lambda in VPC è rotto da sempre** → nessuna Lambda può
  raggiungere un DB privato. Altro tassello del "tutto pubblico".
- lambdas.py:48 e :106 — `timeout=900` (il massimo) di default per ogni Lambda.
- Nessun `memory_size` (default 128 MB), **nessuna log retention** (i log group impliciti delle
  Lambda hanno retention infinita → costo CloudWatch Logs perenne), nessun alarm su errori/throttle.
- lambdas.py:50 — parametro morto `cus_nme: str = None` (typo mai usato).
- lambdas.py:162 — `print("[WARNING] ... Please don't use this construct!")` dentro
  `_LambdaFromDirectory`; lambdas.py:186-187 commento che definisce la soluzione "brutta".
  Costrutti deprecati di fatto ma esportati in `__init__.py:5`.

### sqs.py (70 righe) — `SimpleQueue`
- sqs.py:49 — `visibility_timeout=43200` (12 ore, il massimo) di default: un consumer che
  crasha senza delete fa riapparire il messaggio **12 ore dopo**. Default operativamente tossico.
- Nessuna **DLQ**, nessun alarm su `ApproximateAgeOfOldestMessage`.
- sqs.py:65 — la coda è creata con `scope=scope` (il padre) invece di `self`: il costrutto è
  un guscio vuoto nell'albero CDK.
- sqs.py:28 — policy `sqs:ListQueues` su `arn:aws:sqs:*:*:*`.

### efs.py (81 righe) — `BasicElasticFileSystem`
- **efs.py:61-65 — il security group di default apre SSH (porta 22) a `0.0.0.0/0`… su un EFS.**
  Doppio errore: porta sbagliata (EFS usa NFS/2049, che NON viene aperta → i mount col SG di
  default falliscono) e aperta al mondo intero.
- efs.py:80 — `print("Pignoli", self.elastic_file_system)` — debug print dimenticato.
- Nessuna lifecycle policy (IA = -85% sul freddo), nessun backup policy esplicito.

### launch_template.py (170 righe) + `laif_cdk/constants.py`
- launch_template.py:113 — `user_data: Optional[UserData] = "None"`: default **stringa "None"**.
- constants.py (REMOTE['user']['base']) — crea utenti con **password = username**
  (`echo -e -n "{username}\n{username}\n{username}" | passwd {username}`) e li aggiunge a
  sudoers. Combinato con `expose_ssh("ANY")` di ecs.py è una falla d'accesso seria.
- constants.py (REMOTE['base']) — `apt -y upgrade` a ogni boot + installazione di emacs/jupyter:
  bootstrap lento e non deterministico su macchine di produzione.
- launch_template.py:159 — `key_name` (deprecato) invece di `key_pair`.
- Buono: EBS GP3 cifrato di default (launch_template.py:140-147).

### glue.py (324 righe) + lib/glue (~1.000 righe)
Lo stile migliore della libreria (validatori pydantic, autori dichiarati glue.py:71-73,
defaults sensati: `flex_execution=True`, `timeout=120min`, `max_retries=0` in
`lib/glue/validators/defaults.py:38-55`). Però:
- glue.py:275-278 — **bug copy-paste**: la dipendenza del trigger dai crawler aggiunge il
  crawler come dipendenza **di se stesso** (`self.__crawlers[crawler_name].add_dependency(
  target=self.__crawlers[crawler_name])`) invece di legare trigger→crawler.
- glue.py:146-166 — un solo ruolo `job_runner` condiviso da tutti i job e crawler dello stack.
- Tutto in Cfn* raw (L1) con ARN dei ruoli costruiti a mano via f-string (glue.py:184, 217).

### step_functions.py (271 righe) + lib/step_functions (~1.000 righe)
Factory dict-driven che reimplementa da zero il DSL che `aws_stepfunctions` di CDK offre già
nativamente: ~1.300 righe custom da mantenere, input `stack_info: Dict` senza alcuna validazione
(step_functions.py:48), timeout default come stringa `"60"` (step_functions.py:96), nodi creati
con scope = lo Stack invece del costrutto (step_functions.py:144-151), file vuoti
(`lib/step_functions/descriptor/catcher.py` e `retrier.py`, 0 righe). Candidato n.1 al "delete"
del redesign: il brief dice che ~90% degli stack non è usato.

### secrets.py (42 righe), roles.py (58), policies.py (113), acm.py (24), route53.py (142), wafv2.py (218), ecr.py (65), ssm_parameter_reader.py (46)
- secrets.py:42-43 — `get_values(key, to)` **ignora entrambi i parametri** e ritorna sempre
  `to_json()`: API mendace.
- roles.py / policies.py — wrapper 1:1 di `iam.Role`/`PolicyStatement` senza valore aggiunto;
  policies.py:59-92 contiene `add_generic_s3_policy(self, ...)` definita come **funzione
  module-level col parametro `self`**: orfana, mai utilizzabile correttamente, muta attributi
  del chiamante.
- acm.py:22 — TODO che ammette un possibile bug sugli id; `_id_certificate` calcolato e mai usato.
- route53.py:64, 100 — id CDK costruiti come `f"{hostname} -> {target}"` (spazi e frecce);
  emoji nei messaggi (route53.py:20 "🥺", :130 "🥸").
- wafv2.py — il file più sano: rate limit 500 + 5 managed rule AWS di default, associazione ad
  ARN esistenti. Difetti minori: mutable default `addresses: List[str] = []` (wafv2.py:24),
  priorità hardcoded, override permanente `SizeRestrictions_QUERYSTRING→allow` (wafv2.py:123-130),
  **niente WAF logging configuration**.
- ecr.py — sano: `image_scan_on_push=True` (ecr.py:42); però `RemovalPolicy.DESTROY` (ecr.py:40)
  e **nessuna lifecycle rule di default** (immagini accumulate per sempre = costo storage ECR;
  esiste `add_custom_lifecycle_rule` ma è opt-in).
- ssm_parameter_reader.py:33 — `PhysicalResourceId` con suffisso manuale `'v5'`: per rileggere
  il parametro bisogna bumpare a mano la stringa; policy `ANY_RESOURCE` (ssm_parameter_reader.py:39).

### Trasversali
- `__init__.py:1-19` — `from .x import *` quasi ovunque, esporta anche i costrutti "privati"
  `_LambdaFromDirectory` e `_LambdaAtEdge`.
- base_construct.py:18 + settings.py:154 — config singleton con `@lru_cache`: impossibile
  sintetizzare due environment nello stesso processo.
- Le "interfacce" (IVpc, IBucket, ISecret, ICertificate, …) non ereditano ABC: contratti finti.
- I default pericolosi NON restano teorici: `stacks/template_stack.py:53,104` rilancia
  `SubnetType.PUBLIC` come default per VPC/EC2/RDS, e tutte le repo `<cliente>-infra`
  (24 in locale) passano da lì (es. `nivi-infra/app.py:17-34`).

---

## Classifica dei difetti per il redesign

**Bloccanti di sicurezza (da quick-win):**
1. RDS pubblico by default — db.py:72 + networks.py:29 (verificato in prod su nivi).
2. `FrontendBucket` interamente pubblico senza OAC — buckets.py:124-139 + cloudfront.py:190-193.
3. SG EFS con SSH aperto al mondo — efs.py:61-65; utenti con password=username — constants.py.
4. `add_ingress_rule("ANY")`/`expose_ssh("ANY")` senza guardrail — db.py:199, ecs.py:353, cache.py:100.

**Bloccanti di affidabilità (cause dei down):**
5. `max_capacity=1` + managed scaling off — ecs.py:200-208.
6. ALB → ASG invece che → servizio ECS — ecs.py:688-698 (+ Bridge mode ecs.py:717).
7. Multi-AZ inesistente su RDS; nessun circuit breaker sui deploy ECS.

**Zero monitoring (problema #1 del brief):**
8. Nessun alarm in 3.970 righe; container insights off (ecs.py:105), PI off (db.py:78),
   log exports off (db.py:81), enhanced monitoring assente.

**Costi:**
9. 1 ALB per servizio (ecs.py:638); bucket log CloudFront illimitati (cloudfront.py:73);
   log retention Lambda infinita (lambdas.py); ECR senza lifecycle (ecr.py); Fargate task con
   IP pubblico (ecs.py:447).

**Bug veri e propri (codice rotto):**
10. `SubnetType.PRIVATE` inesistente → Lambda-in-VPC impossibile (lambdas.py:61,118);
    `**ec2ServiceProps` mai inoltrato (ecs.py:571→602); kwargs Fargate scartati (ecs.py:442-448);
    `subnet_selection` scheduled task ignorato (ecs.py:921); crawler dependency su se stesso
    (glue.py:275-278); `performance_insight_encryption_key` con tipo sbagliato (db.py:190);
    `get_values` che ignora i parametri (secrets.py:42); `user_data="None"` (launch_template.py:113).

La conclusione operativa per il redesign: dei 22 file, **solo wafv2, ecr, acm e (in parte) db
hanno default difendibili**; networks ed ecs vanno riprogettati da zero attorno a (a) VPC
public+private con scelta esplicita NAT/endpoints, (b) ALB condiviso che punta al *servizio* ECS
con target tracking, (c) alarm e Container/Performance Insights accesi by default con opt-out,
non opt-in.
