# Roadmap di migrazione

> Sequenza di esecuzione del ridisegno (Fase D, 2026-06-11). Ordina in fasi/milestone gli interventi del
> catalogo (`../interventi/`) e le note di migrazione per modulo (`moduli-cdk.md`). Ogni fase ha:
> obiettivo, contenuto, prerequisiti, rischio, **criterio di uscita (gate)**, valore. Non ci sono date
> assolute: la cadenza dipende dalle risorse; gli effort sono ordini di grandezza.

## Principio guida
**Disaccoppiare valore e rischio.** I guadagni più grandi (down chiusi, risparmio, sicurezza) sono in gran
parte **quick win a basso rischio applicabili PRIMA** di toccare l'architettura. Il rework strutturale
(rete privata, ALB→servizio, nuova libreria) si fa **per cliente, con cutover**, dopo aver validato su un
pilota. Regola d'oro della sequenza tooling: *"prima OIDC + risorse CDK-owned, poi CI, poi convergenza CLI,
poi cert/DNS"* (`analisi/02` §6).

```
FASE 0 ───────────► FASE 1 ──────────► FASE 2 ─────────► FASE 3 ──────────────► FASE 4
quick win           fondamenta         pilota            rollout flotta         pulizia
(flotta esistente)  (laif_infra+CI)    (Casartelli+Nivi) (per cliente,dev→prod) (kill legacy+KB)
valore subito       nessun rischio     valida il target  il grosso del lavoro   chiude il debito
−900/−1.300 $/mese  cliente            end-to-end        cutover di rete        zero codice morto
```

---

## FASE 0 — Quick win sulla flotta esistente *(parallelo, basso rischio, valore immediato)*

**Obiettivo**: incassare risparmio, chiudere i down e i buchi di sicurezza **senza** aspettare la nuova
libreria. Si agisce sugli stack `laif-cdk` attuali (alcuni fix backportati nei default, altri come
operazioni mirate).

**Contenuto** (da `quick-wins.md`):
- **Subito, indipendenti, 0 rischio**: `TOOL-05` pin laif-cdk (+ ripara benozzi) · `COST-RI-RENEW` RI/SP 1y
  (−250/−300) · `COST-RDS-DEV-TURNOFF` (−150/−250) · `COST-RDS-BACKUP-RETENTION` dev (−100/−150) ·
  `COST-CONFIG-TUNING-DEV` (−60/−100) · `COST-CLEANUP-MISC` + EIP idle (−60/−90).
- **Fix Nivi a 0 $** (backport nei default ECS o per-cliente): `SCALE-01` health check · `SCALE-02` worker
  (lato app) · `SCALE-03` desired=2 (dove possibile su 2 istanze) · `SCALE-06` circuit breaker.
- **Osservabilità RDS in-place** (modify, rischio ~0): `MON-03` PI/Enhanced/log export.
- **Sicurezza library-level backportabile**: `NETSEC-05` chiudere SSH al mondo/`ANY`/password=username ·
  `NETSEC-07` VPC flow logs · `NETSEC-04` WAF in **COUNT**.

**Prerequisito per gli alarm**: i 4 alarm anti-Nivi (`MON-01`) hanno bisogno del **canale**. Due strade:
(a) SNS→email subito (valore immediato), (b) attendere l'endpoint Wolico (Fase 1) per il cruscotto unico.
Consiglio: **SNS→email ora** come fallback, poi si aggancia Wolico.

**Rischio**: basso. Trappole note: `desired=2` su BRIDGE richiede 2 istanze (vero 0 $ solo dopo Fase 3);
non ridurre backup/Config sui prod senza verifica RPO/compliance; EC2-idle solo sui dev ora.

**Gate di uscita**: RI/SP comprate; auto-turnoff dev attivo; fix Nivi deployato su Nivi (e i kill cessano);
WAF in COUNT su flotta; nessun SSH aperto al mondo. **Valore**: ~−900/−1.300 $/mese, down chiusi, 6 buchi
di sicurezza mitigati.

---

## FASE 1 — Fondamenta: nuova libreria + tooling *(nessun cliente in produzione toccato)*

**Obiettivo**: costruire `laif_infra` e la catena di deploy moderna, **a parte**, pronta per il pilota.

**Contenuto**:
- **Libreria `laif_infra`**: implementare i moduli `CONFIG` (scheda + `AppStack` + naming), `NET`, `DATA`,
  `COMPUTE`, `EDGE`, `OBS`, `JOBS` con i default sicuri e i feature flag. Pubblicare su **CodeArtifact**
  pinnato (`TOOL-05` nuovo).
- **Tooling (ordine vincolante)**: `TOOL-04`/`NETSEC-06` OIDC (`GithubOidcProvider`+`CicdOidcRole` in CDK) →
  `TOOL-03` CI infra (reusable workflow centralizzato) → `TOOL-01` kill laif-deployer (uv + runner pinnati).
