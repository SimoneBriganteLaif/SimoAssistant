---
titolo: Lamonea — Gestionale / CRM
id: lamonea-gestionale
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 13-15/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Lamonea]]"
  - "[[Luca Stendardo]]"
  - "[[Mattia Gualandi]]"
---

# Lamonea — Gestionale / CRM

- **Codice commessa**: 2026024
- **Cliente**: [[Lamonea]] — gestionale **Team System** (ERP)
- **Stato (Notion)**: In Sviluppo — sviluppo avanzato, [[Luca Stendardo]] full-time
- **Team leader**: [[Simone Brigante]]
- **Referenti interni**: [[Luca Stendardo]] (sviluppatore full-time), [[Mattia Gualandi]] (magazzino)
- **Repo**: `lamonea`, `lamonea-infra`
- **Obiettivo**: **chiusura entro fine giugno 2026**. Deploy in produzione (mai fatto finora) con ETL. Da delimitare lo scope (escludere B2B e richieste fuori budget — attenzione allo scope creep).

## Descrizione
App custom appoggiata al gestionale **Team System** del cliente: ordini, preventivi/CRM, **gare**, **magazzino**, **spedizioni**. Rilasci frequenti, SAL periodici, molte micro-richieste operative.

## Moduli
- **Completati (mag 2026)**: lettura dati Team System; CRM (con flow clienti potenziali, gestiti come clienti con flag "potenziale"); gestione **gare** (tracciamento, lotti, riconciliazione ordini via **CIG**, tracciamento gare perse + motivazione); **magazzino** (giacenze, KPI, statistiche); giacenze real-time in creazione ordine; dashboard statistiche clienti.
- **In pipeline**: scrittura articoli/clienti/fornitori su Team System; completamento campi ordini; **listini dinamici** (prezzo salvato *post-ordine*, non listino a priori); statistiche ordini; permessi agenti (interni vedono tutto, esterni solo i propri dati — pattern *filtered-CRUD*).
- **Fase 2 / evolutiva**: notifiche CRM, import/export Excel anagrafiche, portale **B2B** (deprioritizzato), logistica/spedizioni con DDT, reportistica ISO/lotti in scadenza, integrazione dati **Ministero della Salute** (~12.000 articoli, JSON) → rimandata a **roadmap 2027**. Modulo **Amazon** e **preventivazione**: esclusi.
- **Fuori scope**: riordini automatici/predittivi (modulo a parte — Simone "irremovibile"), kit multiprodotto, "foto magazzino".

## Modulo Spedizioni (corrieri)
Tracciamento/gestione spedizioni in **2 fasi**: Fase 1 *monitoraggio* (sostituire l'Excel manuale di Stefano, vista unificata + stato live via **API corrieri**, partendo da un solo corriere — probabile **GLS**); Fase 2 *creazione etichette via API* (rimandata). I **DDT** sono letti da Team System (non creati dall'app); riconciliazione DDT↔tracking number nel campo **"targa automezzo"** del piede DDT.
- Stato (fine mag): tracking **GLS** integrato (via numero bolla/DDT); **Bartolini** pronto ma il *Parcel ID* va nelle **note** del documento (non nel campo targa); **TNT** in attesa di documentazione. Un aggiornamento del vendor Team System ha **rotto il web service DDT** (errori sui campi *B-tipo* / *data bolla*), bloccando temporaneamente l'integrazione.

## Fatturazione
- **3ª/ultima tranche al 26 giugno 2026** (per contratto: "magazzino e spedizioni"). Obiettivo: avere roba in test/produzione lato cliente entro quella data.

## Note tecniche
- **Team System** va spesso offline; supporto lento (referente vendor **Alessandro**). Il codice ordine si **riazzera a inizio anno** (serve passaggio extra di deduplicazione). ETL pesante (problemi OOM su dedup ordini dal 2023): ottimizzato + run on-demand con lock/semafori. Prevedere banner "ultimo aggiornamento dati" + gestione fallimenti sync.

## Dettagli (SAL 28/05)
- **3 aziende** gestite (codici azienda es. **49**, **133**); cliente = distributore in ambito **medicale** (cateteri/urologia).
- **Ruoli/permessi**: 4 gruppi (ufficio gare, vendite, agenti esterni, magazzino) + ruoli admin/user; gli agenti esterni vedono solo i propri clienti/ordini (filtro automatico sull'agente di Team System).
- **Agenti interni vs esterni**: oltre agli agenti esterni di Team System, agenti interni assegnabili alle opportunità CRM; distinzione **agente** (commerciale) vs **operatore** (chi materializza l'offerta).
- **Sync anagrafiche** clienti/fornitori/articoli con Team System, salvate su **tutte e 3 le aziende** (per evitare disallineamenti); alcuni campi non scrivibili (note cliente, **CIG**). Classificazione articoli famiglia/sottofamiglia.
- **Spedizioni**: aggiunto vettore **BRT** (oltre a GLS/Bartolini/TNT). Alcuni DDT/ordini non compaiono nelle query (sospetto filtro su data/bolle fatturate).
- **Mobile**: l'app va da PC ma non bene da cellulare (gli agenti la userebbero da mobile) — in attesa di ottimizzazione del template.
- **B2B futuro**: portale con prezzi personalizzati (storici per clienti esistenti, listini A/B/C per nuovi), dark mode + branding. Per ora si consolida.
- **Timeline (1:1 Luca 26/05)**: alcuni moduli **in produzione a metà giugno** (partenza con inserimenti manuali), chiusura piena ~**metà luglio**. Luca ha fatto ~90% del lavoro e ne rivendica l'ownership.
- **ETL a livelli**: backfill massivo (~2h, on-demand) + import orario (ordini/movimenti) + import notturno (dati lenti) + refresh on-demand (spedizioni ~30s), con **watermark** sull'ultima run. Team System nuova versione: risposte API >5MB in errore → **chunking** (ordini per semestre, articoli in 36 bucket per iniziale).
- **Tracking BRT**: campo corretto = **"segnacollo"** (disponibile subito). Ottimizzazione **mobile completata** (clienti/articoli/CRM/magazzini).
- **Deploy**: la produzione non è mai stata rilasciata → primo deploy completo (con creazione DB) target **giovedì 11/06** (+ ETL già girata 1-2 giorni prima); call con Marco + cliente l'11/06. Chiusura obiettivo **fine giugno** (scadenza interna). Drag&drop Kanban temporaneamente disattivato; nuovo cliente potenziale gestito su **ditta 999**.

## Referenti cliente
- **Andrea Spilli** (a.spilli@lamonea.com) — referente principale, molto operativo, contatto quasi quotidiano; gestisce l'associazione ordine–DDT su Team System.
- **Matteo Farinelli**, **Filippo Nicoletti** — sales interni lato cliente (testano la scrittura ordini).
- **Stefano** — logistica/magazzino (tiene l'Excel spedizioni); contatto occasionale.
- **Marco** (founder LAIF) — interlocutore per scope/evolutive.

## Glossario di dominio (Lamonea)
- **Team System** — ERP del cliente (web service / estrazioni molto ampie).
- **DDT** — Documento Di Trasporto; da cui si genera la fattura. Relazioni molti-a-molti ordine↔DDT↔spedizione.
- **CIG** — Codice Identificativo Gara; per riconciliare ordini ↔ gare d'appalto.
- **Corrieri**: **GLS** (colli piccoli), **TNT** (≥5 kg), **BRT/Bartolini** (bancali).
- **Listini dinamici** — il prezzo si propone di salvarlo *dopo* l'ordine (nel listino cliente o generale).
- **ETL** — pipeline staging → presentation; sync periodica.
