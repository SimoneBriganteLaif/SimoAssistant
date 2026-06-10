---
titolo: Standard caselle email per cliente
id: standard-email-clienti
tipo: concetto
tag: [lavoro, laif, interno]
stato: attivo
creato: 2026-06-09
aggiornato: 2026-06-09
fonti: ["approfondimento riunione 03/06 'Configurazione Sistema Email e Gestione Team' (Notion) 2026-06-09"]
correlati:
  - "[[LAIF Tech Stack]]"
  - "[[Nivi — Automazione Risposta Mail]]"
---

# Standard caselle email per cliente

Convenzione interna per integrare le caselle email dei clienti nelle app LAIF (lettura + invio).

- **Due caselle per cliente**: una **condivisa gratuita** (non abilitata al login) + una **utenza di servizio reale a pagamento** (licenza Teams). Per clienti enterprise che richiedono segregazione dati (GDPR) serve l'utenza di servizio; per i non-enterprise può bastare la condivisa.
- **Azure App Registration**: una per cliente (attive: Nivi, Andriani; le altre — Mail Sender, Cloud Code, Test — da cancellare). Possibile app SSO ad hoc per [[Wolico]].
- **Flusso auth**: login con l'**utenza service del cliente** (non credenziali personali) → copia authorization code dal redirect → script genera access+refresh token → salvati in **Parameter Store** (uno **dedicato ai token email**). Configurare il *client secret* e "Allow public client flows".
- **Invio**: via **Amazon SES** con dominio custom del cliente (record DNS DKIM lato cliente). Esiste anche una variante più "plug-and-play" per singola casella.
- Mettere **policy anti-saturazione** sulle caselle (pulizia mail vecchie).
