# 04 — Flusso di deploy attuale end-to-end

> Analisi del 2026-06-10 per il ridisegno infrastruttura (vedi `../BRIEF.md`).
> Fonti: repo locali in `~/LAIF/repo/` (laif-cli, laif-cdk, laif-deployer, laif-template,
> laif-factory, casartelli, andriani-sequencing, lamonea, nivi-infra e altre 20 repo `-infra`),
> wiki interna `laif-factory/wiki/`, comandi AWS read-only (profilo `production`).

## Executive summary

Oggi esistono **due flussi di deploy completamente separati**:

1. **Deploy del codice applicativo** (backend Docker + frontend statico): automatizzato con
   **GitHub Actions** per-repo, copiato dal fork di `laif-template`. Funziona, ma i workflow
   sono **duplicati e divergenti** in ogni repo e il backend si deploya sempre con il tag
   mutabile `:latest` + `ecs update-service --force-new-deployment`.
2. **Deploy dell'infrastruttura** (CDK): **100% manuale dal laptop**, dentro un container
   Docker da ~764 MB (`laif-deployer`) che impacchetta `laif-cli` + `laif-cdk` come submodule.
   **Nessuna delle 24 repo `-infra` locali ha una directory `.github/workflows`**: zero CI,
   zero audit trail, zero review sui deploy infra.

La creazione di una nuova app è una procedura documentata in **13 macro-fasi e ~30 passi
manuali**, con **2 deploy che falliscono "by design"**, **3 colli di bottiglia umani**
(approvazioni di Simone/Marco V./Marco P.) e **4 strumenti diversi** (GitHub UI, laptop,
container deployer, console AWS). Il nuovo CLI `laif` (laif-factory) reimplementa solo
3 dei ~30 passi.

---

## 1. I tre attori del tooling e come si incastrano

### 1.1 laif-cli (la CLI di deploy "storica")

- Repo: `~/LAIF/repo/laif-cli`, Python/Click + Poetry, versione **2.3.29** (`version.txt`, `pyproject.toml:3`).
- **Ultimo commit: 2025-10-16** (`b40e1be`) → di fatto congelata da ~8 mesi.
- Comandi (in `laif_cli/commands/`): `init` (gruppo: `scaffold`, `project`, `infra`,
  `data-transfer`), `deploy`, `apply`, `bootstrap`, `lcp`, `retrieve-credentials`, `wipeout`.
- `laif-cli deploy` è un **wrapper sottile su CDK**: legge `dev.yaml`/`prod.yaml`, filtra gli
  stack con `disabled: true` e lancia
  `cdk deploy --profile <profile> -c env=<ctx> <stack_ids>` via `subprocess`
  (`laif_cli/commands/deploy.py:96-104`). A fine deploy **stampa a video** i record DNS e il
  `DISTRIBUTION_ID` che l'operatore deve copiare a mano altrove (deploy.py:184-243).
- Debito documentale: il README parla ancora di **Bitbucket** ("deploy your builds to your
  AWS account" da "Bitbucket pipelines", README.md:101-121; `DEVELOPMENT.md:203-209` descrive
  una pipeline Bitbucket che non esiste più). Gli script `ci-cd/*.sh` (build/tests/release-dev/
  release-prod) sono **gusci quasi vuoti** ereditati da quell'era: `tests.sh` fa solo
  `pip install . && laif-cli`.

### 1.2 laif-cdk (la libreria di stack)

- Repo: `~/LAIF/repo/laif-cdk`, versione **1.40** (`version.txt`), ultimo commit 2026-06-10.
- 96 file Python, **~10.900 righe**: 13 stack (`laif_cdk/stacks/`) + 23 moduli constructs.
- È anche un **template cookiecutter**: la directory `{{ cookiecutter.root_folder }}/` genera
  la repo `<cliente>-infra` (app.py, cdk.json, dev.yaml, prod.yaml, requirements.txt).
