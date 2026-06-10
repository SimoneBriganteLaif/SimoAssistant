---
titolo: LAIF Tech Stack
id: laif-tech-stack
tipo: progetto
tag: [lavoro, laif, interno]
stato: attivo
creato: 2026-06-08
aggiornato: 2026-06-09
fonti: ["Notion DB Progetti", "intervista /avvio 2026-06-08", "approfondimento riunioni 12-13/05 (Notion) 2026-06-09"]
correlati:
  - "[[Simone Brigante]]"
  - "[[Team Blue]]"
  - "[[Laif]]"
  - "[[Laif Factory]]"
  - "[[Laif Agent]]"
  - "[[Carlo Venditti]]"
  - "[[Wolico]]"
---

# LAIF Tech Stack

- **Codice commessa**: 2024000 — interno ([[Laif]]), stato "Continuo"
- **Owner**: [[Simone Brigante]] (riunioni ricorrenti "stack interno" / "AI in LAIF")

Iniziativa trasversale sullo **stack interno** di Laif. Convenzione: **le repo che iniziano con `laif-` fanno parte dello stack interno**.

## Componenti
- **[[Laif Factory]]** (`laif-factory`) — mono-repo: SuperCLI `laif`, agenti, skill, wiki/KB, sistema eval/improver. Sostituisce gradualmente **Just** nei template.
- **[[Laif Agent]]** — agente AI su documenti (in fase di design/architettura a mag 2026; su AWS Bedrock).
- **laif-template** — template applicativo comune (versionato, es. 5.9.x; upstream propagato a tutte le app). Storicamente avviato con **Just** (`just run all`), in migrazione verso la CLI `laif`.
- Altre repo: `laif-cli`, `laif-cdk`, `laif-deployer`, `laif-dns`, `laif-infra`, `laif-scripts`.
- **[[Wolico]]** — portale interno (repo `wolico`), senza prefisso `laif-` ma parte dell'ecosistema interno.

## Temi aperti (mag 2026)
- **Monitoring/alerting** su backend (ECS) e DB (RDS): problema critico DB pieno → app down senza notifica. Approccio: metriche CloudWatch + alert, integrazione su [[Wolico]].
- **PyPI interno** self-hosted per distribuire librerie comuni (client Bedrock, parser).
- Allocazione di 1-2 risorse dedicate allo stack interno (focus previsto in estate).
- **Team stack interno dedicato**: proposta (Simone + [[Carlo Venditti]]) di **2 FTE full-time senza delivery**, esperimento 2-4 mesi **da agosto**, su monitoring/observability/migrazioni/[[Laif Factory]] — da proporre ai founder.
- **Feedback Bounty** (proposta di Carlo): meccanismo a incentivi per condividere insight/lessons-learned cross-team (integrazioni sottostimate, stime sbagliate); primo passo = **retrospettiva di fine commessa**.
