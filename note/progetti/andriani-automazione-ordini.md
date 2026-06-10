---
titolo: Andriani — Automazione ordini
id: andriani-automazione-ordini
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-10
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 11/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Andriani]]"
  - "[[Tancredi Bosi]]"
  - "[[Lorenzo Monni]]"
  - "[[Mattia Gualandi]]"
---

# Andriani — Automazione ordini

- **Codice commessa**: 2025069
- **Cliente**: [[Andriani]] — gestionale **ARCA** (gestito da Murgia Informatica)
- **Stato (Notion)**: In Sviluppo — "andando fortissimo" (mag 2026)
- **Team leader**: [[Simone Brigante]]
- **Sviluppo gestione ordini**: [[Lorenzo Monni]] (frontend + ETL), [[Tancredi Bosi]] (parsing documenti)
- **Repo**: `andriani-sequencing`, `andriani-infra`
- **Kick-off**: ~22 aprile 2026

## Obiettivo (MVP)
Automatizzare l'inserimento ordini: leggere dati da ARCA → un **agente** crea l'ordine → l'ordine viene scritto su ARCA. Tutte le fonti di ordine (agenti, email/PDF, Mercadona) confluiscono in **un'unica entità "ordine"**, indipendentemente dalla provenienza.

## Stato moduli (mag 2026)
- **Frontend wizard inserimento ordini**: in gran parte completo. Gestione automatica **sconti canale + sconti promo** a cascata (il promo ha validità temporale), **provvigioni** calcolate post-sconti, vista dettaglio ordine pronta. Niente funzione "duplica ordine" (i campi si compilano da soli; le note ricorrenti si legano a cliente/destinazione).
- **ETL / integrazione ARCA**: **bloccato** dalla mancanza delle **API ARCA** (è il blocco principale). Si parte dalle tabelle Andriani esistenti.
- **Parsing email/PDF d'ordine**: avviato da Tancredi; approccio incrementale sui **top 3-5 clienti**; test su OCR vs PDF→LLM diretto.
- **Gestione permessi/ruoli**: in corso (separare permesso schedulatore da permesso ordini).
- **Scraping Mercadona**: priorità bassa, trattata come "un'altra fonte di PDF"; fallback upload manuale massivo.

## Commerciale
- Contratto a **6 moduli**. La **2ª tranche** di fatturazione è legata alla consegna di 2 moduli (scraping Mercadona + gestione permessi).

## Schedulatore Andriani (legacy)
App preesistente Andriani con un tab "ordini" (ordini storici importati), da rinominare. Seguita da [[Mattia Gualandi]] (team di [[Francesco Barbanti]]) — distinta dalla nuova automazione ordini.