- Uso reale: nei 24 `app.py` delle repo `-infra` locali si importano **solo 4 stack**
  (`TemplateStack`, `WAFStack`, `ETLStack`, `AutoTurnOff`; 22 repo su 24 importano
  esattamente questa quadrupletta). **8 stack su 13 mai importati**: `k8scluster`,
  `queue_stack`, `remote_stack`, `route53_stack`, `step_functions_stack`,
  `basic_networking_stack`, `backendwithworkers`, `webstackwithworkers` — conferma empirica
  del problema #5 del brief (codice in gran parte morto).

### 1.3 laif-deployer (l'ambiente di deploy in Docker)

- Repo: `~/LAIF/repo/laif-deployer`. È solo un **Dockerfile + 2 submodule git**
  (`laif-cli`, `laif-cdk` — `.gitmodules`).
- Dockerfile (29 righe): base `nikolaik/python-nodejs:python3.13-nodejs22-slim`, installa
  gh CLI, `pip install -r requirements.txt` (boto3, cookiecutter 2.1.1, yawsso…), poi
  `pip install ./laif-cli/ ./laif-cdk/` dai submodule (Dockerfile:21-23),
  `npm install -g aws-cdk@^2.254` e AWS CLI v2.
- Immagine pubblicata su **ECR account Production**:
  `654654481895.dkr.ecr.eu-west-1.amazonaws.com/laif/laif-deployer`.
  Evidenza AWS (`aws ecr describe-images --profile production`): `latest` = **v0.62.1**,
  push del **2026-05-22**, **~764 MB**.
- Uso prescritto (wiki `laif-deployer-release.md`): l'operatore monta `~/.aws`, `~/.ssh` e la
  repo corrente nel container e ci lavora dentro:

  ```bash
  docker run --rm -ti --platform linux/amd64 \
      -v $HOME/.aws/:/root/.aws -v $HOME/.ssh/:/root/.ssh \
      -v $PWD:/customer -w /customer \
      654654481895.dkr.ecr.eu-west-1.amazonaws.com/laif/laif-deployer:latest
  ```

  Nota: `--platform linux/amd64` → sui Mac ARM gira **emulato**.

### 1.4 Pipeline di rilascio del tooling stesso

Catena a 3 repo (tutte GitHub Actions):

1. Push su `master` di laif-cli o laif-cdk → `.github/workflows/trigger.yaml` (identico nelle
   due repo) fa una `curl POST` al dispatch di `laif-deployer/deploy.yaml` passando
   `submodule=laif-cli|laif-cdk`.
2. `laif-deployer/deploy.yaml`: job `autocommit` aggiorna il submodule a master e committa su
   `laif-deployer/master`; job `deploy` builda l'immagine e la pusha con tag **`latest-dev`**.
3. Il rilascio **stabile è manuale**: `git tag vX.Y.Z && git push --tags` su laif-deployer →
   la stessa action pusha l'immagine con tag versione + `latest`
   (wiki `development/standard/devops/laif-deployer-release.md`).

### 1.5 Versioning: 4 numeri scollegati e dipendenze non pinnate

| Componente | Versione | Meccanismo |
|---|---|---|
| laif-cli | 2.3.29 | `version.txt` manuale (submodule nel deployer: `v2.3.29-39-gb40e1be` → 39 commit dopo il tag) |
| laif-cdk | 1.40 | `version.txt` manuale (submodule pinnato a `v1.40-52-gfd0c8bf` → 52 commit dopo il tag, e 3 commit indietro rispetto a master locale) |
| laif-deployer | v0.62.1 | git tag manuale → tag immagine ECR |
| App cliente | es. 5.8.x | `version.txt` + bump automatico nel workflow dev |

