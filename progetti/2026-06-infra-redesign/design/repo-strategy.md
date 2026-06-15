# Strategia repo, packaging e tooling

> Dove vive l'infra, come si versiona/distribuisce, chi può deployare, come si deploya. Layer di processo
> della nuova libreria (Fase C, modulo `tooling`). Implementa **TOOL-01..08 + NETSEC-06**. Per i costrutti
> dei moduli infra vedi `moduli-cdk.md`; per la visione `architettura-target.md`.

## 1. Decisione: infra DENTRO la repo di progetto (non più `<cliente>-infra` separata)

**Scelta**: la scheda `laif.yaml` vive **in root della repo di progetto**. Si abbandona la repo
`<cliente>-infra` separata come default.

**Perché** (motivazioni, da `analisi/05` e dalle decisioni):
1. Il contenuto utile di una repo infra è **~15 righe di YAML** e 10/24 `app.py` sono byte-identici: la repo
   separata è un **guscio** che aggiunge solo un secondo posto da allineare e un secondo flusso di deploy.
2. Il vincolo "**1 infra + N app stesso account**" (crif, prima-power, laif) **non** giustifica la repo
   separata: si risolve con la lista `apps:[]` nella scheda.
3. Con **account isolati** (decisione di Simone) non c'è infra cross-progetto da condividere → nessun motivo
   tecnico per separare.
4. Infra+app nella stessa repo **elimina il drift** cert-ARN/DISTRIBUTION_ID/DNS tra due repo e abilita
   `cdk diff` **nello stesso PR** del codice applicativo.

**Eccezione**: i pochi clienti con **2 app su 2 repo diverse, stesso account** tengono `laif.yaml` in **una**
delle due repo, oppure in una mini-repo `<cliente>-infra` di ~20 righe che dichiara entrambe in `apps:[]`.
La libreria gestisce **N app, non N repo**.

## 2. Packaging & versioning della libreria — pin obbligatorio

**Problema oggi**: 0/24 repo pinnano `laif-cdk` (3 URL git diversi, 1 **rotto** su benozzi `github.org`) →
ogni `pip install` prende l'HEAD → l'infra può cambiare da sola al deploy successivo.

**Target**: pubblicare `laif_infra` su **CodeArtifact** (account tooling/Production) e installare per
**versione esatta**. Il loader **rifiuta** `latest`/HEAD e gli URL git senza tag. Build riproducibili.

| Flag | Default | Effetto |
|---|---|---|
| `laif_infra.source` | `codeartifact` | `git` (tag) solo per bootstrap/offline; `version` sempre obbligatorio |

*Quick win immediata e indipendente (QW-E1 / TOOL-05)*: **pinnare il vecchio `laif-cdk` a un tag** (v1.40
esiste) e **riparare l'URL rotto di benozzi** — fattibile **subito**, ferma il rischio "infra cambia da
sola" prima ancora del redesign.

## 3. Identità di deploy — OIDC, niente più access key (TOOL-04 / NETSEC-06)

**Problema oggi**: `init project` crea un utente IAM con **access key statiche** e policy `ecr:* ecs:* s3:*`
su `*`, copiate nei GitHub secrets; il `GH_TOKEN` si passa a voce; cap di 2 access key/utente fa fallire il
3° re-run.

**Target**: federazione **OIDC GitHub→AWS**.
- `GithubOidcProvider` — un provider OIDC per-account (lookup-or-create).
- `CicdOidcRole` — IAM Role assunto via OIDC, **trust per `repo:…:environment:<env>`**, policy
  **least-privilege per-ambiente** (solo le azioni/risorse reali del deploy). ARN come `CfnOutput`+SSM.
- Tutto **CDK-owned** → chiude la responsabilità imperativa che giustificava `wipeout`.

## 4. CI per il deploy infra (TOOL-03) — oggi 0/24 repo ce l'hanno

**Problema oggi**: deploy infra 100% manuale dal laptop (laif-cli nel container deployer, SSO Administrator
della persona), senza PR/review/audit, senza garanzia che git == deployato.

**Target**: `InfraPipeline`, un **reusable workflow centralizzato** (in `laif-group/laif-infra-workflows`,
pinnato `@v2`): su **PR** fa `cdk diff` e lo posta come commento; su **merge** fa `cdk deploy` via OIDC.
Referenziato da ogni repo con 3 righe → **niente più 2×N workflow duplicati in drift** (oggi
template↔andriani = 149 righe di diff).

## 5. Cert + DNS nello stack (TOOL-06 / TOOL-07) — elimina il doppio deploy

**Problema oggi**: cert ACM con ARN incollato a mano, doppio deploy `deploy_services:false→true`, "primo
deploy fallisce by design", `DISTRIBUTION_ID` copiato a mano, e laif-dns = monolite `prod.yaml` (1705 righe,
207 CNAME, PR approvata a mano, **no modifica in-place**).

**Target**:
- `AcmDnsValidatedCert` — cert ACM **DNS-validated dentro lo stack** (regionale eu-west-1 per origin ALB +
  us-east-1 per viewer CloudFront via stack/cross-region ref). Niente più ARN a mano né
  `VALIDATION_TIMED_OUT` terminale. **Un solo deploy per ambiente.**
- `DnsZoneDelegation` — la zona `<customer>.app.laifgroup.com` è **delegata una volta** all'account cliente
  (record NS nel monolite laif-dns). Dopo la delega, **tutti i record applicativi/cert li scrive lo stack**
  del cliente nella propria Route53 (CDK-owned). laif-dns resta solo per le deleghe (poche righe/cliente).

