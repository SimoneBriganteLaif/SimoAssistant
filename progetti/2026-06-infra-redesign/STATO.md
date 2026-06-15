# STATO — Ridisegno infrastruttura LAIF

> File di **stato master** del progetto. È l'ancora per riprendere il lavoro in sessioni nuove.
> Aggiornare questo file alla fine di ogni fase. La fonte del *cosa* è `BRIEF.md`.
> Ultimo aggiornamento: **2026-06-11**.

> **STATO PROGETTO: COMPLETO (Fasi 0/A/B/C/D/E tutte ✅, 2026-06-11).** Tutti i deliverable prodotti.
> Prossimi passi reali = esecuzione della roadmap (`design/roadmap-migrazione.md`), che parte dalle quick
> win di Fase 0. Le domande aperte trasversali sono in `design/moduli-cdk.md` §finale.

## Modello di lavoro: a GATE
Il lavoro consuma molti token. Si procede a fasi, ognuna chiusa da un **GATE**:
- ogni fase salva i suoi output in file (qui sotto) → ripartenza sempre possibile;
- al gate **Simone dà l'OK** per continuare oppure si aspetta che si ricarichino i token;
- per riprendere in una sessione nuova: leggi questo file → vai alla prima fase `TODO`.

---

## Mappa delle fasi e dei gate

| Fase | Nome | Output (cartella) | Stato | Gate |
|---|---|---|---|---|
| **0** | Recon + roadmap (questo file) | `STATO.md` | ✅ FATTO | — |
| **ANALISI** | Diagnosi infra attuale (sessione precedente) | `analisi/*.md` (9 doc) | ✅ FATTO | — |
| **A** | Sintesi findings + baseline costi | `sintesi/` | ✅ FATTO | GATE A ✅ |
| **B** | Catalogo interventi: quick win + piccoli/medi/grandi (€, effort, beneficio) | `interventi/` | ✅ FATTO | GATE B ✅ |
| **C** | Architettura target: nuova libreria CDK modulare + strategia repo | `design/` | ✅ FATTO | GATE C ✅ |
| **D** | Roadmap di migrazione (fasi, rischi, sequenza) | `design/` | ✅ FATTO | GATE D ✅ |
| **E** | Presentazione HTML con diagrammi | `presentazione/` | ✅ FATTO | GATE E ✅ |

Legenda stato: ⬜ TODO · 🟡 IN CORSO · ✅ FATTO

---

## Cosa è già stato fatto (Fase ANALISI)
9 documenti in `analisi/` (sessione 2026-06-10, fonti: codice repo locali + AWS live read-only + Cost Explorer consolidato profilo `laif`):

- `01-cdk-template-stack.md` — anatomia di `TemplateStack` (804 righe, 56 param, solo 17 da YAML).
- `03-cdk-constructs.md` — i 22 construct di laif-cdk (~3.970 righe, zero test reali, patchwork di stili).
- `04-deploy-flow.md` — flusso deploy end-to-end (2 flussi separati: GH Actions per codice + laif-cli/deployer per infra).
- `05-infra-repos-confronto.md` — confronto delle 24 repo `<cliente>-infra` (quanto sono identiche, cosa cambia davvero).
- `06-factory-newapp.md` — laif-factory e il flusso "nuovo cliente → app in prod".
- `07-aws-casartelli-live.md` — inventario live del "deployment tipo" (CloudFront→S3/ALB→ECS-on-EC2→RDS pubblico).
- `08-aws-nivi-caso-studio.md` — analisi forense "Nivi va giù" (causa = health check aggressivo + single worker + desired_count=1).
- `09-costi-organizzazione.md` — analisi costi org via Cost Explorer (trend, voci principali).

### Gap noti dall'analisi
- ✅ **`02-laif-cli-deployer.md` creato** (2026-06-11): tooling laif-cli/deployer + mappa di sostituzione.
- Verificare che il **baseline costi** (`09`) sia abbastanza granulare per produrre stime di risparmio in € per ogni intervento (Fase B).