Punto critico: le repo `-infra` installano laif-cdk con
`git+ssh://git@github.com/laif-group/laif-cdk.git` **senza alcun pin di versione**
(`casartelli-infra/requirements.txt`, idem andriani/lamonea/nivi-infra e il cookiecutter
stesso). Esistono quindi **due percorsi di installazione divergenti**: il deployer congela il
submodule alla data di build dell'immagine, mentre un venv locale prende il master del momento.
`casartelli-infra/cdk.json` usa `".venv/bin/python3 app.py"` (il cookiecutter genera
`"python3 app.py"`) → conferma che i deploy avvengono in pratica **sia da venv locale sia dal
deployer**, con versioni di laif-cdk potenzialmente diverse per lo stesso stack.

---

## 2. Deploy del codice applicativo (GitHub Actions)

Ogni repo app (fork di `laif-template`) ha 5 workflow:
`backend-tests.yaml`, `frontend-tests.yaml`, `build-and-deploy.dev.yml`,
`build-and-deploy.prod.yml`, `branch-test.yaml` (verificato in casartelli, lamonea,
andriani-sequencing, laif-template; andriani ha in più `build-and-deploy-etl.dev.yml`).

### 2.1 DEV (manuale, con versioning)

Trigger: `workflow_dispatch` con input `versionBump` (patch/minor/major). 6 job
(`casartelli/.github/workflows/build-and-deploy.dev.yml`):

1. `version-bump` — bump semantico di `version.txt` via `utilities/update_version.sh`
2. `backend-build` — **runs-on: [ARM_Runner]** (runner self-hosted ARM64), build Docker
   `linux/arm64` del `./backend` e push su ECR **con tag `:latest`** (cache `type=gha`)
3. `frontend-build` — `npm ci && npm run build` (Next.js export statico), upload artifact
4. `deploy-backend` — `aws ecs update-service --force-new-deployment` + invalidazione
   CloudFront `/*`
5. `deploy-frontend` — `aws s3 sync ./frontend/build/ s3://$FRONTEND_BUCKET/ --delete`
6. `deploy-parameters` — `utilities/store_parameters.py` aggiorna Parameter Store
   (`/{env}/{app}/version`, `laif_template_version`, `tms_last_release` — letti da Wolico/LCP)
7. `version-commit` — commit + tag `vX.Y.Z` + push su `develop` (richiede secret `GH_TOKEN`)

### 2.2 PROD (automatico su master)

`build-and-deploy.prod.yml` = stesso file **senza** version-bump/version-commit, trigger
`push: branches ["master"]`. Il rilascio prod = **merge PR develop→master**.

### 2.3 Attriti strutturali

- **Duplicazione dichiarata**: in testa al workflow dev (righe 3-13) il commento ammette che
  dev e prod sono due file quasi identici perché "reusable workflows do not support
  environments (WTF)... ¯\\_(ツ)_/¯". Ogni fix va replicato 2×N repo.
- **Drift tra repo**: `diff` tra laif-template e andriani-sequencing = **149 righe**; lamonea
  usa actions `@v4` dove il template è a `@v6`. I workflow vengono copiati al fork e **mai più
  riallineati**.
- **Tag `:latest` mutabile**: niente immagini immutabili per release → impossibile rollback
  puntuale dell'immagine; il "rollback" è solo l'health-check ECS che tiene i vecchi task.
