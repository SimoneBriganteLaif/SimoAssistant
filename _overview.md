# Overview — stato operativo

> Pagina di **sintesi viva** (stile wiki): da cui partire per "fare il segretario". Aggiornare quando cambiano stati/scadenze. Ultimo aggiornamento: **2026-06-10**.
> Le schede di dettaglio stanno in `note/`; le decisioni chiave in `_decisioni.md`.

## Scadenze imminenti (giugno 2026)
- **11/06** — deploy produzione [[Lamonea — Gestionale / CRM]] + SAL con Mathias Lamonea (congelamento scope); **kick-off cliente [[Casartelli — Industrial Knowledge]]** (Teams); review staffing Team Blue.
- **12/06** — SAL [[Andriani — Automazione ordini]] (divergenze gamme/listini ARCA); recap status Nivi + lista upsell.
- **16/06** — giornata on-site [[Nivi — Automazione Risposta Mail]] a Firenze (Simone, Mordenti, Federico) — upsell dashboard KPI.
- **19/06** — probabile allineamento WoW [[Umbra — Improvement recommender e modulo marketing]] (da confermare; rischio stallo da evitare — niente slittamento a luglio).
- **18/06** — "Sharing Knowledge: Project Management" (Pinelli, tutta LAIF); 1:1 Mordenti "Notion, progetti e CRM — cosa ne resta?"; presentazione **PM & Staffing** in zona.
- **~19/06** — Jubatus: invio mail AWS SES + deploy PROD (target).
- **22-23/06** — visita on-site Casartelli a **Lecco**; **UAT interno Prima** (settimana del 22), poi apertura agli utenti esterni.
- **25-28/06** — **team building** LAIF (poco impattante sul lavoro, ma blocca le agende).
- **fine giugno** — chiusura Lamonea (obiettivo interno); estrazione dati [[Sebi Group]]; fatturazione Umbra; tranche Andriani; passaggio consegne Bonfiglioli.

## Progetti attivi del Team Blue
| Progetto | Chi | Stato (giu 2026) |
|---|---|---|
| [[Andriani — Automazione ordini]] | [[Lorenzo Monni]] (FE+ETL), [[Tancredi Bosi]] (parsing) | Rilasciata "Gestisci Gamme" (10/06); divergenze dati ARCA al SAL 12/06; ETL ancora bloccato dalle API ARCA |
| [[Bonfiglioli Consulting — Pianificazione carico team]] | [[Lorenzo Tonetta]], [[Davide Leonescu]] | D-CAP, ~14,5gg/38 consuntivate; Leonescu operativo (Tailscale/DWH); Simone molto attivo su FE/BE/ETL |
| [[Lamonea — Gestionale / CRM]] | [[Luca Stendardo]] (+ [[Mattia Gualandi]] magazzino) | Rilasciata scrittura su 3 ditte (8/06); deploy prod + SAL scope-freeze 11/06; chiusura obiettivo fine giugno |
| [[Nivi — Automazione Risposta Mail]] | [[Federico Frasca]], [[Tancredi Bosi]] | Tecnicamente pronto per il live; ticket #17 mail mancanti; on-site Firenze 16/06 + upsell dashboard |
| [[Jubatus — Supporto sviluppo]] | [[Federico Frasca]] (+ Simone su infra) | Pipeline deployata in DEV (9/06); refactor data model; blocco permessi S3 (Jonathan); SES+PROD target 19/06 |
| [[Phoenix — Knowledge Base]] | [[Federico Frasca]], [[Tancredi Bosi]], [[Marco Pinelli]] | Silente nel periodo 8-10/06 |
| [[CRIF — Supporto Team Silvia 2026]] | [[Daniele Dalle Nogare]] (data), [[Tancredi Bosi]], [[Matteo Scalabrini]] (100%) | Silente nel periodo; in espansione (60-70k€) |
| [[Umbra — Improvement recommender e modulo marketing]] | [[Daniele Dalle Nogare]] | Incidente ETL risolto (8/06); allineamento WoW probabile 19/06 (stallo da evitare); import dati fornitori in corso |
| [[Casartelli — Industrial Knowledge]] | [[Luca Stendardo]] (lead op.) + Simone (TL); GenAI [[Carlo Venditti]] o [[Tancredi Bosi]] (orient. Tancredi, fra qualche settimana) | Kick-off interno 10/06 + cliente 11/06; requisiti entro metà luglio; visita Lecco sett. 22-23; primo rilascio settembre |
| [[Prima Industrie — Virtual Assistant]] | TL [[Marco Pinelli]] (in ferie fino ~15/06), op. [[Carlo Venditti]] | Bedrock sbloccato solo parzialmente (10/06); dati PST via Volos (Europa/Cina ok, USA in arrivo); UAT interno sett. 22 → poi esterni |
| [[Albini & Castelli — Gestione cantieri]] | Simone | Cliente riattivo (8/06): 3 segnalazioni, fix margine % già committato |
| [[Sebi Group — Acquisizione database/mailing e app export]] | Simone (estrazione, in background); lead [[Roberto Bonetti]] | Pre-sales: estrazione email entro fine giugno; app proposta ma non ancora comprata |

## Stack interno (priorità di Simone)
[[LAIF Tech Stack]] = ombrello `laif-*`: [[Laif Factory]] (CLI `laif`, agenti, skill, eval; skill `/squad`), [[Laif Agent]] (su Bedrock/OpenRouter), [[Merlino]] (knowledge), [[Wolico]] (portale — in arrivo pagina "Progetti" con canoni a rischio e flag attivo). **Team stack interno** in gestazione (2 FTE da ~agosto, Carlo candidato); nuovo meeting ricorrente "Team Stack Interno" dal 10/06.

## Chi-fa-cosa (Team Blue)
- **[[Simone Brigante]]** — TL/PM su tutto; operativo su Bonfiglioli, Casartelli, Jubatus (infra/deploy) e estrazione Sebi; **focus su Laif Factory/Merlino**; defilato su Prima.
- **[[Federico Frasca]]** — UX/FE: Nivi, Jubatus, Phoenix.
- **[[Luca Stendardo]]** — full-time Lamonea → poi Casartelli.
- **[[Tancredi Bosi]]** — CRIF + Andriani (parsing) + Nivi + eventualmente Casartelli (GenAI, orientamento attuale su di lui).
- **[[Carlo Venditti]]** — Prima Industrie + stack interno (candidato team dedicato); eventualmente Casartelli.
- **[[Daniele Dalle Nogare]]** — Umbra + CRIF (Data Analyst).
- **[[Davide Leonescu]]** — Bonfiglioli (junior, pomeriggi; ora anche su Tailscale/DWH).
