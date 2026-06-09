Backfill PROFONDO della conoscenza dalle riunioni storiche (e dalle altre fonti), per rendere la
wiki abbastanza ricca da supportarmi come "segretario": aggiungere task, preparare analisi,
rispondere a mail con il giusto contesto.

Input opzionale: $ARGUMENTS (es. "ultimo mese", "riunioni di maggio", "solo Jubatus").
Default: ultime ~8 settimane di riunioni.

## Principi (importanti)
- Lavora **a BATCH** (es. una settimana, oppure 5-10 riunioni per volta): raccogli → riassumi →
  chiedi → salva → poi prosegui col batch successivo. NON provare a divorare tutto in un colpo.
- Le **trascrizioni di Notion sono di bassa qualità**: sii scettico. Nomi propri, sigle e termini
  vanno segnalati come incerti, **non inventare**. Se un punto non è chiaro, **chiedimi**.
- Aspettati di farmi **molte domande**: meglio tante domande mirate che note sbagliate.

## 0. Prepara
Leggi `CLAUDE.md`, `_indice.md`, `_glossario.md`. Carica gli schemi MCP (Notion, Outlook) con
ToolSearch. Se sei in locale, individua anche le mie **repo di progetto** (git) e collega gli
stack tecnologici ai rispettivi progetti.

## 1. Raccogli (un batch alla volta, in ordine cronologico)
- **Notion — Riunioni** (Riunioni Private + meeting notes / Team Delivery / 1:1): prendi le
  riunioni del periodo a blocchi. Per ognuna estrai: decisioni, persone citate (ruolo/team),
  progetti e relativo stato, scadenze, azioni da fare, e **terminologia di dominio** (acronimi,
  nomi di sistemi/moduli/processi del cliente).
- **Email** del periodo come supporto e conferma.
- **Repo** (se in locale): stack, struttura, a quale progetto/cliente appartengono.

## 2. Confronta ed estrai (flusso `/cattura`)
Per ogni elemento confronta con le note esistenti e classifica
(NOVITÀ / AGGIORNAMENTO / DISCREPANZA / DUPLICATO / COMPLEMENTARE).
Costruisci anche un piccolo **glossario di dominio** dei termini ricorrenti; proponimi i tag
nuovi **prima** di usarli.

## 3. Chiedimi (a fine di ogni batch)
Presenta: (a) le bozze di note nuove / aggiornamenti; (b) una lista numerata di domande sui punti
incerti (nomi, sigle, chi-fa-cosa, stati progetto, contraddizioni). Domande secche. Attendi conferma.

## 4. Salva e indicizza
Dopo le mie conferme: crea/aggiorna le note con frontmatter, `[[wikilink]]` e backlink reciproci;
aggiorna `_indice.md` e `_log.md` (riga "approfondimento AAAA-MM-GG" con il batch processato e cosa
resta). Poi proponimi il batch successivo.

## Obiettivo finale
Avere in `note/` abbastanza contesto su progetti, persone, clienti, decisioni e terminologia da
permetterti di supportarmi in compiti concreti come: "aggiungi un task su Jubatus",
"aiutami a preparare questa analisi", "aiutami a rispondere a questa mail".
