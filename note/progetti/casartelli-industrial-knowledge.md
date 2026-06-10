---
titolo: Casartelli — Industrial Knowledge
id: casartelli-industrial-knowledge
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-10
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 04/06 (Notion) 2026-06-09", "kick-off interno 10/06 (Notion) + conferma Simone 2026-06-10"]
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
- **Cliente**: [[Casartelli]] (Casartelli Antonio) — acciaieria a **Lecco**, ~50 M€ fatturato (2024), pezzi in acciaio per automotive (Volvo, Iveco, Fiat), conduzione familiare. Cliente entusiasta, promette molto lavoro.
- **Stato (Notion)**: In Analisi → avviato (kick-off fatti)
- **Team leader**: [[Simone Brigante]]
- **Team operativo**: [[Simone Brigante]] + [[Luca Stendardo]]; per la parte **GenAI/KB** entrerà [[Carlo Venditti]] **o** [[Tancredi Bosi]] (orientamento su Carlo, decisione rinviata). [[Dmitry Babich]] è il **sales** che ha venduto il progetto (con [[Marco Vita]]): partecipa ai kick-off ma **non è operativo**. Eventualmente [[Davide Leonescu]].
- **Origine del lead**: stesso contatto di [[Prima Industrie — Virtual Assistant]] — consulente ex-BCG (marito di "Maria", ex collega di Ammagamma).

## Scope — due filoni paralleli
1. **Knowledge base + chat GenAI** con profilazione su 3 livelli (Direzione / Tecnologi / Operation); "**black book**" delle anomalie; disegni tecnici acquisiti via ETL.
2. **Digitalizzazione qualità stamperia**: foglio fisico → form; Excel → app; mail di recap → notifiche; scheda di controllo stampabile per commessa.

- **Modulo 2 (futuro, fuori perimetro)**: parte commerciale/CRM di preventivazione (~10-15 clienti fissi) — già anticipato dal cliente.
- Percezione cliente: prezzo "quasi da startup", ma manutenzione percepita alta.

## Tecnica
- **SAP in sola lettura** via IP statico e utenza dedicata (accesso avviato da Babich offline); **SSO Office 365**.
- In corso lato cliente una **bonifica dei codici pezzi SAP** (codici vecchi rimappati — da chiarire).

## Tempistiche
- **Kick-off interno: 10/06** (fatto, su Teams). **Kick-off cliente: 11/06** (su Teams — non in presenza a Lecco come inizialmente ipotizzato).
- **Visita on-site a Lecco**: settimana del **22-23/06**.
- **Requisiti entro metà luglio**; **primo rilascio testabile a settembre**; chiusura settembre-ottobre (~3-4 mesi).

## Referenti cliente
- **Marco Galluzzi** — AD, molto entusiasta (disponibile a meeting alle 9-9:30).
- **Renato Casartelli** — Operations/IT.
- **"Parolari"** — esperto interno la cui conoscenza va preservata (il progetto stava per chiamarsi "Parol-AI").
- **"Andrea"** — commerciale. Al kick-off cliente anche: Redaelli, Archetti, Valsecchi, Melesi, Comi (ruoli da mappare).

> Correzione (09/06): l'avanzamento tecnico "parsing ~17.000 file / tier A/B/C / UAT" attribuito a Casartelli in una scoperta precedente è in realtà di [[Prima Industrie — Virtual Assistant]].