| Flag | Default | Effetto |
|---|---|---|
| `dns.managed` | `true` | cert+record gestiti dallo stack; `false` = legacy (ARN a mano) per migrare senza bloccare |
| `dns.zone_delegation` | `per_customer` | zona delegata; `central_record` per clienti su account/domini terzi (es. jubatus) |

## 6. Toolchain — eliminare laif-deployer (TOOL-01)

`laif-deployer` (Docker 764 MB, emulato amd64 sui Mac ARM, 2 submodule non pinnati, catena di rilascio a 3
repo) serve solo a dare versioni coerenti. **Target**: toolchain dichiarata in `pyproject.toml`+`uv.lock`
(locale, `uv sync`) e in **runner GitHub pinnati** (CI). Stesse versioni a tutti, **zero container**.

## 7. Convergenza su `laif` — eliminare laif-cli (TOOL-02)

`laif-cli` (congelata, 705 righe di boto3 imperativo) si dismette **ricollocando le 8 responsabilità**
(`analisi/02` §6):

| # | Responsabilità laif-cli | Nuova casa |
|---|---|---|
| 1 | `cdk deploy` + filtro stack disabled | TOOL-03 (CI OIDC); il filtro diventa config-driven (CONFIG) |
| 2 | stampa DNS/`DISTRIBUTION_ID` | TOOL-06 (`CfnOutput` + DNS automatico) |
| 3 | richiesta cert ACM | TOOL-06 (cert DNS-validated nello stack) |
| 4 | token scaffolding | `laif init scaffold` (già esiste) |
| 5 | utente IAM + access key CI | TOOL-04 (OIDC, CDK-owned) |
| 6 | `wipeout` (teardown imperativo) | **sparisce**: risorse CDK-owned → `cdk destroy` + RemovalPolicy |
| 7 | `retrieve-credentials` | `aws ssm get-parameter` |
| 8 | **`lcp`/Checkmk** | **ELIMINATO** (Checkmk morto; monitoring su Wolico, decisione #2) |

**Punto critico**: far convergere `laif` (laif-factory, già su host via `uv tool install`) sul **NUOVO** CDK
— **non** stabilizzare il branch `feat/new-app-skill` sul vecchio flusso (i 24 script automatizzano le
assurdità: doppio deploy, primo-deploy-fallisce, DNS one-shot). Il **plugin-system** di laif-cli (import a
runtime di comandi dalla cwd) **non** si riproduce: comandi per-progetto = script versionati.

## 8. Sequenza di migrazione (ordine vincolante)

Dal principio "l'ordine conta" (`analisi/02` §6):

1. **TOOL-05** — pinnare `laif-cdk` a tag (quick win, subito, zero dipendenze; ripara benozzi).
2. **TOOL-04 / NETSEC-06** — OIDC: `GithubOidcProvider` + `CicdOidcRole` in CDK **prima** della CI. Rende le
   risorse CDK-owned → abilita il kill di `wipeout`. Pilota su 1 cliente nuovo.
3. **TOOL-03** — CI infra (reusable workflow, `cdk diff`/deploy via OIDC). Sostituisce il deploy dal laptop.
4. **TOOL-01** — kill laif-deployer (a valle di 2+3 la toolchain è nel runner + uv).
5. **TOOL-02** — kill laif-cli (convergenza su `laif` + nuovo CDK; ricolloca le 8 responsabilità; `lcp` eliminato).
6. **TOOL-06 + TOOL-07** — cert/DNS nello stack + delega di zona per-cliente (elimina il doppio deploy).
7. **TOOL-08** — scheda unica `laif.yaml` (collassa values+dev/prod.yaml+GH vars+SSM).

**Rischi**: (a) *"stabilizzare due volte"* — congelare il branch, **riusare gli script idempotenti**
(verify/do, `discover.sh`) come **pattern** ri-targettato, non gli script attuali. (b) cert cross-account →
finché un cliente non è delegato, `dns.managed:false`. (c) clienti su account terzi (jubatus) →
`zone_delegation: central_record`. (d) staccare le access key **solo dopo** 3 deploy OIDC verdi. (e) i
clienti restano sul vecchio `laif-cdk` **pinnato** finché non sono migrati uno a uno.

## 9. Pilota

Il **prossimo onboarding nuovo** (Casartelli è day-zero, deploy 10/06: candidato ideale) parte direttamente
sul nuovo flusso: `laif.yaml` + OIDC + CI + cert nello stack → i ~21-37 passi manuali diventano **1 PR
(laif.yaml) + 1 delega NS in laif-dns + merge**. Validare end-to-end **prima** di toccare la flotta esistente.

## 10. Impatto sulla knowledge-base (da `analisi/06` §4)
Il cambio di infra/tooling rende stantii **~6 file wiki da riscrivere** (`new-app-setup`, `cloud-architecture`,
`infra-update`, `laif-deployer-release`, `infrastructure-as-code/README`, gli script della skill new-app) +
**~15 da ritoccare** + le pagine Notion gemelle + l'indice di ricerca `.laif/search.db`. Da pianificare come
**parte** del progetto di migrazione, non come coda.

## 11. Domande aperte (REPO)
1. **CodeArtifact vs tag git** per il packaging (immutabilità/audit vs zero-infra/costo). Raccomandato CodeArtifact.
2. Repo strategy per i clienti **2 app/2 repo** stesso account: `laif.yaml` in una repo o mini-repo dedicata?
3. Delega di zona fattibile per tutti i domini `app.laifgroup.com`; conferma `central_record` per gli account terzi.
4. N° di deploy OIDC verdi prima di staccare le access key (proposto: 3).
5. Il **runner ARM self-hosted** (SPOF delle build app) resta o si migra a runner GitHub-hosted ARM? Fuori
   scope (è build app, non deploy infra) ma da decidere in parallelo.
