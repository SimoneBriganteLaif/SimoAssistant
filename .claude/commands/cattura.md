Sto per darti un'informazione da memorizzare nella mia base di conoscenza.

Input: $ARGUMENTS

(Se l'input è vuoto: chiedimi cosa vuoi catturare, oppure proponi di processare i file
presenti in `inbox/`.)

Esegui il flusso seguente, mostrandomi cosa fai a ogni passo e tenendo le spiegazioni brevi.

## 1. ESTRAI
Individua i fatti/concetti **atomici** contenuti nell'input. Separa idee distinte in note
distinte. Riformula in modo chiaro e conciso con parole tue — non incollare il mio testo
grezzo parola per parola.

## 2. CLASSIFICA
Per ogni elemento:
- determina il `tipo` e la cartella corrispondente in `note/`;
- assegna i `tag` pescando **solo** da `_glossario.md`;
- se serve un tag nuovo, **proponimelo e aspetta conferma** prima di usarlo o aggiungerlo al glossario.

## 3. CONTROLLA I CONFLITTI (passo critico)
Prima di scrivere, cerca in `note/` e in `_indice.md` le note correlate (per entità, titolo,
tag). Per ognuna classifica la relazione:
- **DUPLICATO** → unisci nella nota esistente, non crearne una nuova.
- **AGGIORNAMENTO** (informazione più recente) → aggiorna la nota, aggiorna il campo
  `aggiornato`, e annota *cosa* è cambiato in `_log.md`.
- **CONTRADDIZIONE** → **FERMATI**. Mostrami la versione vecchia e quella nuova affiancate e
  chiedimi quale tenere (o se marcare la nota come `stato: da-verificare`). Non decidere da solo.
- **COMPLEMENTARE** → aggiungi come nuova sezione/collegamento alla nota esistente.
- **NUOVO** → crea una nota nuova.

## 4. SCRIVI
Crea o aggiorna la/e nota/e con frontmatter completo secondo lo schema in `CLAUDE.md`.
Aggiungi i `[[wikilink]]` alle note correlate e crea i **backlink reciproci**.

## 5. INDICIZZA
Aggiorna `_indice.md` (voce con titolo, tipo, tag, percorso) e registra l'operazione in
`_log.md` (data + descrizione sintetica di cosa hai fatto).

## 6. RIEPILOGO
Dimmi in breve: cosa hai salvato/aggiornato, dove, con quali tag, ed elenca eventuali
conflitti irrisolti o tag nuovi che aspettano la mia approvazione.

**Regole sempre valide:** non sovrascrivere mai senza dirmelo; preferisci aggiornare a
duplicare; mantieni il vocabolario dei tag piccolo e coerente.
