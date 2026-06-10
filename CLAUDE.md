# CLAUDE.md — Base di conoscenza personale di Simone

Questa repository è la mia "memoria esterna": un grafo di note in Markdown che tu mantieni
ordinato per me. Le note in `note/` sono la **fonte di verità**. Il tuo compito è aiutarmi
a *catturare*, *catalogare* e *mantenere coerente* questa conoscenza nel tempo.

<!-- Nota per il manutentore umano: tieni questo file sotto ~200 righe. Tutto ciò che è
     procedura va nei comandi in .claude/commands/, non qui. -->

## All'avvio di ogni sessione
- Leggi `_indice.md` (la mappa) e `_glossario.md` (il vocabolario dei tag) **prima** di
  rispondere a domande sulla mia conoscenza.
- Non caricare tutte le note in contesto: usa l'indice per capire *dove* cercare, poi apri
  solo le note rilevanti.
- La verità sta nei file. Se sei incerto, leggi la nota, non andare a memoria.

## Struttura della repo
```
inbox/        input grezzo non ancora processato (NON è mai fonte di verità)
note/         note atomiche (una idea per file)
  persone/    progetti/   aree/   concetti/   risorse/   fatti/
_indice.md    mappa di tutte le note: titolo, tipo, tag, percorso
_glossario.md vocabolario CONTROLLATO dei tag (l'unica fonte di tag validi)
_overview.md  sintesi viva: stato progetti attivi, chi-fa-cosa, scadenze imminenti
_decisioni.md decision log trasversale (decisioni chiave, datate, per progetto/area)
_todo.md      to-do DINAMICO (fili aperti + domande pronte; NON storico: gli item risolti si cancellano)
_log.md       diario cronologico delle modifiche
```

## Principi per le note
- **Atomiche**: una nota = un concetto/entità. Se una nota ne copre due, dividila.
- **Frontmatter YAML obbligatorio** (schema sotto).
- **Collegate**: usa `[[wikilink]]` verso le note correlate e crea i backlink reciproci.
  Evita le note orfane.
- **Tag solo dal vocabolario**: usa esclusivamente i tag presenti in `_glossario.md`.
  Per un tag nuovo, **proponilo e aspetta la mia conferma** prima di aggiungerlo al glossario.
- **Nomi file**: slug minuscolo con trattini, in italiano (es. `gestione-deleghe.md`).

### Schema del frontmatter
```yaml
---
titolo:
id:            # slug stabile: NON cambiarlo dopo la creazione
tipo:          # persona | progetto | area | concetto | risorsa | fatto
tag: []        # solo valori presenti in _glossario.md
stato:         # attivo | archiviato | da-verificare
creato: AAAA-MM-GG
aggiornato: AAAA-MM-GG
fonti: []      # da dove arriva l'informazione
correlati: []  # [[link]] ad altre note
---
```

## Regola d'oro sui conflitti
**Non sovrascrivere MAI silenziosamente.** Prima di salvare qualcosa, cerca note esistenti
sullo stesso tema (per entità, titolo, tag). Il flusso completo è in `/cattura`.
Se trovi una **contraddizione**, fermati e chiedimi come risolvere — non scegliere da solo.
Preferisci sempre *aggiornare* una nota esistente piuttosto che *duplicarla*.

## Manutenzione
- Aggiorna `_indice.md` e `_log.md` a ogni modifica strutturale.
- Mantieni il vocabolario dei tag **piccolo e coerente**: meglio pochi tag riusati che molti tag simili.
- Per la pulizia periodica usa il comando `/revisiona`.

## Comandi disponibili
- `/avvio`    — inizializza la repo e mi intervista per "scaricare" conoscenza dalla testa.
- `/cattura`  — processa una nuova informazione: estrai → classifica → controlla conflitti → salva → indicizza.
- `/revisiona`— revisione di igiene: orfani, link rotti, tag fuori vocabolario, duplicati, contraddizioni.
- `/scoperta` — routine proattiva (≥1 volta al giorno): esplora mail/Notion/calendario/repo recenti,
  confronta con la KB e mi fa 3-5 domande su novità e discrepanze, poi salva dopo le mie risposte.
- `/approfondisci` — backfill profondo dalle riunioni storiche (a batch): estrae conoscenza dal
  passato e mi fa molte domande sui punti incerti (le trascrizioni Notion sono di bassa qualità).

## Scoperta proattiva
Almeno una volta al giorno voglio che tu esegua `/scoperta`: leggi le fonti esterne (mail, Notion —
soprattutto riunioni private, pagine progetti e task —, calendario, repo toccate di recente,
facendo anche `pull`), estrai le novità della giornata e **fammi 3-5 domande** su ciò che non sai
ancora o che collide con quanto già in `note/` (es. una persona che cambia team, lo stato di un
progetto che cambia, un nuovo cliente). Non salvare nulla senza la mia conferma.
La cadenza giornaliera va impostata con un **trigger schedulato** su Claude Code on the web.

## Rapporto con l'auto-memory di Claude Code
L'auto-memory è **complementare**, non sostitutiva. La verità dei *contenuti* sta sempre in `note/`.
Va bene che l'auto-memory ricordi una mia preferenza ricorrente sul *modo di lavorare*
(es. "Simone preferisce riepiloghi brevi"); i *contenuti* vanno invece sempre in `note/`.
