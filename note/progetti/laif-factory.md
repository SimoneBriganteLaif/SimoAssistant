---
titolo: Laif Factory
id: laif-factory
tipo: progetto
tag: [lavoro, laif, interno]
stato: attivo
creato: 2026-06-09
aggiornato: 2026-06-09
fonti: ["approfondimento riunione 12/05 'Presentazione Laif Factory e Demo' (Notion) 2026-06-09"]
correlati:
  - "[[LAIF Tech Stack]]"
  - "[[Laif Agent]]"
  - "[[Carlo Venditti]]"
  - "[[Simone Brigante]]"
---

# Laif Factory

Mono-repo aziendale (`laif-factory`) che consolida gli strumenti AI interni. Presentato in demo il **12/05/2026**.

## Contenuto del repo
- **SuperCLI `laif`** (Python) — entrypoint degli agenti; comandi tipo `laif update`, `/report`, `/issue`, `just eval run <skill>`. Sostituisce gradualmente **Just** nei template. CLI sviluppata da [[Carlo Venditti]].
- **agents/** — agenti su Claude Code.
- **skills/** — skill distribuite ai progetti via **symlink** (ogni progetto si aggiorna in automatico); le custom vanno nel `.claude` del progetto o globale dell'utente.
- **wiki/** — knowledge base (WIP).
- **eval/** — sistema di valutazione + auto-improve.

## Agenti principali
- **[[Merlino]]** — agente *knowledge*: da trascrizioni/email organizza la conoscenza di progetto (`core_knowledge`) e genera minute per i clienti.
- **Sherlock Holmes** — caccia e risolve bug.
- **Steve Jobs** — UX designer (regole su UI, anti-pattern estetici).
- **Meta-updater** — aggiorna agenti/skill agli standard; ha generato gli altri agenti e la skill SkillCreator.
- **Benchmark** — genera benchmark per affinare le skill (resta nel repo eval, non distribuito ai progetti).

## Sistema eval / auto-improve
`just eval run <skill>` lancia la skill su benchmark in ambiente pulito → scoring. L'**improver** fa fino a **3 round**: il Meta-updater modifica la SKILL.md sui fallimenti, ritesta, tiene il candidato solo se migliora. `/report` alimenta i benchmark partendo dai problemi reali segnalati dal team.

## Note di adozione
- Piattaforma di riferimento: **Claude Code** (poi Codex/altre).
- Best practice: `/clear` a ogni nuovo task; la qualità degrada oltre ~50% di contesto.
- Modalità sperimentale **Agent Teams** (più agenti con to-do list comune) per task medio-complessi.
- **Direzione (mag 2026)**: disaccoppiare l'aggiornamento di agenti/skill/knowledge (e del file di search) **dallo strumento di coding**, per restare allineati con qualunque tool — Claude Code, **CloudAgents** (Agent Teams), Codex, o l'IDE esterno **Orca** in valutazione.
- **Orchestrazione agenti**: il main non triggera sempre i sub-agenti (~50%) → **chiamarli esplicitamente**; il main delega il codice all'agente specializzato. `/report` (→ DB Notion) alimenta il miglioramento continuo; un **pre-hook** blocca branch/commit non richiesti dai sub-agenti.
- **Principio**: non creare un agente per dominio — integrare le nuove skill negli agenti esistenti (no proliferazione). Gli esempi di codice stanno nelle skill, **non** committati nel template. **Chrome MCP** per test/mockup live nel browser.
- **"Ocean"** — sistema task interno in arrivo (i task generati da [[Merlino]] vi confluiranno; oggi si usa Notion).
- **Skill recenti**: **`/squad`** (+`/goal`, di [[Carlo Venditti]]) — orchestratore che porta un task dal prompt al rilascio in dev con CI/CD, test e screenshot; **LifeFab Connect** (credenziali/API local-dev-prod) e **Release** in arrivo; **DB Connect** (di Davide Miani). Le nuove skill passano dal benchmarker **"Lori"** prima di entrare.
