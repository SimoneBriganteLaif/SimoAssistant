---
titolo: Umbra — Improvement recommender e modulo marketing
id: umbra-recommender-marketing
tipo: progetto
tag: [lavoro, laif]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 15/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Umbra]]"
  - "[[Daniele Dalle Nogare]]"
---

# Umbra — Improvement recommender e modulo marketing

- **Codice commessa**: 2025079
- **Cliente**: [[Umbra]]
- **Stato (Notion)**: In Sviluppo
- **Team leader**: [[Simone Brigante]]
- **Referente interno**: [[Daniele Dalle Nogare]]
- **Repo**: `umbra-recommend`
- **Descrizione**: Improvement del recommender + modulo marketing. Elaborazioni settimanali / tracciato agenti via SFTP.

## Stato (mag 2026)
- L'app **non è usata attivamente** dal cliente: gira solo l'**ETL settimanale** (domenica pomeriggio; la run parte ogni 10 min e controlla la condizione). Filosofia pragmatica: se si rompe lo segnala il cliente.
- **Upstream** al template **5.9.4** (multiporta, 150+ file) **posticipato**: prima testare le modifiche in isolamento, poi fare l'upstream quando si inizia il modulo WoW.
- Credenziali **SFTP** spostate su **AWS Parameter Store** (non Secret Manager: i segreti non vengono ruotati).

## Modulo Promozioni WoW
Nuove pagine in-app per gestire le promozioni marketing del cliente (oggi via Excel). Mockup frontend preparato da Simone.
- Logica: una promo parte ogni settimana ma dura **2 settimane** → 2 sempre attive in offset.
- Regole: **target di vendita per fornitore** (es. 40.000 €), non riproporre stesso articolo/famiglia per ~2 mesi, tracciamento progresso verso target.
- Servono gli **ordini in entrata** (acquisti dal fornitore) oltre a quelli in uscita, per calcolare la % di progresso.
- Mockup (Simone): vista **calendario drag-and-drop** su 2 canali ("studio"/"laboratorio"), selezione articoli dalla "pagina operativa marketing", **WOW score** per prioritizzare, gestione budget fornitori, vincoli min/max promo/anno, storico (mostra il **venduto effettivo** sell-in/sell-out, non previsto-vs-effettivo).
- Approccio **deterministico** (no AI): si danno dati e metriche, la scelta finale resta **manuale e sovrascrivibile** dalla referente marketing.
- **Fatturazione**: ultima tranche **18.000 €** a **giugno**, legata al completamento delle WoW (Marco Vita non vuole slittamenti).
- **WoW vs Canvas**: WoW = promo breve (15-21 gg); **Canvas** = promo lunga (≥3 mesi). Regola anti-ripetizione: stesso articolo non in WoW per ~3 mesi.
- **Budget Fornitore** (prototipato dal cliente su AS400): obiettivo/sotto-obiettivi per fornitore + premio %; indicatori RDA(ordinato)/Ricevuto/Fatturato; ricalcolo batch notturno. Si passano i **dati aggregati**, non le righe d'ordine.
- La piattaforma è **supporto decisionale** per la marketing: l'AI suggerisce → Alessandra decide e inserisce su **AS400** (gestionale legacy cliente) → i dati rientrano il giorno dopo. Il Gantt è soprattutto **visualizzazione**.
- Problema: AS400 conserva solo le promo attive → serve un modo per **conservare lo storico** (necessario per l'anti-ripetizione).

## Referenti cliente
- **Adriano** — referente di **progetto principale** lato cliente.
- **Alessandra** — referente **marketing** (gestisce oggi le promozioni; userà le pagine WoW).
- **Daniele Zandrini** (IT, @umbra.it) — referente tecnico.

## Glossario di dominio (Umbra)
- **WoW / WOW** — iniziativa/promozioni marketing del cliente.
- **Ordini in entrata vs in uscita** — acquisti (verso fornitore) vs vendite.
- **Parameter Store / Secret Manager** (AWS) — gestione credenziali (SFTP su Parameter Store).