### Scoperte chiave da tenere a mente nelle fasi successive
- **LCP/Checkmk = monitoraggio già esistente** (dal doc 02): il gruppo `lcp` di laif-cli registra
  gli host su **Checkmk** per health-check up/down + alert + downtime programmato. NON è vero "zero
  monitoring": manca il monitoring **white-box** (CPU/RAM/disco/DB). Decisione strategica per Fase C:
  tenere Checkmk per l'up/down + CloudWatch per le risorse, **oppure** migrare tutto su CloudWatch.
- **laif-cli = AWS imperativo** (705 righe boto3 fuori da CloudFormation): crea utenti IAM, certificati,
  secret, key-pair a mano → è la causa del drift e del bisogno di `wipeout`. Rendere tutto CDK-owned
  elimina `wipeout` e gran parte di `init project/infra`.
- **8 responsabilità da ricollocare** nel kill di laif-cli/deployer (tabella in `analisi/02` §6); solo
  3 hanno valore non banale: monitoring LCP, glue DNS/cert post-deploy, richiesta cert ACM.

---

## Dettaglio fasi previste

### Fase A — Sintesi & baseline
- `sintesi/00-findings.md` — problemi → cause radice → priorità (consolidamento dei 9 doc, niente nuova esplorazione costosa: si legge l'analisi già fatta).
- `sintesi/01-baseline-costi.md` — fotografia costi attuale per categoria/cliente, base per le stime di risparmio.
- (eventuale) mini-verifica AWS read-only solo se emergono buchi.

### Fase B — Catalogo interventi
- `interventi/quick-wins.md` — interventi a basso sforzo orientati al **risparmio** (con € stimati/mese ed effort).
- `interventi/catalogo-interventi.md` — tutti gli interventi classificati piccolo/medio/grande con: beneficio, effort, risparmio €, guadagno in monitoring/sicurezza/semplificazione.

### Fase C — Architettura target
- `design/architettura-target.md` — visione della nuova infra (moduli, networking, monitoring, task/ETL, scaling on/off).
- `design/moduli-cdk.md` — inventario dei moduli della nuova libreria (RDS, S3, backend ECS, frontend, monitoring, tasks) + schema di configurazione YAML.
- `design/repo-strategy.md` — repo infra per-cliente vs infra-in-progetto, gestione del vincolo "1 infra + 2 progetti", cosa si tiene (laif-dns) / cosa si elimina (laif-cli, laif-deployer).

### Fase D — Roadmap migrazione
- `design/roadmap-migrazione.md` — sequenza interventi, milestone, rischi, criteri di rollback, pilota.

### Fase E — Presentazione
- `presentazione/index.html` — presentazione navigabile con diagrammi (architettura as-is/to-be, costi, before/after), dalle quick win alla migrazione totale.

---

## Decisioni prese (decision log del progetto)
- **2026-06-11 (Fase A)**: baseline costi confermata via Cost Explorer live. Run-rate **~3.320 $/mese**
  (≈39.700 $/anno), stabile. Fattura azzerata da crediti AWS dal 2026-05. Tetto di risparmio: quick win
  −900/−1.300 $/mese (27-40%) + consolidamento −700/−1.200 $/mese. Dettaglio in `sintesi/01-baseline-costi.md`.
- **2026-06-11 (Fase A)**: tesi consolidata = "un solo problema ripetuto 24 volte" (flotta clonata da
  laif-cdk con default rotti). Si corregge alla fonte. Findings in `sintesi/00-findings.md`.
- **2026-06-11 (Fase B)**: 47 interventi catalogati (workflow 6 agenti per area), 20 quick win.
  Risparmio **riconciliato** (anti doppio-conteggio): quick win −900/−1.300 $/mese + consolidamento
  −700/−1.200 $/mese; IPv4 contato una volta (overlap COST-IPV4↔NETSEC-01); single-account a parte
  (SFTP 110-223, CociProd 90-200). Output: `interventi/quick-wins.md`, `interventi/catalogo-interventi.md`.
  Nota: 4 agenti su 6 falliti al 1° giro per errori socket transitori → ri-lanciati in batch da 2 con retry.
- **2026-06-11 (Fase C)**: progettata la nuova libreria **`laif_infra`** (8 moduli: NET/DATA/COMPUTE/EDGE/
  OBS/JOBS + CONFIG + tooling) via workflow (8 agenti, batch da 2). Decisioni di design chiave:
  (a) **repo strategy = infra DENTRO la repo di progetto** (`laif.yaml` in root), non più `<cliente>-infra`
  separata; il caso N-app/1-account si risolve con `apps:[]`. (b) **egress = interface endpoints per-account**
  (no NAT condiviso, coerente con isolamento). (c) **monitoring = CloudWatch→SNS→endpoint ingest Wolico**
  (push per-account; contratto endpoint da concordare col team Wolico). (d) **migrazione di rete = REPLACE/
  cutover** (snapshot RDS + swap DNS), non in-place; i clienti nuovi nascono già sul target.
  (e) default `laif_infra.source=codeartifact` (pin obbligatorio). Output: `design/architettura-target.md`,
  `design/moduli-cdk.md`, `design/repo-strategy.md`. Domande aperte trasversali in `design/moduli-cdk.md` §finale.
- **2026-06-11 (Fase D)**: roadmap a 5 fasi (Quick win → Fondamenta → Pilota → Rollout → Pulizia), con
  sequenza vincolante, registro rischi e valore cumulato. Pilota = Casartelli (day-zero) + Nivi (validazione
  monitoring). Output: `design/roadmap-migrazione.md`.

## Decisioni strategiche — SCIOLTE da Simone (2026-06-11, GATE C)
1. **Modello account/rete → MANTENERE L'ISOLAMENTO degli account cliente.** Niente consolidamento VPC.
   → il bucket "consolidamento −700/−1.200 $/mese" **esce dal tavolo**; il risparmio resta quello delle
   quick win (−900/−1.300) + IP privati + RI/SP. **Conseguenza di design**: l'egress delle subnet private
   si fa con **interface endpoints per-account** (ECR/Logs/Secrets/SSM/STS), NON con NAT condiviso (che
   richiederebbe consolidamento). RDS in `PRIVATE_ISOLATED` (no egress). Il vincolo "1 infra ↔ 2 app"
   (crif/prima-power/laif) si risolve con la lista `apps` nello stesso account, non con account condivisi.
2. **Monitoring → arricchire WOLICO, NON Checkmk.** Checkmk/LCP è un **rimasuglio mai usato** (morto):
   si può **eliminare pulito** → sparisce l'orfano #8 di TOOL-02. Il monitoring reale delle app passa oggi
   **solo da Wolico** (error-reporting). Target: **CloudWatch (metriche/alarm white-box: CPU/RAM/disco/RDS)
   → alimenta/arricchisce Wolico** come hub di monitoring. Le decisioni MON-07/MON-08 del catalogo
   (entrambe incentrate su Checkmk) sono **SUPERATE**: vedi il nuovo design monitoring in Fase C.
3. **Tooling → convergere su `laif` (laif-factory) sul NUOVO CDK**, eliminando laif-cli/deployer,
   tenendo laif-dns (da rendere modulare). `lcp` si elimina (Checkmk morto). [confermato]

## Decisioni esecuzione (2026-06-11)
- **Fix Nivi**: branch+PR pronti (laif-cdk#16, nivi-infra#1). Da deployare Simone su nivi-prod. desired_count=1.
- **WAF → NON si accende.** Simone non lo vuole per costo (~10-12 $/mese/account: ACL 5 $ + ~6 regole + richieste;
  ~250-300 $/mese se su tutta la flotta). Resta lo stato attuale (0/24). In **laif-infra-v2** il WAF è
  **opt-in (default OFF)**, non default-on (corregge la proposta iniziale del design).
- **Nome nuova libreria → `laif-infra-v2`** (per ora). `laif_infra`/`laif-infra` è già preso (infra interna).

## Domande aperte residue
- Per i **dev**: l'isolamento per-account vale anche per gli ambienti dev, o lì si può alleggerire?
  (impatta il floor dev). Da confermare se emerge in Fase C/D. Default assunto: isolamento anche dev.

## Note di ripartenza
Per riprendere: apri questo file → individua la prima fase `TODO` o `IN CORSO` → leggi gli output già
prodotti delle fasi precedenti (cartelle indicate) → continua. Non rifare esplorazione AWS/repo se
l'informazione è già nei doc di `analisi/` o `sintesi/`.
