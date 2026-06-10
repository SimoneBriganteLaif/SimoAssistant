---
titolo: Nivi — Automazione Risposta Mail
id: nivi-automazione-risposta-mail
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 15-18/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Nivi]]"
  - "[[Federico Frasca]]"
  - "[[Tancredi Bosi]]"
---

# Nivi — Automazione Risposta Mail

- **Codice commessa**: 2025026
- **Cliente**: [[Nivi]] (gestione corrispondenza mail su larga scala — fra cui molte **concessioni autostradali**; le email sono categorizzate, es. categoria "legal")
- **Stato (Notion)**: In Sviluppo
- **Team leader**: [[Simone Brigante]]
- **Referenti interni**: [[Federico Frasca]] (dedup mail + ticket), [[Tancredi Bosi]] (pipeline ricezione mail)
- **Descrizione**: App di gestione/classificazione email e crediti (Nivi-Credit); automazione delle risposte mail. Ticketing attivo, evolutiva su invio mail.

## Stato tecnico (mag 2026)
- **Import storico mail via pacchetti PST** (export mailbox Outlook): ~17.000 mail, ~227 duplicati (~1%); alcune mail automatiche con stesso subject/body fino a 46 copie. Da richiedere altri PST (altre caselle).
- **Deduplicazione**: via **query SQL sul DB** (Postgres) — non via Graph API Outlook. Chiave finale (decisa il 25/05): **Body + Sender + Subject** (la **data è esclusa**, può divergere). Cancellazione via **hard delete** (scartato il soft delete su cui Simone si era impuntato). Si eliminano solo email **non assegnate** e con status ≠ "2Process". Su ~28-29k duplicati totali, ~800 "sicuri" eliminati. Se ne occupa Simone.
- **Categorizzazione LLM**: aggiungere destinatari + CC al prompt.
- **Generazione risposta**: passare a **event stream** (chunk) perché l'API sincrona va in **timeout** oltre 30-60s sul gateway.

## App "Live Pro" (lato cliente)
Il cliente chiama l'app **"Live Pro" / "LIFE"** (≠ la CLI interna `laif`). Categorizza email/PEC leggendo oggetto+corpo (non gli allegati), con revisione dei responsabili e multi-destinatario.
- Funzioni recenti/richieste: **eliminazione email** (solo admin, per i duplicati), alert per email in revisione, distinzione **destinatari vs CC**, priorità "International Support", tag/stato **"Scarico RA"** (pratica sospesa). Categoria "Avvocato" da ri-tarare.
- **Migrazione mailbox** in corso (pacchetti PST + forwarding): prima le caselle "autostrade", poi la PEC interna ("TDC Communications"); altre caselle Info ASL, Info TPL, NIVICERT.
- Dominio: corrispondenza per **concessioni autostradali** ed enti (TPL, ASL, comuni via NIVICERT). Ufficio cliente a Firenze (chiuso il 24/6).

## Referenti cliente
- **Alessandro Michaelsson** (alessandro.michaelsson@nivi.it) — molto sollecito (invia i pacchetti PST, chiede di aggiungere caselle).
- **Erika** — responsabile / gestione email lato cliente (scrive sul tema "autostrade").
- **Federico** — *admin* lato cliente (≠ [[Federico Frasca]]). **Roberto** — commerciale/tecnico cliente.

## Nota
Le richieste insistenti di Nivi tendono a sottrarre tempo a [[Jubatus — Supporto sviluppo]] (attrito sulle risorse da monitorare).

## Glossario di dominio (Nivi)
- **PST** — file di export mailbox Outlook; l'import crea duplicati non gestiti da Outlook.
- **Internet Message ID (IMID)** — id univoco standard della mail (cross-casella); il *Message ID* interno di Outlook non è univoco. LAIF non salva l'IMID nel DB.
- Setup tecnico delle caselle: vedi [[Standard caselle email per cliente]].
