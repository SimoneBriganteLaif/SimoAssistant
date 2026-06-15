# Architettura target — la nuova infrastruttura LAIF

> Visione d'insieme del ridisegno (Fase C, 2026-06-11). Sintetizza il design degli 8 moduli prodotti
> dal workflow (un agente per modulo). Dettaglio dei moduli in `moduli-cdk.md`; processo/repo/tooling in
> `repo-strategy.md`. Decisioni vincolanti in `../STATO.md`.

## 1. I principi (cosa cambia nella filosofia)

1. **Una libreria modulare, non un monolite.** Si sostituisce `laif-cdk` (un `TemplateStack` da 804 righe,
   56 parametri, VPC+RDS+ECS+ALB+CloudFront insieme) con **moduli componibili** (`NET`, `DATA`, `COMPUTE`,
   `EDGE`, `OBS`, `JOBS`) assemblati da una **scheda di configurazione** unica.
2. **Sicuri-by-default, non sicuri-by-opt-in.** Si **ribaltano** i default rotti: RDS privato, WAF on,
   monitoring on, niente IP pubblici sul workload, health check sano, circuit breaker on. Le cose buone
   (encryption, deletion protection, RETAIN, backup, GP3 autoscaling, scan ECR) restano e **non** sono flag
   spegnibili.
3. **Config-driven, feature flag on/off.** Lo stack disabilitato **non viene sintetizzato** (non è un flag
   a posteriori). `autoscaling`, `monitoring`, `db_private`, `multi_az`, `waf`, `jobs`, `auto_turnoff` si
   accendono/spengono per app e per ambiente. È la "modularità on/off" del brief.
4. **Tutto CDK-owned.** Niente più AWS imperativo fuori da CloudFormation (le 705 righe di boto3 di
   laif-cli spariscono): utenti/role/cert/secret diventano risorse CDK → niente drift, niente `wipeout`.
5. **Wolico come unico cruscotto.** Il white-box (CloudWatch) **alimenta Wolico**, che già è l'hub
   applicativo (errori, health, maintainer). Niente Checkmk (morto). Un solo posto dove guardare.
6. **~15 righe di YAML per cliente.** Il contenuto utile di una repo infra crolla da centinaia di righe
   clonate a una scheda `values.yaml`; `app.py` è generato e identico per tutti.

## 2. Le 3 decisioni strategiche, applicate