- **Lato Wolico (prerequisito di OBS)**: implementare l'**endpoint ingest** `POST /api/ingest/infra-alarm`
  (auth, modello `InfraAlarm`, mapping severità, dedup, silenziamento) riusando routing maintainer/soglie
  esistenti. **Da concordare col team Wolico** (contratto in `moduli-cdk.md` §OBS).

**Prerequisito**: sciogliere le domande aperte bloccanti (contratto endpoint Wolico; cert us-east-1 in
TOOL-06; soglia Fargate-vs-EC2). Congelare il branch `feat/new-app-skill` (riusarne il **pattern** degli
script idempotenti, non il codice sul vecchio flusso).

**Rischio**: tecnico, isolato (nessun cliente in prod). Trappola: "stabilizzare due volte" → convergere
`laif` sul **nuovo** CDK.

**Gate di uscita**: `laif_infra` pubblicata e installabile per versione; OIDC role + CI deployano un account
sandbox; endpoint Wolico risponde. **Valore**: abilitante (nessun risparmio diretto).

---

## FASE 2 — Pilota *(2 account: 1 cliente nuovo + Nivi come validazione monitoring)*

**Obiettivo**: validare il target **end-to-end** prima di toccare la flotta.

**Contenuto**:
- **Onboarding sul nuovo flusso** del prossimo cliente nuovo (**Casartelli**, day-zero, candidato ideale):
  `laif.yaml` + OIDC + CI + cert/DNS nello stack (`TOOL-06`/`TOOL-07` con delega di zona) + moduli
  NET/DATA/COMPUTE/EDGE/OBS. I ~21-37 passi manuali diventano **1 PR + 1 delega NS + merge**.
- **Validazione monitoring su Nivi**: deployare `OBS` su nivi-prod (additivo, basso rischio) e verificare che
  i 4 alarm si accendano sulla causa nota (saturazione 1 vCPU → task kill) e arrivino a Wolico.
- **Trittico EDGE** sul pilota dev: WAF COUNT→BLOCK, header segreto + HTTPS origin, bucket privato+OAC
  (testare i deep-link SPA).

**Prerequisito**: Fase 1 completa; cert ACM DNS-validated funzionante sulla zona delegata del pilota.

**Rischio**: medio sul pilota, **zero sulla flotta** (isolato). Trappole: cert cross-account (se non delegato
→ `dns.managed:false`); bucket FE `DESTROY`→impostare RETAIN+sync prima dello switch OAC.

**Gate di uscita**: Casartelli in prod sul nuovo flusso, funzionante; Nivi mostra gli alarm in Wolico;
trittico EDGE validato (deep-link, `/api/*` via header, WAF non blocca login/upload). **Valore**: prova che
il target funziona; Nivi finalmente osservabile.

---

## FASE 3 — Rollout flotta *(per cliente, dev→prod, a batch — il grosso del lavoro)*

**Obiettivo**: migrare i ~24 clienti esistenti al nuovo modello. Si migra **il pattern** (la flotta è
clonata), un cliente alla volta.

**Ordine per cliente**: `dev pilota` → `dev flotta` → `prod a basso traffico` → `prod critici` (Nivi, Coci).

**Contenuto per cliente**:
1. **Config**: `laif infra migrate` (best-effort: dev/prod.yaml+app.py → `laif.yaml`+`apps[]`); `cdk diff`
   come autorità (deve essere vuoto/spiegabile → riconcilia il drift, lezione Nivi). Tenere i flag al valore
   **attuale**, poi flippare un flag alla volta.
2. **Additivo subito** (basso rischio): `OBS` (alarm→Wolico), `MON-03`, WAF COUNT, log retention.
3. **Cutover di rete** (`NET`/`DATA` — **REPLACE, non in-place**): account/stack target con VPC 3-tier →
   snapshot restore RDS in subnet isolated → `COMPUTE` ALB→servizio (awsvpc/Fargate) → swap CNAME CloudFront
   (blue/green) → dismissione vecchio. Elimina IP pubblici RDS/EC2 (`COST-IPV4`) e `publicly_accessible`.
4. **Trittico EDGE** in BLOCK; **JOBS**: ETL EC2→Fargate (`TASK-02`), background-task async→`queue`
   (`TASK-06`), workflow `FLG_ETL`→`command` override.
5. **Cert/DNS** del cliente CDK-owned (delega di zona); rimuovere la PR manuale su laif-dns.

**In parallelo, a convergenza raggiunta**: `TOOL-02` kill laif-cli (ricolloca le 8 responsabilità,
**elimina `lcp`/Checkmk**); staccare le access key statiche **solo dopo** 3 deploy OIDC verdi.

