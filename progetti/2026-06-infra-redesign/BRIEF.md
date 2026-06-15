# Brief — Ridisegno infrastruttura LAIF (giugno 2026)

Richiesta di Simone, 2026-06-10. Questo file è il riferimento per tutti gli agenti di analisi.

## Contesto
LAIF gestisce ~60+ account AWS (uno per cliente/ambiente: `<cliente>-dev`, `<cliente>-prod`),
con infrastruttura definita via **AWS CDK in Python** attraverso la libreria interna `laif-cdk`
(`~/LAIF/repo/laif-cdk`), repo infra per cliente (`~/LAIF/repo/<cliente>-infra`), e tooling di
deploy `laif-cli` + `laif-deployer`. La creazione di nuove app passa da `laif-factory` (`laif init`),
ritenuta troppo macchinosa.

## Problemi dichiarati
1. **Zero monitoring**: nessun monitoraggio di macchine/backend → i clienti si accorgono dei down
   prima di LAIF. Nessuna metrica osservata su CPU/memoria/disco, né sui database. Nessun allarme.
2. **Zero scalabilità orizzontale**: un picco di chiamate butta giù i backend. I load balancer
   esistono ma non vengono sfruttati (non c'è autoscaling dietro).
3. **Risposta sbagliata ai down**: es. Nivi (prod) andava giù → si è aumentata la taglia della
   macchina backend e del database. Approccio "scale up a mano" invece di capire la causa.
4. **Nessuna soluzione pulita per ETL/task**: oggi o background task nel backend o `etl_stack`;
   manca un modo uniforme per task piccoli/medi/grandi, sincroni/asincroni/on-demand.
5. **laif-cdk sporco e ridondante**: ~90% degli stack/funzionalità non usati. Da buttare e rifare.
6. **Sicurezza**: i database NON sono in rete privata.
7. **Load balancer pagati ma non sfruttati** (niente scaling orizzontale dietro).
8. **Account isolati per cliente**: valutare anche approcci alternativi (es. VPC unica condivisa)
   in ottica costi.

## Obiettivi
- **Quick win orientate al RISPARMIO COSTI** + monitoraggio (capire perché/come le app vanno giù).
- **Piano di migrazione totale** a lungo termine: nuova libreria infra modulare, minimale, pulita.
  - Continuare con **AWS CDK in Python**.
  - **Eliminare** laif-cli e laif-deployer. **Tenere** la parte DNS (laif-dns).
  - Moduli semplici per i mattoni ricorrenti: RDS, S3, backend ECS, frontend, ecc.
  - Feature attivabili/disattivabili a configurazione (es. scalabilità orizzontale on/off).
  - Valutare: nuova repo infra per cliente vs infra dentro la repo di progetto.
    Vincolo noto: alcuni clienti hanno 1 repo infra + 2 repo progetto (es. due app sullo stesso
    account) — superabile se la modularità è fatta bene.
  - Deploy più semplici, infra più facile da modificare, più efficace.
- Ogni intervento proposto va classificato: piccolo/medio/grande, con beneficio, costo di
  realizzazione, risparmio in € (o $) mensile, guadagno in monitoring/semplificazione.

## Vincoli operativi per gli agenti
- Su AWS SOLO operazioni **read-only** (describe/list/get). Mai modificare nulla.
- Regione principale: `eu-west-1`. Account management/billing: profilo `laif` (Cost Explorer
  consolidato funzionante, `aws organizations` funzionante).
- Le repo locali sono la fonte per il codice; gli account AWS per lo stato reale deployato.
