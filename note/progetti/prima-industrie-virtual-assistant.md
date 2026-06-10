---
titolo: Prima Industrie — Virtual Assistant
id: prima-industrie-virtual-assistant
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["scoperta 2026-06-08 (Outlook/Notion)", "intervista 2026-06-08", "approfondimento riunioni 18-19/05 (Notion) 2026-06-09"]
correlati:
  - "[[Prima Industrie]]"
  - "[[Marco Pinelli]]"
  - "[[Carlo Venditti]]"
  - "[[Simone Brigante]]"
  - "[[Laif Agent]]"
---

# Prima Industrie — Virtual Assistant

- **Cliente**: [[Prima Industrie]] (Primapower) — multinazionale (management USA / finlandese / italiano)
- **Team leader**: [[Marco Pinelli]]
- **Operativi**: [[Carlo Venditti]] (infra/AWS). [[Simone Brigante]] coinvolto ma **volutamente defilato** (vuole conoscere, non gestire), in ottica [[Laif Agent]]
- **Nome progetto**: *Virtual Assistant* (il nome vero). Prosegue la POC **PrimaPilot** (fatta da [[Tancredi Bosi]] + Pinelli su OpenAI/GPT-4 + RAG), ora da rifare da zero.
- **Repo**: `prima-power`, `prima-power-infra`
- **Nota**: progetto *cross-team* (TL Pinelli, operativo del Team Blue). Funzionalità (gestione feedback, filtri reparto/macchina, tag documenti) migrate da [[Phoenix — Knowledge Base]]. *(Esiste anche un altro progetto Prima seguito in passato da Simone con [[Francesco Barbanti]] — per ora fuori scope.)*

## Obiettivo
Assistente virtuale / knowledge assistant su **~1,5 TB di documenti (~300.000 file)**, con integrazioni **Jira** e **PST** (e gestionale **Volos** per listini/ricambi). Use case principale: **manutenzione macchine** (storico interventi, garanzie, replicare soluzioni tra siti, es. Cina→altra sede).

## Approccio tecnico (mag 2026)
- **Niente RAG/vector search tradizionale**: agente *tool-based* che fa **grep/regex** su una rappresentazione testuale (markdown) dei documenti — logica "Claude Code su un file system virtualizzato".
- **Filtro obbligatorio reparto+macchina** all'avvio della conversazione (no domande "sullo scibile").
- Architettura **2 bucket S3**: raw originale (intoccabile) + bucket processati; nuovi file confluiscono via back-end.
- Pipeline: bucket di **staging** → unzip in batch (stima ~1 giorno su EC2) → analisi → dedup → conversione PDF selezionati in markdown.
- Replicare Jira/PST su DB proprietari ed esporre tool per query SQL.
- Reference implementation di [[Laif Agent]]; estrazione testuale via **LifeParser**.

## Volumi (rilevati 19/05)
- **5.703 zip, ~400 GB** compressi → stima **2-3 TB** dopo unzip. 300k+ PDF, 37 GB schemi elettrici, 11 GB manuali; presenza di duplicati, foto personali, file in russo/finlandese/cinese.
- **Costo parsing**: Bedrock Data Automation ~$0.01/pagina → potenziale **>$30.000** per processare tutto → discutere col cliente. Tema commerciale aperto: volumi/complessità da grande azienda con pricing da PMI.

## Pipeline documenti & UAT (05/06)
- Parsing su **EC2** (~20 min): ~**17.000 file** processati, solo ~41 errori (estrazione oltre le aspettative).
- **Classificazione a Tier**: **A** = file core/manuali, estratti completi (~5GB testo); **B** = forse utili, solo prime 3 pagine come riferimento; **C** = scartati (~700GB: foto iPhone, dump iCloud, ridondanti). OCR su una parte dei Tier B (~20-50€); Tier C escluso (costo proibitivo).
- **Repository ufficiale = bucket S3**. UX a **filtri** (segmento/tipo/modello + serial number) per restringere alla macchina ("cono di visibilità").
- **UAT: start 15-17 giugno 2026**, poi follow-up per l'avvio.

## Timeline
- **Kick-off cliente: giovedì 21/05** (56 persone).
- Test entro **fine giugno** (timeline di Edward) → realisticamente **metà luglio**. Rollout utenti progressivo fino a **fine settembre**.
- Dati: **PST** dalla settimana del 25/05; progetti **Jira** (API key già nei Parameter Store).

## Referenti cliente (Primapower)
- **Werner Gaiotto**, **Matteo Giannotti**, **Edward Johnston** (Edward dà la timeline). Per lo sblocco SSO: contatti **Patrizzi / Loris** (da confermare grafia).

## Kickoff cliente (21/05) — POC e UAT
- Industrializzazione di una **POC 2025** (chiusa con esito positivo): 49 feedback, **73% positivi**, accuracy **3.9/5** → steering committee ha approvato, inserita nella IT roadmap 2026 del cliente. **Target**: 90% positivi, accuracy 4/5.
- Use case: **root cause analysis / troubleshooting** del service tecnico (3 product unit: bending, laser, punching).
- Flusso dati **mono-direzionale** (read-only): Jira + PST + file sharing → server AWS LAIF; nessuna scrittura di ritorno. Accesso via **web portal con SSO** (+ da PST), desktop e mobile.
- Jira: includere solo i ticket con **problema e soluzione chiari**; mostrare la **fonte** di ogni risposta in fase di test.
- Definire ~**200 benchmark question**; **UAT 4 settimane** (metà giugno → metà luglio).
- **Rollout**: luglio Italia + Germania; set-ott a cascata sul resto del mondo; tutti i paesi a regime **fine ottobre**. Steering committee ~mensile.

## Glossario di dominio (Prima)
- **Volos** — gestionale cliente per listini/prezzi/ricambi.
- **PST** — sistema cliente (dati via SFTP come JSON nelle tabelle; **non** il formato .pst di Outlook).
- **Jira** — integrazione via API (per ora limitata a 2 progetti).
- **Bedrock Data Automation (BDA)** — servizio AWS OCR/parsing (~$0.01/pagina).
- **Anagrafica macchine / "stella di Rosetta"** — mappatura codici macchina/articolo coerenti tra i vari sistemi.
- **PST / PSP / PSD** — sistema *service* del cliente (work order, service report, macchine installate); anche canale d'accesso. **BSD** — nuovo ticketing after-sales. **GISA** — sistema ticket usato nella POC. *(sigle da confermare per storpiatura)*
