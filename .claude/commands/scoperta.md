Routine di SCOPERTA proattiva (da eseguire almeno una volta al giorno).
Esplori le mie fonti esterne, confronti con la base di conoscenza, e mi fai 3-5 domande
mirate su novità e discrepanze. Sola lettura sulle fonti: NON salvi nulla finché non rispondo.

Input opzionale: $ARGUMENTS (es. "solo notion", "ultimi 3 giorni"). Se vuoto, usa il default.

## 0. ORIZZONTE TEMPORALE
Cerca in `_log.md` l'ultima riga che inizia con "scoperta"; usa quella data come limite inferiore.
Se assente, guarda le **ultime 24-48h**. Concentrati su ciò che è cambiato di recente.

## 1. RACCOGLI (sola lettura — parallelizza con sub-agenti quando utile)
Per usare gli strumenti MCP carica prima gli schemi con ToolSearch (keyword "outlook", "notion",
"github", oppure `select:` con i nomi esatti).

- **Email (Outlook)**: messaggi rilevanti del periodo → nuovi clienti/progetti, decisioni,
  scadenze, cambi di persone. Salta rumore e notifiche automatiche (statuspage, bot ore/ticket).
- **Notion** (alta priorità): pagine modificate di recente, in particolare:
  - **Riunioni Private** (cosa è stato discusso/deciso);
  - **pagine dei progetti** e il **DB Progetti** (status, % done, team, nuovi progetti).
    NB: le **date di fine** dei progetti su Notion NON sono affidabili → **ignorale**, non trattarle come scadenze;
  - **Task** aperti o appena chiusi.
- **Calendario**: riunioni e scadenze dei prossimi giorni.
- **Repo (GitHub)**: per le repository accessibili fai `git fetch`/`pull` e guarda commit/branch
  recenti → quali progetti sono stati toccati. Se ti servono repo non in scope, **segnalamelo**
  (vanno aggiunte con `list_repos` / `add_repo`): non darle per inaccessibili senza aver controllato.

## 2. CONFRONTA con la base di conoscenza
Per ogni elemento, confronta con `_indice.md` e le note in `note/`. Classifica:
- **NOVITÀ** — progetto / cliente / persona non ancora in KB.
- **AGGIORNAMENTO** — cambio di stato, referente, scadenza, ruolo, ecc.
- **DISCREPANZA / COLLISIONE** — qualcosa che contraddice una nota esistente
  (es. una persona che sembra passata a un altro team; un referente diverso; uno stato
  progetto incoerente; un progetto dato per chiuso ma ancora attivo nelle mail).

## 3. CHIEDIMI (massimo 3-5 domande, prioritizzate)
Presentami una lista numerata di **3-5 domande** sulle cose che non sai o che non ti tornano.
Per ciascuna: **cosa hai visto** (con la fonte) e **cosa vuoi confermare**. Tienile secche.
Esempi:
- "Su Notion [[Federico Frasca]] risulta ora in un altro team — mi confermi il passaggio?"
- "Nuovo cliente X comparso nel DB Progetti: lo traccio?"
- "Lo stato di [[Progetto Y]] è passato a 'In Manutenzione' — aggiorno la nota?"
Se ci sono più di 5 spunti, scegli i più importanti e tieni gli altri in coda per la prossima volta.

## 4. DOPO LE MIE RISPOSTE
Applica le modifiche con il flusso di `/cattura` (controllo conflitti incluso): crea/aggiorna
note, `[[wikilink]]` e backlink reciproci, aggiorna `_indice.md`.
Aggiungi in `_log.md` una riga **"scoperta AAAA-MM-GG"** con: cosa hai aggiornato, domande poste,
e cosa resta in sospeso per la prossima sessione.

**Regole sempre valide:** sola lettura finché non confermo; non sovrascrivere mai
silenziosamente; preferisci aggiornare a duplicare; segnala sempre le discrepanze invece di
risolverle da solo.