## Stato avanzamento (fine maggio 2026)
- Invio ordini funzionante sull'**istanza ARCA di test** (predisposta da Luigi); inserimento nuovi ordini e nuove destinazioni quasi completo. "Meglio delle aspettative".
- Mancano: distinzione **OC/OCF**, campi calcolati e anagrafiche derivate.
- **ETL**: esiste a codice ma **non ancora deployato su AWS** (manca l'accesso alle API "interne" di ARCA — permessi da Luigi, senza tempistiche). Nel frattempo si replicano a mano alcune logiche ARCA (es. peso ordine).
- UI di validazione ordini-email: wizard + **PDF affiancato** (split view) per dare feedback al cliente.
- Regole di parsing/mapping **personalizzate per cliente/destinazione** (aggiunte progressivamente).
- Chiusura round con ARCA: 6 moduli portati avanti "a metà" (valgono ~3) — gestione contrattuale con Luigi Di Lauro.
- Clienti/destinazioni ricorrenti: **Conad**, **Esselunga** (⚠️ "S.Lunga"), **Mercadona** (scraping; referente "Leda", in attesa accesso portale).

## Gestione ordini, email e agenti (SAL 29/05)
- **Invio ad ARCA**: sincrono, con stati ordine ("a confermare" → "pronto da processare" → "esportato"); segnala i fallimenti.
- **Parsing PDF**: testabile dall'app in **modalità interattiva** (conferme cliente/destinazione/righe, aggiunta **alias prodotto**, marcatura "da riverificare").
- **Email ordini**: la casella *orders* riceve ordini + altro (contestazioni, fatture). Piano: separare i canali, filtro automatico (un ordine ha **sempre un PDF**; tag "ORD"); partenza con **inoltro manuale**, poi automazione.
- **Inserimento da agenti**: se attivato copre ~**80%** degli ordini; filtra per **listino cliente**; gestione automatica **OC/OCF** (avvisa se misto → da scorporare).
- **ARCA Produzione vs Test**: ambienti distinti; LAIF legge il Test → serve sync dei dati (es. note destinazioni) dal Produzione.
- Clienti/destinazioni: Conad, Esselunga, Coop (anche estere), Pac, Mercadona, Maxidì.

## Aggiornamenti (9-10/06)
- **10/06 nuovo rilascio** su sequencing-dev.app.laifgroup.com: sezione "**Gestisci Gamme**" nel menù principale con caricamento da Excel (comunicato da Lorenzo Monni ad Andriani).
- **Aggiornamento gamme da tabella** configurato; due divergenze coi dati ARCA emerse il 9/06: **codici cliente mancanti** (disallineamento dev/prod, clienti inseriti di recente) e **listini cliente non aggiornati** → se ne parla al **SAL di venerdì 12/06**.
- In validazione (12/06, Monni): conferma ordini automatici via mail, gestione gamme, import gamme da Excel; (Tancredi): parsing ordini Excel, multi-PDF per mail. In attesa cliente: import automatico ordini via API "Mercadona".

## Referenti cliente
- **Luigi Di Lauro** (l.dilauro@andrianispa.com) — responsabile del progetto lato cliente (è chi ha chiesto il Gantt).
- **Luigi Scaltrito** (l.scaltrito@andrianispa.com) — IT.
- **Domenico Rizzi** (d.rizzi@andrianispa.com) — area ARCA / ordini. *Nota: esistono due "Rizzi" lato Andriani (uno referente ARCA, uno sugli ordini Italia).*
- **Dino** — gestione **ordini Italia** (verifica/conferma gli ordini); plausibilmente uno dei due Rizzi.
- **Leda** — gestione **ordini estero** + portale **Mercadona**.
- **Lucia** — area **commerciale / gamma** articoli.

## Glossario di dominio (Andriani)
- **ARCA** — gestionale del cliente (Murgia Informatica). Ordine = testata + righe d'ordine; espone/esporrà API in lettura/scrittura.
- **ETL** — ingestione anagrafiche/tabelle da ARCA verso l'app.
- **Sconto canale / sconto promo** — sconti applicati a cascata; il promo ha validità temporale.
- **Provvigione** — commissione agente, calcolata post-sconti.
- **Alias articoli** — mappatura codice articolo cliente ↔ codice Andriani.
- **Righe omaggio** — riga a omaggio, in predisposizione.
- **Mercadona** — catena da cui si scaricano PDF d'ordine (scraping a bassa priorità).
- **Altec / Tabelle Altec** — Altec è il vendor del gestionale ARCA; tabelle usate per arricchire i dati estratti verso l'ordine.
- **OC / OCF** — due tipi di ordine ARCA, non mescolabili nello stesso ordine; **OCF** è legato al brand **Felicia**.
- **Gamma vs Listino** — il *listino* contiene tutti gli articoli; la *gamma* è il sottoinsieme che il singolo cliente acquista (legata al cliente, cambia ~1-2 volte/anno; non tracciata formalmente su ARCA — sta nella testa di Dino/Leda o in Excel). Rischio: inserire articoli **fuori gamma**.
- **Brand / listini** — brand *Felicia*, *OneCop*, *BL* (⚠️); listini es. *GDO 2022*, *G2 Italia*.
- **"post"** — operazioni POST di inserimento ordine verso ARCA.
