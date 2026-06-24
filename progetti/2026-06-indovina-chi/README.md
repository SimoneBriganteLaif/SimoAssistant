# Indovina Chi! — Team building 25-28/06/2026

Gioco "chi l'ha detto": 27 caratteristiche anonime da abbinare alle 27 persone.

## File
- `indovina-chi.docx` — foglio giocatore (tabella unica: `N° · Caratteristica · 1° · 2° · 3° · Esatta` + elenco persone `Lett. · Persona`, lettere A–Z poi AA). In alto: Nome e Cognome + Voto finale.
- `indovina-chi-correzione.docx` — solo per chi conduce: chiave soluzioni + punteggi (`N° · Caratteristica · Esatta · Persona · Punteggio · Posizione`), ordinata per numero di frase.
- `build.js` — generatore dei due docx. Rigenera con: `npm i docx && node build.js` (scrive i `.docx` in questa cartella).

## Regole
3 tentativi per frase; ogni frase indovinata vale 1 punto; massimo 27 punti.

## Note sui dati
- Fonte: database Notion "Caratteristica" (Retrospective Giugno 2026 → SimOrganizzazione), form non anonimo.
- 27 persone = 27 caratteristiche (1-a-1).
- Le due righe inviate dall'account di Simone Brigante: **«Mangio i kiwi con la buccia» = Simone**; **«Mi hanno quasi bocciato all'asilo» = Mattia Palmucci** (che non ha accesso a Notion, quindi inserita da Simone per lui).
- Nomi ripuliti dal form: `robertozanolli` → Roberto Zanolli; `Daniele DN` → Daniele Dalle Nogare.
