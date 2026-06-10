---
titolo: Bonfiglioli Consulting — Pianificazione carico team
id: bonfiglioli-consulting-pianificazione-carico
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 13/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Bonfiglioli Consulting]]"
  - "[[Lorenzo Tonetta]]"
  - "[[Davide Leonescu]]"
---

# Bonfiglioli Consulting — Pianificazione carico team

- **Codice commessa**: 2026036
- **Cliente**: [[Bonfiglioli Consulting]]
- **Stato (Notion)**: In Sviluppo
- **Team leader / operativo**: [[Simone Brigante]]
- **Referenti interni**: [[Lorenzo Tonetta]] (sviluppatore principale), [[Davide Leonescu]]
- **Repo**: `bonfiglioli-consulting`, `bonfiglioli-consulting-infra`

## Obiettivo
Strumento di **simulazione / pianificazione del carico dei consulenti**. Digitalizza il processo cliente di **D-CAP**, oggi gestito con **Orchestra** + Excel.

## Stack cliente
- **Orchestra** — gestionale/CRM del cliente su **MySQL** (accessibile senza VPN).
- **DWH Test** — datawarehouse su **SQL Server** (richiede VPN), schema tipo `DWHTST`.
- **Tailscale** — VPN per accedere ai DB cliente. Client DB usato: **DBeaver**.
- Dashboard **Power BI** esistenti lato cliente, da analizzare.

## Stato / timeline
- Allegato tecnico in 4 fasi: 1 (avvio), 2 (design + analisi dati), 3 (sviluppo), 4 (test e rilascio).
- Budget **38 giornate**, **5 rendicontate** (mag 2026).
- Tranche: kick-off **aprile**, intermedia **giugno**, chiusura **settembre** (Simone punta a finire prima).
- Fase mockup → dati reali agganciati dai DB cliente (branch di datamodel/ETL).

## Referenti cliente
- **Antonio Scagliuso** — referente di progetto (lato cliente), userà lo strumento, segue i D-CAP.
- **Andrea Malaguti** — IT manager **esterno** del cliente (ha fornito Tailscale + accesso DB).

## Glossario di dominio (Bonfiglioli)
- **D-CAP** — processo cliente di pianificazione capacità/carico dei consulenti (oggi Orchestra + Excel).
- **Orchestra** — gestionale/CRM cliente (MySQL).
- **DWH Test** — datawarehouse SQL Server (via VPN).
