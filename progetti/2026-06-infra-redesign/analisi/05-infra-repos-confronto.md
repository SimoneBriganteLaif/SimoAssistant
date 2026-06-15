# 05 — Confronto sistematico delle repo infra cliente

Analisi del 2026-06-10 su `/Users/simonebrigante/LAIF/repo`. Obiettivo: misurare quanto le repo
`<cliente>-infra` sono identiche tra loro, quali parametri cambiano davvero, quali stack istanziano,
dove c'è drift dal template — per decidere cosa deve essere configurabile per-cliente nella nuova
libreria e cosa può diventare convenzione fissa.

## 1. Inventario

`ls /Users/simonebrigante/LAIF/repo | grep -- -infra` → **24 repo**:

advaisor, albini-castelli, algecar, andriani, benozzi, blq, bonfiglioli-consulting, bulgarelli,
cae, casartelli, coci, crif, experior, ferrari-rolo-plast, fortlan-dibi, gmm, jubatus, laif,
lamonea, nivi, people, prima-power, sabart, voltan (tutte `-infra`).

23 sono clienti; `laif-infra` è interna (ospita anche lo stack Wolico in dev).
Repo analizzate in dettaglio (file per file): **casartelli, bonfiglioli-consulting, nivi, andriani,
crif, lamonea, jubatus, voltan, blq, gmm** (10), più verifiche puntuali su tutte le altre 14.

### Origine: cookiecutter dentro laif-cdk
Le repo nascono da un template **cookiecutter incluso nella repo laif-cdk stessa**
(`laif-cdk/cookiecutter.json` + `laif-cdk/{{ cookiecutter.root_folder }}/`), scaffoldato da
`laif init` (`laif-factory/src/laif/cli/init/infra.py`). Il `cookiecutter.json` dichiara
`"laif_cdk_version": "1.40"` ma — vedi §4 — la versione non viene mai pinnata davvero.
Struttura generata (12 file): `app.py`, `dev.yaml`, `prod.yaml`, `cdk.json`, `requirements.txt`,
`requirements-dev.txt` (`pytest==6.2.5`), `README.md` (35 byte), `.gitignore`,
`cdk/__init__.py` (vuoto), `packages/.gitkeep`, `tests/`.

**Le cartelle `cdk/` e `packages/` sono vuote in tutte le 24 repo**: struttura morta ereditata dal
template, mai usata. Tutto il codice sta in un singolo `app.py` in root.

## 2. Quanto sono identiche: misura della duplicazione

### app.py — cluster md5 (`md5 -q *-infra/app.py`)
| Cluster | Repo | Note |
|---|---|---|
| **md5 `27b28c70…` — 10 repo byte-identiche** | algecar, blq, bonfiglioli-consulting, bulgarelli, cae, casartelli, fortlan-dibi, nivi, people, sabart | il "canone": 76 righe, zero personalizzazioni |
| md5 `466f43d6…` — 2 repo identiche tra loro | albini-castelli, lamonea | come il canone meno 2 righe (niente `rds_major_version`/`rds_full_version`) |
| 12 varianti uniche | le altre 12 | drift da 4 a 113 righe |

### Drift di app.py rispetto al canone (righe di `diff`, su 76 righe base)
| Repo | Righe app.py | Righe diverse | Natura del drift |
|---|---|---|---|
| 10 repo del cluster canone | 76 | **0** | nessuna |
| albini-castelli, lamonea | 74 | 2 | senza versioni RDS esplicite |
| voltan | 78 | 4 | + `backend_cluster_instance_type` (t4g.medium) e `rds_instance_type` (t4g.small) da YAML |
| gmm | 81 | 12 | ETL su EC2 `t4g.xlarge` hardcoded, cron `0 1 * * ? *`, FIXME/TODO in coda al file |
| ferrari-rolo-plast | 95 | 27 | ETL EC2 `t4g.xlarge` + `eip=True` + policy IAM `ecs:RunTask` inline |
| experior | 86 | 32 | + `eip` da YAML; formattazione black |
| benozzi | 88 | 34 | + `eip`, `rds_instance_type`, `backend_cluster_instance_type` da YAML |
| advaisor | 88 | 36 | + `backend_cluster_instance_type`; import `Environment` |
| laif | 111 | 41 | **2° TemplateStack `wolico_stack`** (solo dev), taglia backend hardcoded `t4g.small` |
| prima-power | 119 | 51 | **2° TemplateStack `prima_pilot`** (dev+prod), ETL EC2 parametrico, scheduled task da YAML, task extra solo prod (`export_to_pst`) |
| crif | 106 | 52 | **2° TemplateStack `crif_stack`** solo se `env_prefix == "dev"` |
| andriani | 104 | 54 | ETL EC2 `c7g.4xlarge` da YAML + policy IAM (`ecs:RunTask`, `autoscaling:SetDesiredCapacity`…) sul task role |
| jubatus | 77 | 75 | **riscritto**: tutti i parametri via `.get()` con default, VPC/ALB esterni del cliente, `listener_port`, `rds_subnet_type PRIVATE_ISOLATED`, policy S3 sui bucket MyMemories |
| coci | 145 | 113 | **massimo drift**: non usa ETLStack ma i constructs direttamente (`BasicContainerRegistry`, `EcsEC2Cluster` "algo" con capacity provider `t4g.2xlarge` max 3, `rds_allocated_storage=46`, `eip=True`) |

