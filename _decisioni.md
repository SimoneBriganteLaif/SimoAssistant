# Decision Log

> Registro **trasversale** delle decisioni chiave (datate, con progetto/area). Diverso da `_log.md` (che traccia le modifiche alla KB). Append-only; il dettaglio sta nelle note collegate.

## 2026-06 (giugno)
- **[Casartelli]** Team operativo iniziale: **Simone + Luca** ([[Dmitry Babich]] è solo sales); per la parte GenAI/KB entrerà **Carlo o Tancredi** (orientamento su Carlo, deciso il 10/06 di rinviare la scelta). → [[Casartelli — Industrial Knowledge]]
- **[Jubatus]** Refactor del data model (10/06): via `Recipients`/`Contacts`/`Mailbox`, categorie sulle singole mail, fusione in `Customer`; nessun dato in prod, si ricrea tutto. → [[Jubatus — Supporto sviluppo]]
- **[Sebi Group]** Nuovo prospect: design già venduto; ora in vendita estrazione email (Simone la fa in background) + app (non ancora comprata); puntare al contratto unico. → [[Sebi Group — Acquisizione database/mailing e app export]]
- **[Lamonea]** Deploy in produzione (mai fatto prima) target 11/06; chiusura obiettivo interno **fine giugno**; scope congelato (no B2B/Amazon). → [[Lamonea — Gestionale / CRM]]
- **[Jubatus/Ubatus]** Il cliente gestirà invio+ricezione mail su **AWS SES** → pipeline mail da adattare. → [[Jubatus — Supporto sviluppo]]
- **[Umbra]** Promozioni WoW = supporto decisionale (no AI che decide); i dati restano su AS400. → [[Umbra — Improvement recommender e modulo marketing]]
- **[Organizzazione]** Staffing del lunedì → ~7 **meeting di progetto individuali** (esperimento). → [[Modo di lavorare — call 1:1 verticali per progetto]]
- **[Organizzazione]** Economics individuali congelati fino a **metà 2027**; valutato un **team stack interno** (2 FTE da agosto). → [[Piano assunzioni e sistema premi 2026-2027]], [[LAIF Tech Stack]]
- **[Prima]** Simone resta **volutamente defilato** (conoscere, non gestire). → [[Prima Industrie — Virtual Assistant]]

## 2026-05 (maggio)
- **[Nivi]** Dedup email: chiave **Body+Sender+Subject** (data esclusa), **hard delete** (no soft delete). → [[Nivi — Automazione Risposta Mail]]
- **[Prima / Laif Agent]** Niente RAG classico: agente con **grep su markdown**; router **OpenRouter** (+Bedrock), **Anthropic Agent SDK**, **LifeParser**, **LogFire**. → [[Laif Agent]]
- **[Andriani]** Tutte le fonti d'ordine → **un'unica entità ordine**; niente "duplica ordine". OCF legato al brand Felicia. → [[Andriani — Automazione ordini]]
- **[Knowledge]** Architettura conoscenza di progetto a 3 livelli (raw→preprocess→processed) gestita da **Merlino**. → [[Merlino]]
- **[Laif Factory]** La CLI `laif` sostituisce **Just**; non creare un agente per dominio; `/report`→DB Notion. → [[Laif Factory]]
- **[Organizzazione]** Budget fisso a inizio anno, **target rivisto trimestralmente**; obiettivi 2M€ (2026) / 3M€ (2027). → [[Obiettivi di crescita LAIF 2026-2027]]