| Decisione (Simone, GATE C) | Conseguenza di design |
|---|---|
| **Isolamento account MANTENUTO** | Niente VPC condivisa. Egress delle subnet private via **interface endpoints per-account** (non NAT condiviso). RDS in `PRIVATE_ISOLATED`. Il bucket "consolidamento −700/−1.200 $/mese" esce dal tavolo: il risparmio è quello delle quick win + IP privati + RI/SP. |
| **Monitoring → arricchire Wolico** | `OBS` produce alarm/Insights CloudWatch → SNS → **endpoint ingest su Wolico** (push per-account, coerente con l'isolamento). Checkmk/LCP **eliminato** → sparisce l'orfano #8 del kill di laif-cli. |
| **Convergere su `laif` + nuovo CDK** | Si eliminano laif-cli e laif-deployer; si tiene laif-dns (reso modulare via delega di zona). `laif` (laif-factory) diventa il front-end umano del nuovo CDK. |

## 3. As-is → To-be (il "deployment tipo")

```
─────────────────────────── OGGI (rotto by default) ───────────────────────────
CloudFront ──http chiaro──> ALB :80 ──> ASG(2× t4g.small) ──> 1 task ECS (bridge, hostPort fisso)
   │                           (1 istanza idle/unhealthy)        desired=1, health check killer
   └─> S3 website PUBBLICO     RDS Postgres PUBBLICO (EIP)        no autoscaling, no circuit breaker
VPC: solo subnet pubbliche · 0 NAT · 0 WAF · 0 alarm utili · :latest · monitoring solo Wolico(errori app)

─────────────────────────── DOMANI (sicuro by default) ─────────────────────────
CloudFront(OAC + WAF) ──https + header segreto──> ALB :443 condiviso ──> servizio ECS (awsvpc/Fargate)
   │                                                 (target = servizio, non ASG)   desired=2, autoscaling on/off
   └─> S3 PRIVATO (OAC)        RDS Postgres PRIVATE_ISOLATED (no IP pubblico, Multi-AZ opt-in prod)
VPC 3-tier: public(solo ALB)+private(ECS)+isolated(RDS) · interface endpoints (no NAT) · Flow Logs
alarm CloudWatch (CPU/RAM/5xx/UnHealthyHost/RDS) ─SNS─> Wolico (errori app + alarm infra + health)
jobs: Fargate on-demand/scheduled + SQS+DLQ + Step Functions native (mai EC2 h24)
```

## 4. La nuova libreria: moduli e grafo delle dipendenze

```
                       ┌─────────────── CONFIG (scheda values.yaml, SSOT) ───────────────┐
                       │  identity · defaults · apps[] · feature flag · naming derivato  │
                       └───────────────────────────┬────────────────────────────────────┘
                                        compone l'AppStack (solo i moduli ON)
                                                    │
        ┌──────────────┬───────────────┬───────────┼───────────────┬───────────────┐
        ▼              ▼               ▼           ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌──────────┐  ┌────────┐    ┌──────────┐    ┌──────────┐
   │  NET    │◄───│  DATA   │    │ COMPUTE  │  │  EDGE  │    │   JOBS   │    │   OBS    │
   │ VPC 3t  │    │  RDS    │    │ ECS+ALB  │  │ CF+WAF │    │ Fargate  │    │ alarm→   │
   │ endpoint│    │ private │    │ scaling  │  │  OAC   │    │ SQS/SFN  │    │ Wolico   │
   └─────────┘    └─────────┘    └──────────┘  └────────┘    └──────────┘    └──────────┘
       ▲ root          │              │            │              │              ▲
       └───────── tutti consumano NET (vpc + subnets_for) ────────┘    OBS osserva COMPUTE/DATA/JOBS
```

- **NET** è la radice: espone `subnets_for(tier)` (chiude il bug Lambda-in-VPC) e gli interface endpoint.
- **OBS** è trasversale: riceve i riferimenti di COMPUTE/DATA/JOBS e ne sottoscrive gli alarm → Wolico.
- **CONFIG** non è infra: è il modello pydantic della scheda che **compone** l'`AppStack` istanziando solo
  i moduli i cui flag sono ON.
- Sopra a tutto c'è il layer di **processo** (`repo-strategy.md`): packaging pinnato, OIDC, CI, cert/DNS.

## 5. Cosa risolve (mappa ai problemi del brief)

| Brief | Come lo risolve l'architettura |
|---|---|
| #1 zero monitoring | `OBS`: alarm-set on di default (i 4 del caso Nivi + RDS) + Container/Performance Insights → **Wolico** |
| #2 no scaling orizz. | `COMPUTE`: ALB→**servizio** ECS (awsvpc), `autoscaling` on/off a config (oggi mai cablato) |
| #3 risposta ai down | `COMPUTE`+`DATA`: health check sano, desired=2, circuit breaker, Multi-AZ opt-in — il fix Nivi a 0 $ |
| #4 ETL/task | `JOBS`: modulo dichiarativo `jobs:[]` → Fargate scheduled/on-demand/queue + SFN native, mai EC2 h24 |
| #5 laif-cdk sporco | moduli minimali + scheda; muoiono Step Functions custom (~1.640 righe), stack mai usati, laif-cli/deployer |
| #6 DB pubblici | `NET`+`DATA`: RDS `PRIVATE_ISOLATED`, workload in subnet private, interface endpoints |
| #7 LB non sfruttati | `COMPUTE`: ALB **condiviso** per account (multi-app host/path), target = servizio; autoscaling reale |
| #8 account isolati | **mantenuti** per scelta; il risparmio viene da quick win + IP privati + RI/SP (non dal consolidamento) |

## 6. L'impatto in numeri (sintesi, da `interventi/` e `sintesi/01`)

- **Costi**: quick win **−900/−1.300 $/mese** (RI/SP, EC2 idle, auto-turnoff dev, backup, Config, cleanup,
  IP privati). Il consolidamento (−700/−1.200) è rinunciato per tenere l'isolamento. Tetto: da ~39.700 a
  **~26.000-29.000 $/anno**. *(Nota: gli interface endpoint costano ~36 $/mese/account ma sostituiscono i
  442 $/mese di IPv4 pubblici di flotta e chiudono il rischio sicurezza — saldo positivo.)*
- **Affidabilità**: il "caso Nivi" (127 min di down) **non si ripete** con health check sano + desired=2 +
  circuit breaker + i 4 alarm — a costo ~0.
- **Sicurezza**: chiusi i 6 bloccanti (RDS pubblico, bucket FE pubblico, ALB bypassabile, SSH al mondo,
  password=username, access key statiche larghe) — quasi tutti `library`, si propagano a tutta la flotta.
- **Monitoring**: da black-box (solo errori app su Wolico) a **white-box** (CPU/RAM/disco/RDS/5xx) sullo
  stesso cruscotto Wolico.
- **Semplificazione**: onboarding da ~21-37 passi manuali a **1 PR (laif.yaml) + 1 delega NS + merge**;
  contenuto utile di una repo infra da centinaia di righe clonate a **~15 righe** + `app.py` generato.

## 7. La scheda `values.yaml` (il cuore della modularità) — esempio reale

Sostituisce dev.yaml + prod.yaml + `app.py` copia-incollato + ARN/id hardcoded. Esempio (prima-power, con
2 app sullo stesso account → risolve il vincolo "1 infra ↔ N app" senza forkare nulla):

```yaml
schema_version: 2
identity:
  customer: prima-power
  domain_zone: app.laifgroup.com
  accounts:
    dev:  { account_id: "111111111111", profile: prima-power-dev }
    prod: { account_id: "975707451837", profile: LaifProd }
  region: eu-west-1
defaults:                 # sicuri-by-default
  monitoring: true        # CloudWatch -> SNS -> Wolico
  db_private: true        # RDS PRIVATE_ISOLATED
  waf: true               # era 0/24
  multi_az: false         # opt-in solo prod (raddoppia il costo RDS)
  autoscaling: false      # opt-in per-app
  eip: false              # niente IP pubblici sul workload
  auto_turnoff: false     # ON nei dev
apps:
  - name: prima-power     # naming derivato: {env}-prima-power-stack, prima-power.app.laifgroup.com
    db: { name: prima_power, engine_version: "17.6", multi_az: true }
    compute: { instance_class: t4g.medium }
    flags: { autoscaling: true }
    jobs:                 # il modulo JOBS si compone solo se questa lista esiste
      - { name: inventory, kind: scheduled, size: medium, schedule: "cron(30 5 * * ? *)", command: "run etl ..." }
      - { name: export-to-pst, kind: scheduled, size: small, schedule: "cron(0 1 * * ? *)", command: "run etl --steps EXP ...", environments: [prod] }
  - name: prima-pilot     # 2ª app, stesso account (era prima_pilot_default_stack in app.py)
    db: { name: prima_pilot, engine_version: "15.7" }
    flags: { auto_turnoff: true, waf: false }
environments:
  dev:  { defaults: { auto_turnoff: true, waf: false } }
  prod: { defaults: { multi_az_allowed: true } }
```

## 8. Rischi architetturali da non sottovalutare (da gestire in Fase D)
- **Migrazione di rete = REPLACE, non update.** Cambiare la topologia VPC di un cliente esistente forza la
  ricreazione di VPC/RDS/ECS → si migra per cutover (account/stack target + snapshot RDS + swap DNS), **non**
  in-place. I clienti nuovi (Casartelli/GreenEnergy) nascono già sul target.
- **Interface endpoints vs egress reale.** Se un'app chiama API esterne non-AWS, in subnet private serve
  `needs:[internet]` (NAT instance fck-nat) o perde connettività uscente: mappare per cliente.
- **Cert cross-account.** La DNS-validation automatica richiede la zona delegata (TOOL-07): finché un
  cliente non è delegato, `dns.managed:false` (cert a mano) per non bloccarlo.
- **"Stabilizzare due volte".** Far convergere `laif` sul **nuovo** CDK, non sul branch attuale che
  automatizza il vecchio flusso.
- **Domande aperte raccolte dagli agenti** (contratto endpoint Wolico, ECS Exec endpoints, soglia
  Fargate-vs-EC2, dev isolation): elencate in `moduli-cdk.md` §Domande aperte — da sciogliere prima/durante
  l'implementazione dei rispettivi moduli.