**Sintesi duplicazione**: 13/24 repo (54%) hanno drift ≤4 righe; 10/24 (42%) sono *byte-identiche*.
Le restanti 11 divergono quasi solo per: (a) taglie macchina, (b) ETL attivato su EC2,
(c) secondo stack applicativo, (d) policy IAM inline, (e) EIP. Gran parte del drift è
**lo stesso identico blocco copia-incollato** (es. la policy `ecs:RunTask` appare uguale in
andriani, ferrari-rolo-plast e coci) o pura riformattazione black che inquina i diff.

### Gli altri file
- `cdk.json`: **22/24 byte-identici** (`"app": "python3 app.py"`); solo le 2 repo più recenti
  (casartelli, bonfiglioli-consulting) usano `".venv/bin/python3 app.py"`.
- `requirements-dev.txt`: `pytest==6.2.5` ovunque (e `tests/` è vuota ovunque: nessun test esiste).
- `README.md`: 35 byte placeholder ovunque (unica eccezione: jubatus, 940 byte).
- Storia git: repo quasi congelate dopo lo scaffold — mediana **5 commit** a repo (min 1: sabart;
  max 20: prima-power). Conferma: il lavoro vero avviene altrove, l'infra si tocca solo
  per emergenze o tuning taglie.

## 3. Gli YAML: cosa cambia davvero da cliente a cliente

Schema canonico (28 chiavi, es. `casartelli-infra/dev.yaml:1-44`): blocco identità
(`CUSTOMER_NAME`, `ACCOUNT_ID`, `PROFILE_NAME`, `REGION`) + 4 sezioni stack
(`default_stack`, `lambda_rds_turnoff`, `waf_stack`, `etl_stack`).

### Parametri che variano DAVVERO (su 48 file dev+prod)
| Parametro | Variabilità | Evidenza |
|---|---|---|
| `CUSTOMER_NAME`, `ACCOUNT_ID`, `PROFILE_NAME` | sempre (identità) | — |
| `default_stack.id`, `app_name`, `domain` | sempre, ma **derivabili**: pattern `{env}-{app}-stack` / `{app}[-dev].app.laifgroup.com` rispettato quasi ovunque | gmm rompe il pattern: stack `prod-bbm-digit-stack`, app `bbm-digital`, dominio `bbm-digit.app…` |
| `certificate_arn` | sempre (ARN ACM us-east-1 per account) | valore *incollato a mano* dopo `laif init`, causa del two-step `deploy_services: false→true` |
| `db_name` | varia, spesso `null` | commento dice "cannot be null!" ma è null in 8+ file |
| `rds_major/full_version` | **4 versioni in fleet**: 15.5 (×6 prod), 15.7 (×9), 17.6 (×5), 17.10 (×1) | frammentazione: nessuno aggiorna i minor |
| `auto_turnoff` | true in 6 prod (crif, experior, sabart, bonfiglioli, people, lamonea) e in molti dev | unico "feature flag" davvero usato |
| `lambda_rds_turnoff.disabled` | false 20/24 prod, true 4 | |
| `etl_stack.disabled` | **false solo in 4 prod**: andriani, ferrari-rolo-plast, gmm, prima-power | |
| `rds_instance_type`, `backend_cluster_instance_type` | solo 5 repo le espongono (voltan, benozzi, advaisor, prima-power; coci hardcoded) | il resto va col default `t4g.micro`/`t4g.small` della libreria |
| `eip` | 3 repo (benozzi, experior; coci/ferrari hardcoded `True`) | |
| `rds_preferred_maintenance_window` | solo il giorno: `Sun` in dev, `Tue` in prod | convenzione di fatto, mai altro |
| risorse esterne (`vpc_id`, `existing_alb`, `listener_port`, `rds_subnet_type`) | **solo jubatus** (deploy su account del cliente) | `jubatus-infra/dev.yaml` |

