---
titolo: Casartelli — Industrial Knowledge
id: casartelli-industrial-knowledge
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-15
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 04/06 (Notion) 2026-06-09", "kick-off interno 10/06 (Notion) + conferma Simone 2026-06-10", "mail Wolico contratto firmato 12/06", "kickoff tecnico cliente 11/06 + riunioni 11-12/06", "riunioni 15/06 + conferma Simone 2026-06-15"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Casartelli]]"
  - "[[Luca Stendardo]]"
  - "[[Carlo Venditti]]"
  - "[[Tancredi Bosi]]"
  - "[[Dmitry Babich]]"
  - "[[Marco Vita]]"
---

# Casartelli — Industrial Knowledge

- **Codice commessa**: 2026054
- **Cliente**: [[Casartelli]] (Casartelli Antonio) — acciaieria a **Lecco**, ~50 M€ fatturato (2024), pezzi in acciaio per automotive (clienti finali Daimler, Volvo, Iveco, Fiat), conduzione familiare. Cliente entusiasta, promette molto lavoro.
- **Stato**: **attivo / in corso** — **contratto FIRMATO** (mail Wolico 12/06): "Industrial Knowledge" **25.000€** + "Industrial Knowledge – Manutenzione" **8.000€**.
- **Team leader / delivery**: [[Simone Brigante]]
- **Team operativo**: [[Luca Stendardo]] (full-stack), [[Simone Brigante]] (TL/delivery), [[Marco Vita]] (coordinamento founder). Per la parte **GenAI** [[Tancredi Bosi]] è **confermato volontario** (vuole vedere la parte Life Agent). [[Dmitry Babich]] (nelle trascrizioni "Dimitri") è **sales** e su Casartelli segue la **pre-sales / requisiti / backlog** — **non** è operativo/dev. Il task **SFTP** è già a sistema su Notion.
- **Origine del lead**: stesso contatto di [[Prima Industrie — Virtual Assistant]] — consulente ex-BCG (marito di "Maria", ex collega di Ammagamma).

## Scope — due filoni paralleli
1. **Knowledge base + chat GenAI** con profilazione su 3 livelli (Direzione / Tecnologi / Operation); "**black book**" delle anomalie; disegni tecnici acquisiti via ETL.
2. **Digitalizzazione qualità stamperia**: foglio fisico → form; Excel → app; mail di recap → notifiche; scheda di controllo stampabile per commessa.

## Moduli
- **Modulo 1** = **knowledge base aziendale** (comprato ora, oggetto del contratto firmato).
- **Modulo 2 (futuro)** = supporto **commerciale / preventivazione** — già anticipato dal cliente.
- Percezione cliente: prezzo "quasi da startup", ma manutenzione percepita alta.

## Architettura dati & tecnica
- **Stack AI su Bedrock** (deciso con [[Marco Pinelli]]): progetto semplice (knowledge base + skill + agente piccolo) → andrà **sicuramente su Bedrock**, in linea con la direttiva aziendale (vedi `_decisioni.md`). Primo progetto gestito "in modo standard" con [[Merlino]] + [[Laif Factory]] come "Life Command".
- **Nessun accesso diretto ai DB del cliente.** Casartelli deposita:
  - **estrazioni CSV da SAP via SFTP** (aggiornamento **giornaliero**);
  - **documenti dal NAS Windows** e dal **Vault PDM SolidWorks** (solo i documenti ufficialmente rilasciati).
  - File PDF / TIFF / Excel / PPT, nell'ordine dei **GB**.
- **SSO**: chi ha email O365 → **Azure AD**; gli altri → **user/password**. Ruoli e permessi gestiti **dentro l'app LAIF** (≥4 livelli: **Admin, Amministrazione, Commerciale/BD, Operations/Tecnologi**), con **separazione per cliente finale** (Daimler, Volvo) per riservatezza.

## Tempistiche
- **Kick-off interno: 10/06**. **Kickoff tecnico cliente: 11/06** (su Teams).
- **Prossimo incontro IN SEDE a Lecco: 30/06** (calendar già inviato dal cliente). *(sostituisce la precedente ipotesi "visita Lecco 22-23/06".)*
- **Requisiti entro metà luglio**; **primo rilascio testabile a settembre**; chiusura settembre-ottobre (~3-4 mesi).

## Referenti cliente
- **Marco Galluzzi** — amministratore / proprietà.
- **Giovanni** — Ufficio Tecnico (dati / PDM SolidWorks).
- **Matteo** — coordinatore collaudo, "cliente finale" del progetto.
- **Matteo** — responsabile qualità. *(omonimo del precedente.)*
- **Lorenzo Archetti** — IT Manager.
- **Renato** — responsabile infrastruttura (cugino di [[Marco Vita]]).

> Correzione (09/06): l'avanzamento tecnico "parsing ~17.000 file / tier A/B/C / UAT" attribuito a Casartelli in una scoperta precedente è in realtà di [[Prima Industrie — Virtual Assistant]].
