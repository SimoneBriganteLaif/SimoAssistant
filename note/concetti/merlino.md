---
titolo: Merlino
id: merlino
tipo: concetto
tag: [lavoro, laif, interno]
stato: attivo
creato: 2026-06-09
aggiornato: 2026-06-09
fonti: ["approfondimento riunione 19/05 'Gestione della Conoscenza di Progetto e Merlino' (Notion) 2026-06-09", "conferma Simone 2026-06-09"]
correlati:
  - "[[Laif Factory]]"
  - "[[Laif Agent]]"
  - "[[LAIF Tech Stack]]"
  - "[[Simone Brigante]]"
  - "[[Bonfiglioli Consulting — Pianificazione carico team]]"
---

# Merlino

Agente **knowledge** dello stack interno LAIF (distribuito via [[Laif Factory]]). È, di fatto, la **versione "aperta a tutti" di ciò che Simone sta costruendo con questo assistente personale**: un agente che tiene **documentati i progetti** e **genera le minute** da inviare ai clienti.

## Cosa fa (workflow)
Dopo una call, lanciato via Claude Code: pesca transcript + note da **Notion** → confronta con lo stato attuale del progetto → fa uno **step di validazione interattivo** (domande, come in questa sessione) → salva un `preprocess.md` → aggiorna i file "processed". Genera anche **task** (3-10 per call).

Si attiva taggando **`@merlino`** + link Notion; prende transcript **+** note prese a mano (non il riassunto auto-generato), fa **10-15 domande wizard** di verifica, poi aggiorna il knowledge su approvazione. Stato: **alpha** (mag 2026). I task generati confluiranno nel sistema task interno **"Ocean"** (in arrivo).

## Architettura della conoscenza di progetto — `core_knowledge` (3 livelli)
Unica fonte di verità, niente duplicazioni:
1. **Raw** — `calls/AAAA-MM-GG/<id-call-Notion>/` (transcript, note, immagini, documenti), `documents/`, `commercial documents/` (Project Card, contratti), `mail/`, `analisi/`. Le call restano su Notion (fonte primaria), referenziate via URL.
2. **Preprocess** — `preprocess.md` per call: output intermedio (riassunto + Q&A di validazione + istruzioni di merge), da validare.
3. **Processed** (la "verità" letta dagli agenti): **Stato progetto** (la "Project Card effettivata", più ricca/tecnica), **Decision Log** (changelog decisioni, incluso ciò che è stato scartato), **Domain Glossary**, **Business Process**, **Page Architecture**, **Scope & Boundaries**. File statici obbligatori + file dinamici custom per progetto.

`WorkflowState.json` mappa i file raw già analizzati. La skill **Project Context** indirizza gli agenti ai file processed.

## Note
- La conoscenza si aggiorna **solo sul branch develop**; un solo membro fa girare Merlino per progetto; conflitti → rigenerare o merge manuale.
- Merlino è "conversazionale": **non** passa dal *"trattore"* (il motore/orchestratore delle skill di sviluppo, fatto da Simone).
- Piloti: [[Bonfiglioli Consulting — Pianificazione carico team]] ([[Lorenzo Tonetta]]) e "Gemma" (Francesco). In valutazione la qualità delle trascrizioni (Notion vs Teams vs Whisper).
- Limiti attuali (mag 2026): genera troppi file (~50), distingue male "si fa / non si fa", import da Notion ancora manuale.

> Parallelo: questa repo personale (**SimoAssistant**) adotta lo stesso modello a livelli — input grezzo `inbox/` → note processate, con indice, log, glossario e wikilink. È il banco di prova personale di ciò che Merlino deve diventare per tutti.
