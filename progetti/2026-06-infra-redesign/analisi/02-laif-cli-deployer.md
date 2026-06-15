# 02 — laif-cli e laif-deployer: il tooling da eliminare (mappa di sostituzione)

> Analisi del 2026-06-11 per il ridisegno infrastruttura (vedi `../BRIEF.md`).
> Chiude il gap lasciato dalla numerazione (`04-deploy-flow` copre il *flusso*; qui si guarda
> **dentro** il tooling, comando per comando, per capire **cosa si perde e dove rifinisce ogni
> responsabilità** quando — come da brief — si eliminano `laif-cli` e `laif-deployer`).
> Fonti: `~/LAIF/repo/laif-cli` (v2.3.29, ultimo commit 2025-10-16, ~4.762 righe Python),
> `~/LAIF/repo/laif-deployer`. Tutti i `file:riga` sono relativi a `laif-cli/laif_cli/`.

---

## 0. TL;DR per il redesign

`laif-cli` non è "una CLI di deploy": è un **mucchio di operazioni AWS imperative** (705 righe di
boto3 in `commons/aws.py`) che **bypassano CDK/CloudFormation** — crea utenti IAM, policy,
certificati ACM, secret, key-pair EC2 a mano. Il `deploy` vero e proprio è invece un wrapper di
**~15 righe utili** attorno a `cdk deploy`. Questo spiega due cose del brief:

1. **Perché serve `wipeout`** (212 righe di teardown manuale): metà delle risorse di un'app
   **non sono CDK-owned** (l'utente IAM lo crea `init project`, il bucket di build e l'ECR li crea
   la pipeline), quindi `cdk destroy` non basta e serve uno script che le cancelli a mano.
2. **Dove sta il "drift"**: ogni risorsa creata da `commons/aws.py` è fuori dallo stato
   CloudFormation → ciò che è in git non è ciò che è deployato.

**Scoperta rilevante per il monitoring (problema #1 del brief):** il gruppo `lcp` **è già un
sistema di monitoraggio** — registra gli host su **Checkmk** (via "Laif Control Panel") con
health-check, gruppi di contatto e *scheduled downtime*. Quindi non è vero che il monitoraggio non
esista: esiste un **ping up/down esterno via Checkmk**, applicato a mano host per host, **senza**
metriche di risorsa (CPU/RAM/disco/DB). Il redesign del monitoring deve **riconciliarsi** con LCP,
non ignorarlo (decidere: tenere Checkmk per l'up/down + aggiungere CloudWatch per le risorse, oppure
sostituire tutto).

**Conclusione:** eliminare `laif-cli`/`laif-deployer` è fattibile e sano, ma **non è "cancella e
via"**. 8 responsabilità vanno ricollocate (tabella §6). Le uniche con valore residuo non banale
sono: (a) la registrazione monitoring **LCP/Checkmk**, (b) la **stampa guidata dei record DNS/cert**
post-deploy, (c) la **richiesta+validazione certificati ACM**. Tutto il resto è o sostituibile con
1 comando nativo o eliminabile rendendo le risorse CDK-owned.

---

## 1. Inventario comandi `laif-cli` (cosa fa ciascuno *dentro*)

CLI Click con sistema a plugin (`app.py` → `plugins/discover.py`). Comandi registrati:

| Comando | Righe | Cosa fa davvero | Giudizio |
|---|---|---|---|
| `deploy` | 271 | Legge `dev/prod.yaml`, filtra stack con `disabled:true`, lancia `cdk deploy --profile P -c env=ctx <ids>` via subprocess (`deploy.py:87-106`). Post-deploy: stampa record DNS, validazione cert e `DISTRIBUTION_ID` da copiare a mano (`deploy.py:147-241`). | Wrapper sottile. **15 righe utili**, il resto è la *glue DNS/cert* (che ha valore). |
| `apply` | 109 | Sostituzione token `${{ token }}` nei file `*.template.*` a partire da `values.yaml` (appiattisce anche il 2° livello YAML: `dev_aws_account_id`). | Scaffolding. **Duplicato** da `laif init scaffold` (laif-factory). |
| `bootstrap` | 30 | `pip install -r requirements.txt`. | Inutile. Da cancellare. |
| `wipeout` | 212 | Teardown imperativo: cancella utente+policy IAM `<env>-<app>-github-technical-user`, bucket `<env>-<app>-fe-build`, ECR `<env>/<app>/backend`, opz. RDS (con doppia conferma). | Esiste **solo perché quelle risorse non sono CDK-owned**. Sparisce se tutto passa da CDK. |
| `retrieve-credentials` | 43 | Legge `admin_email`/`admin_password` da SSM Parameter Store. | Sostituibile da 1 `aws ssm get-parameter`. |
| `init scaffold` | 179 | Pulizia repo forkata + sostituzione token. | Migrato (parz.) in `laif init scaffold`. |
| `init project` | 434 | Crea utente IAM `deploy`/technical-user con policy inline (`ecr:* ecs:* s3:* ...`), access key, setta GitHub env vars/secrets. | **Imperativo**: dovrebbe essere CDK (IAM user/role) o OIDC. Migrato parz. in `laif init project` (con naming IAM diverso → drift, vedi `04`). |
| `init infra` | 203 | `cdk bootstrap`, richiesta certificati ACM, stampa record DNS validazione. | La parte cert/DNS ha valore; il resto è CDK nativo. |
| `init data-transfer` | 384 | Genera config per trasferimento dati tra account/ambienti. | Caso d'uso di nicchia; valutare a parte. |
| `lcp register` / `lcp delete` | 310+86 | **Monitoraggio Checkmk** (vedi §3). | **Unica vera feature di osservabilità esistente.** Da riconciliare, non buttare a caso. |

Versione **2.3.29**, congelata da ~8 mesi; README cita ancora **Bitbucket pipelines** (debito
documentale). Python `^3.8`, Poetry.

---

## 2. `commons/aws.py` — il vero peso: 705 righe di AWS imperativo (anti-pattern)

Questo file è il cuore del problema architetturale. Espone ~50 funzioni boto3 che **mutano AWS
fuori da CloudFormation**:

- **IAM**: `create_user`, `delete_user`, `create_policy`, `create_or_update_policy_from_template`,
  `attach/detach_policy_*`, `create_role`, `delete_role`, `touch_access_key`, `delete_access_key`,
  `list_access_keys`.
- **ACM**: `request_certificate`, `describe_certificate`, `list_certificates`, `delete_certificate`.
- **Secrets/SSM**: `create_aws_secret`, `delete_aws_secret`, `get/put_parameter`, `get_parameter_value`.
- **EC2**: `create_aws_ec2_key_pair`, `delete_ec2_key_pair`.
- **S3/ECR/RDS**: `delete_bucket`, `set/get_bucket_policy`, `delete_repository`, `delete_db_instance`.
- **CloudFront**: `get_distribution_id`, `get_resource_arn_from_tag`, `get_cloudfront_distribution`.
- **Utility**: `guess_profile(account_id)` (mappa account→profilo locale), `get_cdk_qualifier`.

> **Implicazione per il redesign:** quasi tutto ciò che `commons/aws.py` crea (utenti IAM, policy,
> certificati, secret, key-pair) **dovrebbe essere dichiarato in CDK**. Spostandolo in CDK spariscono
> in un colpo: il bisogno di `wipeout`, il drift git↔AWS, e gran parte di `init project`/`init infra`.
> Restano fuori da CDK solo le operazioni intrinsecamente *read* (lookup DNS/CloudFront) e *cross-system*
> (Checkmk).

---

## 3. Il gruppo `lcp` = monitoraggio Checkmk già esistente (ma a mano)

`lcp` ("Laif Control Panel") è un **client REST verso un'istanza Checkmk** (`lcp/api.py`, 575 righe,
classe `Client.call(path, method)`). Funzioni significative:

- **Host**: `create_host`, `update_host`, `delete_host`, `retrieve_host(s)`.
- **Folder/cliente**: `create_folder`, `update_folder`, `delete_folder_if_empty` (organizza gli host
  per codice-cliente).
- **Contatti/alert**: `retrieve/create/delete_contact_group`, `update_users` (chi viene avvisato).
- **Downtime programmato**: `put_host_down` / `put_host_up` + flag `enabled:false` nel
  `health_dev.yaml`/`health_prod.yaml` → *silenzia gli alert durante un intervento*.
- **`activate_changes`**: commit delle modifiche su Checkmk.
- Credenziali/tag/apikey letti da **SSM** (`retrieve_credentials_aws`, `retrieve_apikey_aws`,
  `PARAM_BASEPATH_LCP`); la criticità del check cambia con l'ambiente (`-e dev|prod`).

Workflow d'uso (dall'help): `laif_cli lcp register -h demo.app.laifgroup.com -e dev -f health_dev.yaml`
→ registra l'host su Checkmk; il file `health_*.yaml` **vive nella repo infra**.

**Cosa significa davvero:** LAIF ha un monitoraggio **black-box up/down via Checkmk** (l'host risponde
all'health-check HTTP?), con alerting e downtime. Ciò che **manca** (e che il brief chiede) è il
monitoraggio **white-box**: CPU/RAM/disco delle macchine, metriche RDS, code, latenze, saturazione →
quello oggi **non c'è** perché Checkmk fa solo il ping esterno e nessuno guarda CloudWatch.

> **Decisione da prendere (Fase C):** (A) tenere Checkmk per l'up/down + aggiungere CloudWatch
> dashboard/alarm per le risorse; (B) migrare tutto su CloudWatch + SNS e dismettere LCP/Checkmk.
> Questa è la scelta con più impatto sul "perché le app vanno giù senza che ce ne accorgiamo".

---

## 4. Il sistema a plugin (feature nascosta)

`plugins/discover.py`: oltre ai comandi nativi, `laif-cli` **carica dinamicamente** comandi da
`./laif_cli/commands/` nella **directory corrente** (`load_project_commands`). Cioè una repo cliente
può estendere la CLI con comandi propri. Potente ma oscuro e quasi certamente inutilizzato →
nel redesign **non va riprodotto**: comandi per-progetto = script versionati nella repo, non magia
di import a runtime.

---

## 5. `laif-deployer` — esiste solo per dare un toolchain coerente

- `Dockerfile` (29 righe) + **2 git submodule** (`laif-cli`, `laif-cdk` — `.gitmodules`).
- Base `nikolaik/python-nodejs:python3.13-nodejs22-slim`, installa `gh`, AWS CLI v2,
  `aws-cdk@^2.254`, e `pip install ./laif-cli ./laif-cdk` dai submodule.
- Immagine ECR account Production `.../laif/laif-deployer:latest` (v0.62.1, ~764 MB, 2026-05-22).
- Uso: `docker run` montando `~/.aws`, `~/.ssh`, `$PWD` → si lavora *dentro* il container.
  La wiki impone `--platform linux/amd64` → **emulato sui Mac ARM** (lento).
- **I submodule non sono pinnati a una versione**: floattano → due deploy della stessa repo possono
  usare laif-cdk diversi (vedi `04` §1.5).

**Valore reale:** solo "garantire le stesse versioni di python/node/cdk/awscli a tutti". Lo stesso
risultato si ottiene con **runner GitHub Actions pinnati** + (in locale) `uv` con versioni dichiarate.
→ `laif-deployer` **eliminabile** senza perdita funzionale.

---

## 6. Mappa di sostituzione (la tabella che serve alla migrazione)

Eliminare `laif-cli` + `laif-deployer`, **tenere** `laif-dns`. Dove va ogni responsabilità:

| # | Responsabilità (oggi) | Dove sta oggi | Nuova casa proposta | Difficoltà |
|---|---|---|---|---|
| 1 | `cdk deploy` per ambiente, con filtro stack disabilitati | `deploy.py` | **GitHub Actions (OIDC)** che lancia `cdk deploy` diretto; il "disabled" diventa **config-driven** (lo stack non viene proprio sintetizzato) | Bassa |
| 2 | Stampa guidata record DNS + `DISTRIBUTION_ID` post-deploy | `deploy.py:147-241` | **`CfnOutput` + automazione DNS** via `laif-dns` (no copia-incolla a mano) | Media |
| 3 | Richiesta + validazione **certificati ACM** | `init infra` + `aws.py` | **CDK** (`Certificate` con DNS validation), con il twist del DNS cross-account `laif-dns` da gestire | Media |
| 4 | Token scaffolding `${{ }}` | `apply.py` / `init scaffold` | **`laif init scaffold`** (laif-factory) — già esiste | Nulla (già fatto) |
| 5 | Creazione **utente IAM + policy + access key** per la CI | `init project` + `aws.py` | **CDK** (IAM user/role) o meglio **OIDC GitHub→AWS** (zero chiavi statiche) | Media |
| 6 | **Teardown** risorse non-CDK (IAM/S3/ECR/RDS) | `wipeout.py` | **Sparisce**: se le risorse sono CDK-owned, basta `cdk destroy` (+ `RemovalPolicy`) | Bassa (a valle di #5) |
| 7 | Lettura credenziali admin da SSM | `retrieve-credentials.py` | 1× `aws ssm get-parameter` (o comando in `laif`) | Nulla |
| 8 | **Monitoraggio Checkmk** (host, alert, downtime) | `lcp/*` | **Da decidere (Fase C)**: riconciliare con CloudWatch. È l'unico pezzo con valore operativo continuo | Alta (decisione strategica) |
| 9 | `pip install -r requirements.txt` | `bootstrap.py` | `uv sync` / niente | Nulla |
| 10 | Toolchain coerente (py/node/cdk/awscli) | `laif-deployer` (Docker) | **Runner GH Actions pinnati** + `uv` in locale; laif-cdk **pinnato** | Bassa |

### Orfani / rischi da non dimenticare nel kill
- **#8 LCP/Checkmk** è l'unica cosa che, se cancellata senza rimpiazzo, **toglie monitoraggio** (per
  quanto parziale). Non spegnerla finché CloudWatch non copre almeno l'up/down.
- **#3 certificati**: la validazione DNS è cross-account (i record stanno in `laif-dns`); CDK
  `Certificate` con DNS validation automatica richiede che la zona Route53 sia raggiungibile →
  da progettare con cura (potrebbe restare semi-manuale all'inizio).
- **#5 → #6**: l'ordine conta. Prima si rendono le risorse CDK-owned (utente IAM/ECR/bucket), poi
  `wipeout` si può cancellare. Finché la pipeline crea ECR/bucket fuori CDK, serve ancora un teardown.

---

## 7. Cosa tenere come *idea* (non come codice)
- La **glue DNS/cert post-deploy** (capire quali record mancano confrontando `socket.gethostbyname`
  col CloudFront reale) è furba: va **automatizzata**, non ributtata su un operatore.
- Lo **scheduled downtime** del monitoring (silenzia gli alert durante un deploy) è una buona pratica
  da preservare in qualunque sistema scegliamo.
- Il **filtro stack disabilitati** è il seme della "infra modulare on/off" del brief: nel redesign
  diventa configurazione che decide *se lo stack/costruct viene creato*, non un flag a posteriori.
