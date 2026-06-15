# 06 — laif-factory e il flusso "nuovo cliente → app in prod"

> Analisi del 2026-06-10 per il ridisegno infrastruttura (vedi `../BRIEF.md`).
> Fonti: `~/LAIF/repo/laif-factory` (master + branch `feat/new-app-skill`), `~/LAIF/repo/laif-template`, `~/LAIF/repo/laif-dns`. Nessun comando AWS necessario per questa analisi.

---

## 1. Cos'è laif-factory

`laif-factory` è la "fabbrica" LAIF: **CLI `laif` (Python ≥3.12, Click, installata via `uv tool install .`) + agenti AI + skill operative + knowledge-base aziendale**, tutto in una repo (`README.md:9-10`). Componenti rilevanti per l'infra:

| Componente | Path | Note |
|---|---|---|
| CLI `laif` | `src/laif/cli/` | 55+ comandi (`TODO.md:5`). Bootstrap: `init scaffold`, `init project`, `init infra`, `init data-transfer`, `deploy` (`src/laif/cli/init/__init__.py:15-18`) |
| Knowledge-base | `wiki/` | **Attenzione: la KB si chiama `wiki/`, non più `knowledge-base/`**. Indicizzata FTS5/BM25: 2097 chunk / 108 doc in `.laif/search.db` (`CLAUDE.local.md:91`) |
| Skill operative | `skills/` | 48 skill; quella chiave per questa analisi è **`new-app`** (vive sul branch `feat/new-app-skill`, su master c'è solo lo scheletro vuoto `skills/new-app/scripts/lib/`) |
| Agenti | `agents/` | backend-developer, frontend-developer, code-reviewer, merlino, sherlock-holmes, steve-jobs, meta-updater |
| Copia di laif-dns | `laif-dns/` | dump da un branch di laif-scripts ("initial commit, dump from a laif-scripts branch") — duplicato della repo `~/LAIF/repo/laif-dns` |

Punto strategico: **il CLI `laif` di laif-factory sta già ri-implementando (porting) i comandi di `laif-cli`** — l'eliminazione di laif-cli/laif-deployer chiesta nel brief è di fatto già iniziata qui (vedi §4).

---

## 2. Il flusso oggi: "nuovo cliente → app in prod"

Fonte canonica: `wiki/development/standard/devops/new-app-setup.md` (303 righe, **13 step**) + prerequisito `wiki/development/standard/devops/aws-account-creation.md`. Origine Notion: pagina `12890ad6ee48803a96a9c579682608ad`.

### Fase 0 — Creazione account AWS (prerequisito, tutta console manuale)

Da `aws-account-creation.md`:
1. **Control Tower → Account Factory** sull'account management (Laif `339712916302` o care2impact `780361502008`): creare 2 account (`adminit+aws_<cliente>_dev@laifgroup.com` e `_prod`), OU `Projects` — **2 volte** (dev+prod).
2. **Bitwarden**: 2 entry in "Software - Admin/AWS Accounts".
3. **IAM Identity Center**: creare gruppo per account, assegnare team con `AWSAdministratorAccess` — 2 volte.
4. **Password + MFA root**: login incognito, forgot-password via casella `adminit@`, TOTP su Bitwarden — 2 volte.

### Fase 1-13 — Setup app (da `new-app-setup.md`)

| # | Step | Dove avviene | Manuale? |
|---|---|---|---|
| 1 | Fork di `laif-template` → repo progetto, clone locale | GitHub UI | sì |
| 2a | Editare `values.yaml` (app_name max 15 char, cod_application da Wolico, repo_name, infra_repo_name) | editor | sì |
| 2b | Config SSO in `~/.aws/config` + `aws sso login` (3 profili: dev, prod, production) | terminale | sì |
| 2c | `docker login` ECR production (654654481895) + `docker pull laif-deployer:latest` + `docker run` del container | Docker | sì |
| 2d | **[dentro il deployer]** `laif-cli init scaffold -f values.yaml` (sostituisce `${{ token }}` nei file `*.laif-template.*`) | container | semi |
| 2e | **[dentro il deployer]** `gh auth login` + `laif-cli init project -f values.yaml` (IAM user di deploy + GitHub environments con 10 vars + 2 secrets, `new-app-setup.md:99-109`) | container | semi |
| 2f | Verificare env GitHub, modificare `.github/CODEOWNERS`, push su develop | GitHub | sì |
| 3 | **[dentro il deployer]** `cookiecutter git@github.com:laif-group/laif-cdk.git` → repo `<cliente>-infra` con ~17 prompt interattivi (`new-app-setup.md:128-147`); creare la repo su GitHub; **[fuori dal deployer]** git init/push (su Mac: commentare `UseKeychain yes` in `~/.ssh/config`) | container+host+GitHub | sì |
| 4 | **[deployer]** `laif-cli init infra -f dev.yaml` poi `-f prod.yaml`; **appuntarsi a mano** ARN certificato + record DNS | container+blocco note | sì |
| 5 | **[deployer]** `laif-cli deploy -f dev.yaml --all` e `prod.yaml --all` con `deploy_services: false`; copiare a mano il `DISTRIBUTION_ID` nelle variabili dell'environment GitHub; **chiedere a Simone/Marco V/Marco P** il `GH_TOKEN` da mettere nei Repository Secret (`new-app-setup.md:190-192`) | container+GitHub+persona | sì |
| 6 | Editare `laif-dns/prod.yaml` con **4 record CNAME** (cert dev/prod + redirect dev/prod), commit su develop, **PR develop→master approvata da Simone/Marco Vita/Marco Pinelli**, attendere pipeline (`new-app-setup.md:196-237`) | repo laif-dns+umano | sì |
| 7 | GitHub Actions "Build and deploy, development" → **il primo deploy FALLISCE per design** nello step `deploy-backend` (il servizio ECS non esiste ancora, `new-app-setup.md:245`) | GitHub Actions | sì |
| 8 | `dev.yaml`: inserire `certificate_arn`, `deploy_services: true`; **[deployer]** `laif-cli deploy -f dev.yaml --all` (secondo deploy infra) | container | sì |
| 9 | "Re-run failed jobs" sulla Action fallita | GitHub UI | sì |
| 10 | PR develop→master sulla repo app, merge → pipeline prod parte, **fallisce di nuovo su deploy-backend** (`new-app-setup.md:267`) | GitHub | sì |
| 11 | Idem step 8 per `prod.yaml` (terzo/quarto deploy infra) | container | sì |
| 12 | Re-run failed jobs in prod | GitHub UI | sì |
| 13 | Utente **Troisi** (email/SES): IAM user `troisi-<cliente>` sull'account Production 654654481895 + policy `TroisiPolicy` + access key copiate nei Parameter Store `/<env>/<app>` di entrambi gli account cliente (`new-app-setup.md:284-293`) | console AWS+SSM | sì |

### Conteggio

- **~21 macro-step** (4 fase 0 + 17 contando i sub-step 2a-2f), con **dentro/fuori dal container deployer almeno 6 volte**.
- **Sistemi toccati: 11+** — Control Tower/IAM Identity Center, Bitwarden, casella adminit, GitHub (fork, environments, secrets, CODEOWNERS, Actions, 2 PR), Docker/ECR (deployer), cookiecutter/laif-cdk, repo `<cliente>-infra`, repo `laif-dns` (Route53), Wolico (registrazione app), SSM Parameter Store, console IAM (Troisi).
- **Persone bloccanti: 2 punti** in cui serve un umano specifico (GH_TOKEN e approvazione PR laif-dns: Simone, Marco Vita o Marco Pinelli).
- **Deploy infra eseguiti: 4** (2 ambienti × 2 passaggi no-services/services) + **2 deploy app falliti per design** da ri-runnare.
- **Repo create/toccate per progetto: 4** (app, `<cliente>-infra`, `laif-dns`, più laif-template come upstream).
- I valori (account id, app_name, ARN, DISTRIBUTION_ID) sono **ricopiati a mano in ≥5 posti**: `values.yaml`, `dev.yaml`/`prod.yaml`, GitHub env vars, `laif-dns/prod.yaml`, SSM.

### Dove fa male (sintesi)

1. **Doppio deploy infra obbligato** per evitare la race condition col certificato ACM (anti-pattern documentato nella skill: "Non eseguire `laif-cli deploy` con `deploy_services: true` al primo giro").
2. **Primo deploy app fallisce per design** in dev E in prod → "Re-run failed jobs" è parte della procedura ufficiale (step 7/9/10/12).
3. **laif-dns è un collo di bottiglia**: pipeline che **non sa modificare un record in-place** (rimuovere+deploy, poi ri-aggiungere+deploy — 2 giri), `prod.yaml` monolitico da **1705 righe / 207 CnameRecord**, PR con approvazione umana obbligatoria. La skill new-app ha dovuto inventare la regola "Live DNS va toccato UNA SOLA volta per cliente" con tutti e 4 i record insieme.
4. **Container laif-deployer**: serve solo a impacchettare laif-cli+laif-cdk+cdk; su Apple Silicon gira emulato (`--platform linux/amd64`), monta `~/.aws` e `~/.ssh`, e obbliga al balletto dentro/fuori (git push va fatto fuori, `UseKeychain` va commentato).
5. **Credenziali statiche IAM per il CI**: `init project` crea access key e le mette nei GitHub secrets — niente OIDC. Su master la policy di deploy è larghissima: `ecr:*`, `ecs:*`, `s3:*`, `logs:*` su `Resource: *` (`src/laif/cli/init/project.py:35-54`). Vincolo AWS di 2 access key/utente → al terzo re-run `init project` fallisce (HANDOFF, bug #7).
6. **Incoerenza naming nel template laif-cdk**: alcune risorse usano `customer_name` (RDS `dev-bonfiglioli-db`, secret), altre `app_name` (ECS `dev-bcons-be-cluster`, ECR, S3) — emersa nel test bcons, "da segnalare a Marco per il template" (HANDOFF, bug #1). I bucket S3 hanno nomi globali → collisione `bonfiglioli-consulting` vs `bonfiglioli-riduttori` ha costretto il rename ad `app_name=bcons`.
7. **ACM `VALIDATION_TIMED_OUT`**: se i record DNS non arrivano in 72h il certificato muore ed è terminale (SKILL.md, problema #2).
8. **Workflow GitHub duplicati**: `build-and-deploy.dev.yml` e `.prod.yml` sono identici a parte trigger/environment, con commento del maintainer: "reusable workflows do not support environments (WTF) … ¯\\_(ツ)_/¯" (`laif-template/.github/workflows/build-and-deploy.dev.yml:3-13`).

---

## 3. Cosa sta costruendo Simone: la skill `new-app` (la "scheda per creare nuove app")

Vive sul **branch `feat/new-app-skill`** (8 commit, ultimo `ef4d036` del **2026-06-03**, autore Simone; non mergiato su master). Diff vs master: **+7690/−386 righe, 43 file**. Due gambe:

### 3a. Skill `skills/new-app/` — il playbook eseguibile

- `SKILL.md` (171 righe): orchestrazione interattiva dei 13 step della guida. Principio: "una skill, una direzione: tutto è uno script" — ogni step ha un `NN-*-verify.sh` (idempotente, exit `0=fatto / 1=todo / 2=parziale`) e un `NN-*-do.sh` (richiede `--confirm`).
- **24 script / ~3.500 righe**: `preflight.sh` (check binari+auth), `discover.sh` (530 righe — rileva lo stato dei 13 step di un progetto ed emette JSON `done/partial/todo`), `02a`→`13` (values, SSO, scaffold, init project, infra repo via cookiecutter, init infra, deploy infra, DNS, trigger deploy, toggle services, Troisi), `handoff-generate.sh`, più `teardown/teardown-env.sh` (419 righe, smonta un intero ambiente per fasi: cloudfront-disable → ecs-drain → s3-empty → ecr-purge → rds-delete → delete-stack → leftovers → acm-delete → iam-purge; dry-run di default, prod richiede `--i-understand-this-deletes-prod`).
- Stato persistente per progetto in `.claude/new-app-state.json` (ARN, DISTRIBUTION_ID, DNS target) → resume + handoff.
- La "scheda": `templates/values.template.yaml` (28 righe) — il modulo unico con `APP_NAME / COD_APPLICATION / REPO_NAME / INFRA_REPO_NAME / account+profili+region dev e prod` da cui parte tutto.
- **Maturità dichiarata**: "eseguita end-to-end UNA SOLA VOLTA (Bonfiglioli Consulting / bcons, giugno 2026) e in quell'unica run ha incontrato diversi problemi reali. NON è ancora battle-tested" (SKILL.md, sezione "Maturità & cautela"). 6 problemi censiti: GH env vars stale, cert ACM timeout, Wolico 401, timeout post-deploy ~300s + CORS sync col nome sbagliato, frontend `output: export` rotto dalle route dinamiche `[id]`, cap 2 access key.

### 3b. Porting/hardening del CLI `laif init`/`deploy` (commit `cd51875`, `35009fa`, …)

L'analisi in `HANDOFF-new-app-skill.md` ha scoperto che **le versioni su master di `init/project.py`, `init/infra.py`, `deploy.py` sono "porting semplificati con bug e regressioni"** rispetto a laif-cli. Il branch li riallinea 1:1:

- `init project`: IAM user `<env>-<app>-github-technical-user` con managed policy da `utilities/github-user-policy.json` (NON più il legacy `deploy-<app>` con policy inline `*`); **seed SSM `/<env>/<app>` con 19 chiavi** (APP_TITLE…PDFREST_API_KEY); registrazione Wolico `POST /applications` con service account `laif-cli`; environment GitHub `development`/`production`. Extra di sicurezza: rifiuto degli account id di default del template (`975050242655`/`654654481895`), secret via stdin (no leak in argv), rollback access key.
- `init infra`: richiesta cert ACM in us-east-1, IAM `<env>-cdk-technical-user`, bootstrap incondizionato di eu-west-1 + us-east-1, registrazione per-stack su Wolico, `cdk -c env=<env>`.
- `deploy`: multi-stack da yaml, stampa post-deploy di DNS record + DISTRIBUTION_ID, conferma interattiva.
- Task rimanenti dichiarati: porting completo di `scaffold` (README/CHANGELOG/version/git-cleanup) e `data_transfer` SFTP; reset e rebuild da zero di bonfiglioli per validare end-to-end. Decisione esplicita di NON portare: `wipeout`, `retrieve-credentials`, `lcp register/delete`, `apply`, `bootstrap`.

**Lettura per il ridisegno**: il branch dimostra che il CLI `laif` su host (via `uv tool install`) può sostituire integralmente laif-cli+laif-deployer — il container non serve più. È esattamente la direzione del brief ("eliminare laif-cli e laif-deployer"). Ma oggi questo lavoro è fermo su un branch non mergiato da una settimana, validato su un solo cliente, e **automatizza il processo esistente con tutte le sue assurdità** (doppio deploy, primo deploy che fallisce, DNS one-shot): se l'infra viene ridisegnata, gran parte dei 24 script va riscritta — meglio farli convergere.

---

## 4. Knowledge-base (`wiki/`): cosa va aggiornato se l'infra cambia

La KB è citata dal CLI, dalle skill e dagli agenti (routing search-first, `CLAUDE.local.md:89-98`): ogni doc stantio inquina direttamente le risposte degli agenti. Impatto per area:

### Da riscrivere quasi integralmente
| File | Perché |
|---|---|
| `wiki/development/standard/devops/new-app-setup.md` | È la procedura 13-step. Cambia con: nuova libreria CDK, niente deployer, autoscaling, DB privati. Anche la **pagina Notion sorgente** `12890ad6ee48803a96a9c579682608ad` |
| `wiki/development/standard/devops/cloud-architecture.md` | Descrive l'architettura attuale (ECS su EC2, S3+CloudFront, RDS, "load balancer monitora i container") — righe 20-93 da rifare con autoscaling/monitoring/rete privata |
| `wiki/development/standard/devops/infra-update.md` | Tutta basata su laif-deployer Docker + `laif-cli deploy` — muore con l'eliminazione di laif-cli/deployer |
| `wiki/development/standard/devops/laif-deployer-release.md` | Processo di rilascio laif-cli/laif-cdk/laif-deployer — obsoleto se si eliminano |
| `wiki/development/knowledge/infrastructure-as-code/README.md` | Descrive l'ecosistema laif-cdk/laif-cli/laif-deployer e il TemplateStack |
| `skills/new-app/` (branch) | I 24 script codificano il flusso attuale (cookiecutter laif-cdk, doppio deploy, laif-dns) |

### Da aggiornare in modo mirato
| File | Tocco |
|---|---|
| `wiki/development/standard/devops/aws-account-creation.md` | Se si rivede il modello account-per-cliente (brief, punto 8) |
| `wiki/development/knowledge/monitoring/README.md` | Oggi il monitoring = error-reporting verso Wolico (scan ogni 5 min); va esteso con CloudWatch alarms/metriche infra |
| `wiki/development/standard/devops/cloud-db-connection.md`, `rds-snapshot-restore.md`, `transfer-data.md`, `sftp-data-transfer.md` | Se i DB passano in rete privata cambia il modo di collegarsi (VPN/bastion) |
| `wiki/development/standard/devops/vpn-*.md` (5 file) | Coinvolti dalla messa in privato dei DB |
| `wiki/development/standard/devops/app-on-off.md`, `out-of-service.md`, `wolico-app-startup-fix.md` | Start/stop infra cambia con autoscaling |
| `wiki/development/standard/devops/custom-domain.md`, `branch-test.md`, `cloudwatch-logs.md`, `aws-healthcheck-local.md`, `troisi-setup-client.md` | Riferimenti a CloudFront/ECS/cert da rivedere |
| `laif-template/.github/workflows/build-and-deploy.{dev,prod}.yml` + `values.yaml` | Pipeline accoppiata alle 10 GH vars attuali (ECS_CLUSTER, DISTRIBUTION_ID, FRONTEND_BUCKET…) e alle access key statiche |
| `docs/cli.md` (sezioni Bootstrap/Provisioning) e `wiki/CLAUDE.md` (tabella comandi) | Se cambiano i comandi `init`/`deploy` |
| `TODO.md` | Roadmap del CLI: nessuna voce su monitoring/scaling — da integrare con i nuovi comandi infra |
| `laif-dns/` (copia dentro laif-factory) | Duplicato della repo laif-dns: deduplicare o dichiarare quale fa fede |

E ricordare che **dietro quasi ogni doc wiki c'è una pagina Notion sorgente** (link `> Fonte: Notion` in testa ai file): l'aggiornamento è doppio, wiki + Notion. Dopo ogni modifica va rigenerato l'indice di ricerca `.laif/search.db`.

---

## 5. Conclusioni operative per il ridisegno

1. **Il sostituto di laif-cli/laif-deployer esiste già al 70%**: è `laif init*`/`laif deploy` su `feat/new-app-skill`. Decidere subito se mergiarlo (e completare i task #10/#11 del HANDOFF) o se la nuova libreria CDK del ridisegno ne cambia i contratti — evitare di stabilizzare due volte.
2. La nuova libreria infra deve **eliminare le cause, non gli effetti**, dei passi peggiori: certificato/DNS gestiti dallo stack (niente doppio deploy, niente "primo deploy fallisce"), OIDC GitHub→AWS (niente access key statiche né GH_TOKEN passato a voce), naming unico app/customer, DNS via API o delega di zona invece del monolite `laif-dns/prod.yaml` da 1705 righe.
3. La "scheda" (`values.template.yaml`) è il punto giusto dove far convergere TUTTA la configurazione (feature on/off come da brief: autoscaling, monitoring, ETL): oggi la stessa informazione vive in 5 posti.
4. Budget di documentazione: **~6 file wiki da riscrivere + ~15 da ritoccare + le pagine Notion gemelle + i 24 script della skill** — da pianificare come parte del progetto di migrazione, non come coda.