**Rischio**: **alto** (è dove si tocca la prod). Mitigazioni: pilota già validato; blue/green sul CNAME (zero
downtime); RETAIN su risorse stateful; mappare per-cliente chi chiama API esterne (→ `needs:[internet]`);
verificare limiti ENI (awsvpc) e rule per listener (ALB condiviso); tenere il vecchio `laif-cdk` **pinnato**
finché il cliente non è migrato (nessuno si muove da solo).

**Gate di uscita** (per cliente): `cdk diff` pulito; alarm in Wolico; RDS privato; ALB→servizio; nessuna
regressione su un canary di traffico. **Valore**: sicurezza + affidabilità + monitoring estesi a tutta la
flotta; risparmio IPv4 realizzato; onboarding futuro a 1 PR.

---

## FASE 4 — Pulizia & chiusura del debito

**Obiettivo**: rimuovere il legacy e allineare la conoscenza.

**Contenuto**:
- Dismettere **laif-cli**, **laif-deployer**, **lcp/Checkmk**; rimuovere gli **stack mai usati** di laif-cdk
  e la **factory Step Functions custom** (~1.640 righe, 0/24 la importano — `TASK-05`).
- **Knowledge-base** (`analisi/06` §4): riscrivere ~6 file wiki (`new-app-setup`, `cloud-architecture`,
  `infra-update`, `laif-deployer-release`, `infrastructure-as-code`, script skill new-app) + ~15 ritocchi +
  pagine Notion gemelle + reindicizzare `.laif/search.db`.
- Decommissionare i vecchi account/stack residui dei cutover.

**Gate di uscita**: nessun riferimento a laif-cli/deployer/Checkmk nel codice e nella wiki; tutti i clienti
su `laif_infra` pinnato; KB aggiornata. **Valore**: zero codice morto, una sola fonte di verità.

---

## Vista d'insieme: cosa sblocca cosa (dipendenze critiche)

| Devi fare… | …prima di… | Perché |
|---|---|---|
| Endpoint ingest **Wolico** | `OBS` (alarm→Wolico) | senza, gli alarm vanno solo in email |
| `TOOL-04` **OIDC** | `TOOL-03` CI, kill `wipeout` | la CI senza OIDC userebbe ancora chiavi statiche |
| `NET` (subnet private + endpoint) | `DATA` privato, `COMPUTE` Fargate, `JOBS` | i workload privati non partono senza endpoint |
| **Delega di zona** (`TOOL-07`) | cert DNS-validated (`TOOL-06`) | la validazione automatica richiede zona scrivibile |
| `SCALE-04` (ALB→servizio) | `desired=2` a 0 $, `SCALE-05` autoscaling | con BRIDGE/hostPort statico non scali sulla stessa istanza |
| **Pilota** (Fase 2) | rollout flotta (Fase 3) | non toccare 24 prod prima di validare il target |
| Convergenza `laif` su nuovo CDK | kill laif-cli | evitare di "stabilizzare due volte" |

## Registro rischi (i 5 da sorvegliare)
1. **Cutover di rete = REPLACE** → downtime se mal gestito. Mitigazione: blue/green su CNAME, snapshot, finestra.
2. **Interface endpoint non coprono un'app** che chiama API esterne → perde egress. Mitigazione: mappa
   per-cliente, `needs:[internet]` (fck-nat) dove serve.
3. **Cert cross-account** non validato → onboarding bloccato. Mitigazione: `dns.managed:false` finché non delegato.
4. **Config drift** repo↔prod (caso Nivi) → `cdk diff` non vuoto. Mitigazione: riconciliare a mano prima di adottare.
5. **"Stabilizzare due volte"** il tooling. Mitigazione: congelare il branch, convergere sul nuovo CDK.

## Valore cumulato per fase
| Fase | € /mese | Affidabilità | Sicurezza | Monitoring | Semplificazione |
|---|---|---|---|---|---|
| 0 quick win | **−900/−1.300** | down Nivi chiusi | 6 buchi mitigati | alarm base | pin libreria |
| 1 fondamenta | — | — | OIDC | endpoint Wolico | CI, no container |
| 2 pilota | (IPv4 sul pilota) | Nivi osservabile | trittico EDGE | white-box su Wolico | onboarding 1 PR |
| 3 rollout | + IPv4 flotta | tutta la flotta | tutta la flotta | tutta la flotta | infra in-repo, no laif-cli |
| 4 pulizia | (CloudWatch +50/+150) | — | — | cruscotto unico | zero codice morto, KB allineata |

Tetto complessivo: run-rate da **~39.700 $/anno** a **~26.000-29.000 $/anno** (isolamento mantenuto), con
monitoring/autoscaling/sicurezza oggi assenti **inclusi** nel budget.
