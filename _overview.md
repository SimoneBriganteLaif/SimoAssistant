# Overview — stato operativo

> Pagina di **sintesi viva** (stile wiki): da cui partire per "fare il segretario". Aggiornare quando cambiano stati/scadenze. Ultimo aggiornamento: **2026-06-15**.
> Le schede di dettaglio stanno in `note/`; le decisioni chiave in `_decisioni.md`.

## Scadenze imminenti (giugno-luglio 2026)
### Settimana 15-21/06
- **Lun 15/06** — update interni (staffing).
- **Mar 16/06** — **trasferta on-site [[Nivi — Automazione Risposta Mail]] a Firenze** (Simone + Federico, forse Mordenti); upsell rifacimento software + dashboard.
- **Mer 17/06** — **PM "la quadra"** (tutto il giorno); demo in sede [[Andriani — Automazione ordini]] (~15 agenti).
- **Gio 18/06** — **SAL [[Lamonea — Gestionale / CRM]]** col cliente; **SAL [[Andriani — Automazione ordini]]**; presentazione **PM** ("Sharing Knowledge: Project Management", Pinelli).
- **Ven 19/06** — **call WoW [[Umbra — Improvement recommender e modulo marketing]]** (confermata, con Bezzi + Olivanti; se i dati non arrivano → stop sviluppi); staffing.
### Oltre
- **30/06** — **incontro [[Casartelli — Industrial Knowledge]] IN SEDE a Lecco** (calendar già inviato dal cliente).
- **2/07** — milestone [[CRIF — Supporto Team Silvia 2026]]: nuove viste **Power BI** (Daniele).
- **25-28/06** — **team building** LAIF (poco impattante sul lavoro, ma blocca le agende).
- **fine giugno** — go/no-go [[Prima Industrie — Virtual Assistant]]; estrazione dati [[Sebi Group]]; passaggio consegne Bonfiglioli.