- **`ARM_Runner` self-hosted = single point of failure**: tutti i `backend-build` di tutte le
  repo dipendono da quel runner (troubleshooting in wiki: "Verificare che il runner
  self-hosted sia online").
- Le credenziali AWS nei workflow sono **chiavi statiche IAM** (vars/secrets per environment,
  create da `init project`), non OIDC.
- `DISTRIBUTION_ID` va inserito **a mano** nelle GitHub variables dopo il primo deploy infra
  (output stampato da laif-cli, `deploy.py:218-221`).

### 2.4 ETL

Dove serve (es. andriani-sequencing) esiste un workflow gemello
`build-and-deploy-etl.dev.yml`: builda la **stessa** immagine backend con `FLG_ETL=1` e tag
`dev/<app>/etl:latest`. Altro file copiato a mano, trigger manuale — coerente col problema #4
del brief (nessuna soluzione uniforme per i task).

---

## 3. Deploy dell'infrastruttura (manuale, dal laptop)

- **Nessuna repo `-infra` ha CI**: 0 su 24 hanno `.github/workflows` (verificato su
  casartelli/andriani/lamonea/nivi-infra + `ls` su tutte).
- Flusso reale di una modifica infra:
  1. editare `app.py` / `dev.yaml` nella repo `-infra`;
  2. `aws sso login --profile <cliente>-{dev,prod}` (+ `production` per pull immagine);
  3. (opzionale ma prescritto) `docker pull .../laif-deployer:latest` + `docker run` con 4 mount;
  4. `laif-cli deploy -f dev.yaml <stack>|--all` → conferma interattiva → `cdk deploy`;
  5. ripetere per prod.
- Conseguenze: il deploy infra dipende **dal laptop e dalle credenziali SSO Administrator
  della persona**; nessuna PR/review obbligatoria, nessun log centralizzato, nessuna garanzia
  che ciò che è in git sia ciò che è deployato (configurazioni `cdk.context.json` e `cdk.out/`
  committate localmente nelle repo).

---

## 4. Creazione di una nuova app oggi: quantificazione

Fonte: `laif-factory/wiki/development/standard/devops/new-app-setup.md` (303 righe, 13
sezioni) — la guida ufficiale, sincronizzata da Notion.

| # | Fase | Dove | Passi manuali |
|---|---|---|---|
| 1 | Fork `laif-template` + clone | GitHub UI + laptop | 3 |
| 2 | SSO config, `values.yaml`, pull deployer, `laif-cli init scaffold` + `gh auth login` + `laif-cli init project` | laptop + container | 8 |
| 3 | Repo infra: `cookiecutter git@...laif-cdk.git` (16 domande interattive), creazione repo GitHub, git init/push; su Mac commentare `UseKeychain` in `~/.ssh/config` | container + GitHub UI | 7 |
| 4 | `laif-cli init infra -f dev.yaml` + `prod.yaml`; appuntarsi ARN certificati e record DNS | container | 4 |
| 5 | Deploy infra senza servizi (`deploy_services: false`), 2 ambienti; copiare `DISTRIBUTION_ID` nelle GitHub vars; **chiedere GH_TOKEN a Simone/Marco V/Marco P** | container + GitHub UI + umano | 5 |
| 6 | 4 record DNS a mano in `laif-dns/prod.yaml`, PR, **approvazione di Simone/Marco V/Marco P**, attesa pipeline | repo laif-dns + umano | 4 |
| 7 | Primo deploy app DEV via Action — **"Il primo deploy fallirà nello step deploy-backend. È normale"** (riga 245) | GitHub UI | 2 |
| 8 | `certificate_arn` + `deploy_services: true` in dev.yaml, `laif-cli deploy -f dev.yaml --all` | container | 2 |
| 9 | **Re-run failed jobs** del deploy DEV fallito | GitHub UI | 1 |
| 10 | PR develop→master → primo deploy PROD — **fallisce di nuovo by design** (riga 267) | GitHub UI | 2 |
| 11 | Come 8 ma su prod.yaml | container | 2 |
| 12 | **Re-run failed jobs** del deploy PROD | GitHub UI | 1 |
| 13 | Utente IAM `troisi-<cliente>` creato **in console** sull'account Production + copia chiavi nei Parameter Store dev e prod | console AWS | 6 |

**Totale: ~37 passi manuali, ≥25 comandi, 4 contesti operativi, 3 attese di approvazione
umana, 2 deploy falliti previsti dalla procedura, 2 re-run manuali.** Ordine di grandezza:
mezza/una giornata di lavoro effettivo, più le latenze (approvazioni, pipeline DNS,
validazione certificati ACM). La sequenza infra è inoltre **doppia per ambiente** (deploy
senza servizi → deploy app → deploy con servizi), perché il `TemplateStack` non può creare il
service ECS finché ECR/S3 non sono popolati dalla pipeline (dipendenza circolare
infra↔pipeline esplicitata nell'help di `laif-cli deploy`, deploy.py:252-255).

### 4.1 Cosa copre oggi `laif init` (laif-factory)

`laif-factory` (CLI `laif`, entry point `laif.cli.main:cli`) reimplementa il gruppo init in
`src/laif/cli/init/` (675 righe totali):

- `laif init scaffold` (scaffold.py): sostituzione token `${{ var }}` nei file
  `*.laif-template.*` — equivalente moderno (con `--dry-run`/`--json`) dello scaffold di
  laif-cli, ma **non** fa la pulizia branch/tag/README che fa laif-cli.
- `laif init project` (project.py): crea IAM user `deploy-<app>` con policy inline
  (`ecr:*`, `ecs:*`, `s3:*`, ...), poi via `gh` crea l'environment GitHub e setta **10
  variables + 2 secrets** (project.py:23-35, 256-275). Nota: laif-cli creava invece l'utente
  `<env>-<app>-github-technical-user` (laif-cli project.py:249) → **i due strumenti generano
  utenti IAM con naming diverso**.
- `laif init infra` (infra.py): `cdk bootstrap` (solo con flag `--bootstrap`) + registrazione
  su Wolico (`POST /applications/update-from-infra`). **Non richiede i certificati ACM e non
  stampa i record DNS**, a differenza di `laif-cli init infra` — il docstring lo promette ma
  il codice non lo fa (infra.py:40-44 vs corpo della funzione).
- `laif deploy` (deploy.py): wrapper `cdk deploy` + sync CORS del bucket frontend.

**Restano fuori da `laif init`**: fork del template, cookiecutter della repo infra (16
prompt), creazione repo GitHub, richiesta/validazione certificati, record DNS in laif-dns,
`DISTRIBUTION_ID`, `GH_TOKEN`, doppio-deploy con re-run, utente Troisi. In pratica **automatizza
~3 dei ~37 passi** e introduce una seconda implementazione parallela degli stessi comandi
(drift già visibile su init infra e naming IAM).

---

## 5. Sintesi dei punti di attrito (per il redesign)

1. **Infra deploy senza CI**: 24/24 repo `-infra` senza workflow → laptop + SSO admin +
   container da 764 MB emulato amd64 sui Mac ARM. Primo candidato a pipeline (o a
   eliminazione del deployer, come da obiettivo del brief).
2. **Catena di rilascio tooling a 3 repo** (trigger → autocommit submodule → build immagine,
   tag manuale per `latest`): fragile e opaca; 4 schemi di versione scollegati; laif-cdk
   installato **non pinnato** da git nelle repo infra.
3. **Workflow GitHub duplicati 2×N** e in drift (149 righe di diff template↔andriani);
   nessun meccanismo di aggiornamento dei fork.
4. **Deploy backend con `:latest` mutabile** + `--force-new-deployment`: nessuna tracciabilità
   immagine↔versione, rollback solo implicito.
5. **`ARM_Runner` self-hosted unico** per tutte le build backend della flotta.
6. **Onboarding nuova app: ~37 passi**, 3 approvazioni umane, 2 fallimenti pianificati,
   dipendenza circolare infra↔pipeline che impone il triplo passaggio per ambiente.
7. **Tre generazioni di tooling convivono**: laif-cli (congelata, README ancora Bitbucket),
   laif-deployer (immagine monolitica), laif-factory (`laif`, parziale) — con comportamenti
   non identici sugli stessi comandi (`init infra`, naming utenti IAM).
8. **laif-cdk usato al ~30%**: 4 stack su 13 importati nelle repo infra; 8 stack mai usati
   negli `app.py` della flotta — conferma il "da buttare e rifare" del brief.
