---
titolo: Jubatus — Supporto sviluppo
id: jubatus-supporto-sviluppo
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-10
fonti: ["Notion DB Progetti", "esplorazione Outlook 2026-06-08", "intervista /avvio 2026-06-08", "scoperta 2026-06-10 (sync 10/06 + task Notion)"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Jubatus]]"
  - "[[Federico Frasca]]"
---

# Jubatus — Supporto sviluppo

- **Codice commessa**: 2025093 (supporto 2026-2028)
- **Cliente**: [[Jubatus]]
- **Stato (Notion)**: In Sviluppo
- **Team leader**: [[Simone Brigante]]
- **Referente interno**: [[Federico Frasca]]
- *Alias*: nelle trascrizioni/dettature compare spesso come **"Ubatus"/"Yubatus"** (storpiatura) — è sempre Jubatus.
- **Descrizione**: Supporto sviluppo + infrastruttura. Attività recenti: deploy DEV, setup ambiente, "tunnel" per i dati, review infrastruttura. [[Federico Frasca]] lavora su mockup/front-end (review UX/UI ricorrenti con Simone). Progetto tecnicamente molto attivo.
- **Evoluzione (giu)**: il cliente vuole gestire **invio e ricezione mail su AWS SES** → adattare la pipeline mail (oggi legge da Outlook via Graph API) per leggere da SES (Boto3). [[Federico Frasca]] ne prende l'ownership come progetto "palestra".
- **Referenti cliente**: logan@, gionata@ ("Jonathan" nelle trascrizioni), simone@jubatus.it

## Aggiornamenti (9-10/06)
- **Deploy DEV fatto da Simone il 9/06** (giornata focus): pipeline che importa **ordini e customer** rilasciata in dev su AWS. Priorità: farla girare in locale end-to-end.
- **Refactor del data model deciso il 10/06** (con Federico): eliminare le tabelle `Recipients`, `Contacts`, `Mailbox`; categorie sulle **singole mail** (non sui thread); status da enum a tabella con flag `technical`; fusione Inbox/ExtCustomer → `Customer`. Nessun dato in produzione → si può ricreare tutto.
- **Bloccante infra**: backend senza permessi S3 e Simone non può deployare l'infra per permessi ristretti → da risbloccare con "Jonathan" (gionata@).
- **Forwarding mail**: rischio perdita del mittente se il cliente fa inoltro semplice; Jubatus usa **Google** (Nivi era Outlook→Outlook), regola da verificare.
- **Rebranding piattaforma cliente**: **MyMemories → Vivilo** (appvivilo.ai); il tool di customer care è deployato in DEV (utenza support-dev creata il 10/06).
- Prossimi step (task Notion): Invio Mail AWS SES e Deploy PROD con target **19/06** (Simone); Ingestion Mail Outlook in corso (Federico + Tancredi).