## Progetti attivi del Team Blue
| Progetto | Chi | Stato (giu 2026) |
|---|---|---|
| [[Andriani — Automazione ordini]] | [[Lorenzo Monni]] (FE+ETL, **ferie 8-19/07**), [[Tancredi Bosi]] (parsing) | **Funzionalità pronte**, manca solo test/validazione ma **il cliente non testa** → sessioni guidate + possibile trasferta Puglia; **MFA depriorizzato** (SSO c'è già, probabile no); demo in sede mer 17/06 |
| [[Bonfiglioli Consulting — Pianificazione carico team]] | [[Lorenzo Tonetta]], [[Davide Leonescu]] (ora ufficiale in Team Blue) | D-CAP; Leonescu operativo con Tonetta; Simone attivo su FE/BE/ETL |
| [[Lamonea — Gestionale / CRM]] | [[Luca Stendardo]] (+ [[Mattia Gualandi]] magazzino) | **LIVE in produzione dal 12/06** (`lamonea.app`); release parziale + go-live anticipato (avallato Vita); ~7k preventivi importati; **SAL 18/06**; poi Luca → Casartelli |
| [[Nivi — Automazione Risposta Mail]] | [[Federico Frasca]], [[Tancredi Bosi]] | Pronto per il live; **on-site Firenze 16/06**; in ballo **contratto più grande (rifacimento software)** + dashboard/evolutive |
| [[Jubatus — Supporto sviluppo]] | [[Federico Frasca]] (+ Simone su infra) | Pipeline deployata in DEV (9/06); refactor data model; blocco permessi S3 (Jonathan); SES+PROD target 19/06 |
| [[Phoenix — Knowledge Base]] | [[Federico Frasca]], [[Tancredi Bosi]], [[Marco Pinelli]] | Silente nel periodo 8-10/06 |
| [[CRIF — Supporto Team Silvia 2026]] | [[Daniele Dalle Nogare]] (data), [[Tancredi Bosi]], [[Matteo Scalabrini]] (100%), [[Lorenzo Tonetta]] (tech lead) | **Tonetta tech lead** (~30-40%, 3 mesi); Daniele milestone **Power BI 2/07**; **Gualandi rischio non-rinnovo**; in espansione (60-70k€); **[[Lorenzo Monni]] in ferie 8-19/07 e possibile avvio su CRIF** |
| [[Umbra — Improvement recommender e modulo marketing]] | [[Daniele Dalle Nogare]] | **Fatturazione 18k slitta a Q3** (dati lenti); **call WoW confermata 19/06** (se dati non arrivano → stop sviluppi); approccio criteri-non-modello |
| [[Casartelli — Industrial Knowledge]] | [[Luca Stendardo]] (full-stack) + Simone (TL/delivery), [[Marco Vita]] (coord.), [[Dmitry Babich]] (sales, pre-sales/requisiti); GenAI [[Tancredi Bosi]] (volontario) | **Contratto FIRMATO** (25k+8k) → attivo; dati via SFTP (CSV SAP) + NAS/PDM; SSO Azure AD/user-pwd; **incontro Lecco 30/06** |
| [[Prima Industrie — Virtual Assistant]] | TL [[Marco Pinelli]], op. [[Carlo Venditti]] (+ [[Cristiano Piscioneri]]) | Scope diverge da contratto → contenimento; Edward fermo da ~1 mese; demo locale 11/06, accesso utenti da lun; **go/no-go fine giugno**; spinta Vita su Bedrock |
| [[Albini & Castelli — Gestione cantieri]] | Simone | Cliente riattivo (8/06): 3 segnalazioni, fix margine % già committato |
| [[Benozzi — Preventivatore]] | Simone (TL) | Manutenzione / passaggio consegne; migrazione AWS→GCP (cliente); **ETL da API Galileo ferma dal 12/06** (alert Wolico); canone scade a settembre |
| [[Sebi Group — Acquisizione database/mailing e app export]] | Simone (estrazione, in background); lead [[Roberto Bonetti]] (sales) | Estrazione ~9k mail in corso **senza contratto**; **nessun lavoro del team fino a firma**; si vende il progetto completo |

## Stack interno (priorità di Simone)
[[LAIF Tech Stack]] = ombrello `laif-*`: [[Laif Factory]] (CLI `laif`, agenti, skill, eval; skill `/squad`), [[Laif Agent]] (su Bedrock/OpenRouter), [[Merlino]] (knowledge), [[Wolico]] (portale — in arrivo pagina "Progetti" con canoni a rischio e flag attivo). **Team stack interno** in gestazione (2 FTE da ~agosto, Carlo candidato); nuovo meeting ricorrente "Team Stack Interno" dal 10/06.

## Chi-fa-cosa (Team Blue)
- **[[Simone Brigante]]** — TL/PM su tutto; operativo su Bonfiglioli, Casartelli, Jubatus (infra/deploy), Benozzi (manutenzione) e estrazione Sebi; **focus su Laif Factory/Merlino**; defilato su Prima.
- **[[Federico Frasca]]** — UX/FE: Nivi, Jubatus, Phoenix.
- **[[Luca Stendardo]]** — Lamonea (gestione operativa post go-live) → poi Casartelli (full-stack).
- **[[Lorenzo Tonetta]]** — Bonfiglioli + **tech lead CRIF** (~30-40%) + stack interno (2 gg/sett).
- **[[Tancredi Bosi]]** — CRIF + Andriani (parsing) + Nivi + eventualmente Casartelli (GenAI, orientamento attuale su di lui).
- **[[Carlo Venditti]]** — Prima Industrie + stack interno (candidato team dedicato); eventualmente Casartelli.
- **[[Daniele Dalle Nogare]]** — Umbra + CRIF (Data Analyst).
- **[[Davide Leonescu]]** — Bonfiglioli (junior, pomeriggi; ora anche su Tailscale/DWH).
