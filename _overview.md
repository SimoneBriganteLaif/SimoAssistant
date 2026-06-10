# Overview — stato operativo

> Pagina di **sintesi viva** (stile wiki): da cui partire per "fare il segretario". Aggiornare quando cambiano stati/scadenze. Ultimo aggiornamento: **2026-06-09**.
> Le schede di dettaglio stanno in `note/`; le decisioni chiave in `_decisioni.md`.

## Scadenze imminenti (giugno 2026)
- **10/06** — kick-off interno [[Casartelli — Industrial Knowledge]].
- **11/06** — deploy produzione [[Lamonea — Gestionale / CRM]] + call cliente; kick-off cliente Casartelli.
- **15-17/06** — UAT [[Prima Industrie — Virtual Assistant]].
- **16/06** — sessione WoW [[Umbra — Improvement recommender e modulo marketing]] (Alessandra); team building a Bologna (Simone assente, evento a Roma).
- **16-18/06** — trasferta [[Nivi — Automazione Risposta Mail]] (Federico).
- **~18/06** — presentazione **PM & Staffing** (Simone + [[Davide Miani]] + [[Francesco Barbanti]]); Simone assente 18-19.
- **fine giugno** — chiusura Lamonea (obiettivo interno); fatturazione Umbra ~40k€; tranche Andriani; passaggio consegne Bonfiglioli.

## Progetti attivi del Team Blue
| Progetto | Chi | Stato (giu 2026) |
|---|---|---|
| [[Andriani — Automazione ordini]] | [[Lorenzo Monni]] (FE+ETL), [[Tancredi Bosi]] (parsing) | Wizard ok; ETL bloccato dalle API ARCA; parsing PDF in modalità interattiva; inserimento da agenti in test |
| [[Bonfiglioli Consulting — Pianificazione carico team]] | [[Lorenzo Tonetta]], [[Davide Leonescu]] | D-CAP, 38gg/5; chiusura a settembre |
| [[Lamonea — Gestionale / CRM]] | [[Luca Stendardo]] (+ [[Mattia Gualandi]] magazzino) | Deploy prod 11/06; chiusura obiettivo fine giugno; ETL a livelli |
| [[Nivi — Automazione Risposta Mail]] | [[Federico Frasca]], [[Tancredi Bosi]] | App "Live Pro"; dedup fatta; migrazione PST; concessioni autostradali |
| [[Jubatus — Supporto sviluppo]] | [[Federico Frasca]] | Invio+ricezione mail su AWS SES; progetto "palestra" di Federico |
| [[Phoenix — Knowledge Base]] | [[Federico Frasca]], [[Tancredi Bosi]], [[Marco Pinelli]] | DS PR, refactor chat, upstream→"Svitla" |
| [[CRIF — Supporto Team Silvia 2026]] | [[Daniele Dalle Nogare]] (data), [[Tancredi Bosi]], [[Matteo Scalabrini]] (100%) | In espansione (60-70k€); filone Tancredi quasi chiuso |
| [[Umbra — Improvement recommender e modulo marketing]] | [[Daniele Dalle Nogare]] | WoW + Budget Fornitore; fatturazione ~40k€ giugno |
| [[Casartelli — Industrial Knowledge]] | Simone + [[Luca Stendardo]] (+ Tancredi spot) | Pilot, acciaieria Lecco; kick-off 10-11/06 |
| [[Prima Industrie — Virtual Assistant]] | TL [[Marco Pinelli]], op. [[Carlo Venditti]] | UAT 15-17/06; Simone volutamente defilato |
| [[Albini & Castelli — Gestione cantieri]] | Simone | In manutenzione |

## Stack interno (priorità di Simone)
[[LAIF Tech Stack]] = ombrello `laif-*`: [[Laif Factory]] (CLI `laif`, agenti, skill, eval; skill `/squad`), [[Laif Agent]] (su Bedrock/OpenRouter), [[Merlino]] (knowledge), [[Wolico]] (portale). In valutazione un **team stack interno** (2 FTE da agosto).

## Chi-fa-cosa (Team Blue)
- **[[Simone Brigante]]** — TL/PM su tutto; operativo su Bonfiglioli e Casartelli; **focus su Life Factory**; defilato su Prima.
- **[[Federico Frasca]]** — UX/FE: Nivi, Jubatus, Phoenix.
- **[[Luca Stendardo]]** — full-time Lamonea → poi Casartelli.
- **[[Tancredi Bosi]]** — CRIF + Andriani (parsing) + Nivi + Casartelli (spot).
- **[[Carlo Venditti]]** — Prima Industrie + stack interno.
- **[[Daniele Dalle Nogare]]** — Umbra + CRIF (Data Analyst).
- **[[Davide Leonescu]]** — Bonfiglioli (junior, pomeriggi).