### Parametri che NON cambiano MAI (costanti travestite da config)
- `REGION: eu-west-1` — 47/48 file (unica eccezione `jubatus-infra/dev.yaml`: eu-central-1, account del cliente).
- `waf_stack.disabled: true` — **24/24 prod e 24/24 dev**. Il WAFStack è nel codice di tutte le
  repo ma **non è deployato da nessuna**. `rate_limit: 550` identico 48/48, `region: us-east-1`
  identico, `waf_allowed_addresses: []` identico.
- `rds_preferred_backup_window: "22:35-23:05"` — identico 48/48.
- `lambda_rds_turnoff.id: lambda-rds-turnoff` — identico ovunque.
- I commenti `# CHANGE ME` sono rimasti in produzione in quasi tutti i file (es.
  `casartelli-infra/prod.yaml:14,41-42`, `blq-infra/prod.yaml:17`): il template chiede troppi
  ritocchi manuali e nessuno ripulisce.

### File satellite: data transfer
8 repo hanno YAML `data_tra[n]sfer_{dev,prod}.yaml` (nivi, andriani, voltan ×2, gmm, benozzi,
experior, bulgarelli, prima-power) — **5 con il typo "trasfer"** propagato per copia-incolla.
Non li consuma `app.py` ma `laif_cli init data-transfer`
(`laif-cli/laif_cli/commands/init/commands/data_transfer.py`): tutti puntano all'account condiviso
`490004644050`, profilo `data-transfer`, e definiscono solo `username` + `destination_bucket_name`.
Altra micro-configurazione che potrebbe essere 2 campi nella config principale.

## 4. requirements.txt: NESSUN pinning di versione

Tutte le 24 repo hanno requirements.txt di **una riga**, e nessuna pinna versione/tag/commit:
- 12 repo → `git+ssh://git@github.com/laif-group/laif-cdk.git`
- 11 repo → `git+ssh://git@bitbucket.org/laifgroup/laif-cdk` (remote vecchio, pre-migrazione GitHub)
- 1 repo (**benozzi**) → `git+ssh://git@github.org/laif-group/laif-cdk` — **URL rotto**
  (`github.org` non esiste): un `pip install -r` lì fallisce oggi.

laif-cdk ha i tag `v1.31…v1.40` e `version.txt = 1.40`, ma **0/24 repo li usano**: ogni
`pip install` prende l'HEAD del default branch del momento → build non riproducibili, e un
cambiamento in laif-cdk può cambiare silenziosamente l'infra di tutti al deploy successivo.
Le 11 repo su bitbucket inoltre installano una libreria **congelata alla versione della
migrazione** (o rotta, se il remote bitbucket è stato spento).

## 5. Stack istanziati: 4 su 14

`laif-cdk/laif_cdk/stacks/` contiene 14 moduli stack. Le repo infra ne usano **4**:

| Stack | Nel codice | Effettivamente deployato |
|---|---|---|
| `TemplateStack` | 24/24 | 24/24 (è "lo stack") — **monolite da 66 parametri** (`template_stack.py:45-109`): VPC+S3+RDS+ECR+ECS+ALB+CloudFront+WAF insieme |
| `WAFStack` | 24/24 | **0/24** (disabled ovunque) |
| `AutoTurnOff` (lambda spegni-RDS/ECS) | 24/24 | 20/24 prod |
| `ETLStack` | 22/24 | **4/24 prod** (andriani, ferrari-rolo-plast, gmm, prima-power) |

Mai referenziati da nessuna repo: `backendwithworkers`, `base_stack`, `basic_networking_stack`,
`k8scluster`, `queue_stack`, `remote_stack`, `route53_stack`, `step_functions_stack`,
`webstackwithworkers` (+ il modulo `constructs` usato direttamente solo da coci). Conferma
empirica della stima del brief: **~70% dei moduli stack è codice morto** per la flotta, e dei 66
parametri di TemplateStack i YAML ne espongono ~12.

## 6. Multi-app per account (1 repo infra → 2+ app)

