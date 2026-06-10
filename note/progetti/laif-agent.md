---
titolo: Laif Agent
id: laif-agent
tipo: progetto
tag: [lavoro, laif, interno]
stato: attivo
creato: 2026-06-09
aggiornato: 2026-06-09
fonti: ["approfondimento riunioni 13/05 e 19/05 'Architettura Life Agent' (Notion) 2026-06-09"]
correlati:
  - "[[LAIF Tech Stack]]"
  - "[[Laif Factory]]"
  - "[[Carlo Venditti]]"
  - "[[Marco Pinelli]]"
  - "[[Prima Industrie — Virtual Assistant]]"
  - "[[Simone Brigante]]"
---

# Laif Agent

Iniziativa interna LAIF: lo **stack standard per chatbot + agente su documenti** da vendere ai clienti (citato anche "Life/Live Agent"). A maggio 2026 è in **design**: l'obiettivo è una **linea guida** (best practice + reference implementation) — non una libreria Python centralizzata. Owner: [[Carlo Venditti]] + Cristiano Piscioneri; product/coordinamento [[Marco Pinelli]] / Simone. Reference implementation candidata: [[Prima Industrie — Virtual Assistant]]. Da non confondere con **Merlino** (agente *knowledge*).

## Architettura (decisioni 19/05)
- **Ingestione**: file raw su S3 → versione testuale dettagliata (con pagine/diagrammi) → versione super-riassunta per ricerca veloce. "Battezzare" i file in una struttura cartelle fissa in markdown.
- **Inferenza**: agente con file system virtualizzato + ricerche **grep** sulla rappresentazione testuale (logica "Claude Code in cloud"), non sola RAG.
- **Router modelli**: **OpenRouter** come router principale (al posto di OpenAI), con fallback su **Bedrock**. Architettura a "blocchettini" intercambiabili (modello / metodo di parsing selezionabili).
- **Libreria agentica**: **Anthropic Agent SDK** (un solo agente, niente multi-agente). **Managed Agents Anthropic scartati** (troppo costosi: modelli cari + ~9¢/min a sessione).
- **Parsing**: layer custom interno **LifeParser** (repo separato, per tutti i progetti) per resilienza vs lock-in Bedrock; **Bedrock Data Automation** valutato ma costoso.
- **Observability**: **LogFire** (trace di tool, ragionamenti, stack).
- **Infra AWS**: Front-end → S3 → SQS → Lambda → DynamoDB (processamento asincrono); aggiornare il **CDK**.
- **Data model standard**: conversazioni, feedback (+interazioni), notifiche, knowledge base.
- **UAT**: non in-app ma come **skill di Claude** (legge il DB conversazioni, raggruppa domande, autogenera test/score).

## Repo
- **LifeParser** — libreria di estrazione testuale (separata).
- **LifeAgent** — repo dei componenti dell'agente (chat, sessioni, feedback, gestione mail, tool grep/grafici).
- Eredità tecnica da **AmmaGamma** (PyPI interno, health-check). Vincolo: servizi in **Europa**.

## Deliverable
- Documento markdown di linee guida ("stele di Rosetta") da mettere nella wiki di [[Laif Factory]] — target **fine maggio 2026**.