3 casi reali, tutti risolti con **copia-incolla del blocco YAML con prefisso arbitrario** + blocco
`TemplateStack` duplicato in app.py:
1. **crif**: `default_stack` (analyzer) + `crif_stack` solo in dev (`crif-infra/app.py:37-58`,
   guard `if env_prefix == "dev"`), con `rds_identifier: "2"` per il secondo RDS.
2. **prima-power**: `default_stack` + `prima_pilot_default_stack` in dev *e* prod, con seconda
   lambda turnoff `prima_pilot_lambda_rds_turnoff`.
3. **laif-infra**: stack template + `wolico_stack` solo dev (`laif-infra/app.py:81-97`) +
   `wolico_turnoff`.

Funziona, ma ogni nome di sezione è inventato ad-hoc e `app.py` deve conoscerlo: il caso
"2 app sullo stesso account" oggi costa ~30 righe duplicate di app.py + ~25 di YAML per app.

## 7. Conclusioni per la nuova libreria

### Deve essere configurabile per-cliente
1. **Identità** (1 volta per ambiente): customer, account_id, profilo SSO. Niente altro nel blocco.
2. **Lista di app** come cittadino di prima classe (`apps: [...]` invece di sezioni con prefissi
   ad-hoc): per ogni app → `app_name`, dominio (con default derivato), db (nome, major version,
   instance class, storage), taglie (`backend_instance_type`, eventualmente count/range
   autoscaling), feature flag booleani: `autoscaling`, `auto_turnoff`, `eip`, `monitoring`.
3. **Jobs/ETL dichiarativi**: lista di task (cron, command, size fargate/ec2, instance type) —
   oggi sono il primo motivo di fork di app.py (gmm, andriani, ferrari-rolo-plast, prima-power,
   coci: 5 varianti dello stesso bisogno).
4. **Risorse esterne opzionali** (`vpc_id`, `existing_alb`, `listener_port`) — servono solo nel
   caso "deploy su account del cliente" (jubatus), ma è un caso reale da supportare.
5. **Policy IAM aggiuntive in forma dichiarativa** (es. `extra_bucket_access: [...]`): oggi sono
   blocchi `iam.PolicyStatement` copia-incollati in 5 app.py.

### Può (deve) diventare convenzione fissa
- **Naming derivato**: stack id = `{env}-{app}-stack`, dominio = `{app}[-dev].app.laifgroup.com`,
  bucket = `{env}-{app}-data-bucket`. Oggi sono campi liberi con `# CHANGE ME`, e dove qualcuno ha
  improvvisato (gmm: `bbm-digit` vs `bbm-digital`) il pattern si è rotto.
- **Region** eu-west-1 (certificati us-east-1), override possibile ma non richiesto nel 98% dei file.
- **Finestre backup/maintenance** (oggi letteralmente identiche in 48/48 file): via dai YAML.
- **Certificato ACM**: lookup/creazione automatica invece dell'ARN incollato a mano — elimina anche
  il two-step `deploy_services: false → true`.
- **RDS in subnet privata di default** (oggi è opt-in `rds_subnet_type`, usato solo da jubatus —
  coerente col problema sicurezza n.6 del brief).
- **Pinning obbligatorio** della libreria a tag/release nel file generato (oggi 0/24 pinnano,
  3 URL remoti diversi di cui 1 rotto) — o, meglio, pubblicazione su registry privato.
- **Eliminare dal template**: WAFStack separato cross-region (0 deploy in 2 anni — se serve un
  rate-limit, integrarlo come flag del modulo frontend), cartelle vuote `cdk/`/`packages/`/`tests/`,
  `requirements-dev.txt` con pytest mai usato, le sezioni YAML `waf_stack`/`etl_stack` boilerplate
  quando disabled (devono semplicemente non esserci).
- **Formattazione imposta** (black/ruff nel template): metà del diff tra repo oggi è rumore di
  formattazione che maschera il drift reale.

### Implicazione di processo
Con naming derivato + lista app + jobs dichiarativi, **l'intero contenuto utile di una repo infra
si riduce a ~15 righe di YAML per ambiente** (identità + lista app + flag), e `app.py` diventa
identico per tutti (o sparisce, generato dalla libreria). A quel punto la scelta
"repo infra separata vs infra nella repo di progetto" diventa secondaria: il file è così piccolo
che può vivere ovunque; il vincolo "1 account, 2 app" (crif, prima-power, laif) si risolve con
2 elementi nella lista `apps` dello stesso file.
