# Caso di studio: "Nivi va giù" — analisi forense (account nivi-prod 546054511770, eu-west-1)

Data analisi: 2026-06-10. Fonti: AWS read-only (profilo `nivi-prod`, CE dal profilo `laif`), repo `~/LAIF/repo/nivi-infra`, libreria `~/LAIF/repo/laif-cdk`.

## TL;DR

Nivi **non andava giù per mancanza di risorse**: andava (e va ancora) giù perché un **health check
del container troppo aggressivo** (curl su `/` ogni 5s, timeout 5s, 2 retry — hardcoded in
`laif-cdk/laif_cdk/stacks/template_stack.py:501-506`) **uccide l'unico task ECS** appena il backend
single-worker satura **1 solo vCPU** sotto i picchi di traffico (CPU max inchiodata al 50% di un host
2-vCPU per ore). Con `desired_count=1` e nessuna replica, ogni kill = **2-5 minuti di downtime**
(target group a 0 host healthy → 502/503 dall'ALB). **127 minuti di down totali tra il 27/5 e il 10/6**.

L'upsize fatto (4/6: EC2 t4g.small→t4g.medium; 9/6: RDS db.t4g.micro→db.t4g.small + Postgres 15→17)
**non ha risolto**: t4g.medium ha gli **stessi 2 vCPU** di t4g.small (solo RAM raddoppiata, che non era
il collo di bottiglia del backend), e infatti **oggi 10/6 ECS ha sostituito il task per unhealthy 3 volte**
(09:11, 10:30, 12:48 CEST) con 6 minuti di down. Costo dell'upsize: **+26,6 $/mese (+103% sul compute)**,
oggi mascherato dai crediti AWS.

---

## 1. Inventario risorse (stato al 2026-06-10)

### ECS
| Risorsa | Valore | Evidenza |
|---|---|---|
| Cluster | `prod-nivi-credit-be-cluster` (Container Insights **disabled**) | `aws ecs describe-clusters --include SETTINGS` |
| Servizio | `prod-nivi-credit-be-service`, **desiredCount=1**, running=1 | `aws ecs describe-services` |
| Launch | EC2 (capacity provider `nivi-credit-prod-be-cp`, managed scaling target 100%) | `aws ecs describe-capacity-providers` |
| ASG | `nivi-credit-prod-be-asg`: min 0 / max 2 / desired 1, istanza `i-015ee4a422023bf1e` **t4g.medium** (2 vCPU / 4 GB), subnet pubblica, IP pubblico 34.250.13.171 | `aws autoscaling describe-auto-scaling-groups` |
| Task def | `prod-nivi-credit-be-task:3` (registrata 2026-06-04 10:44 CEST): rete **bridge**, container `backend`, cpu=0 (nessuna riserva), **memoryReservation=1024 MiB** (soft, nessun hard limit), porta 8000→**hostPort 80 statico** | `aws ecs describe-task-definition` |
| Health check container | `curl -f http://localhost:8000/ \|\| exit 1`, **interval 5s, timeout 5s, retries 2**, startPeriod 60s | task def + `template_stack.py:501-506` |
| Deployment | ROLLING, min 50% / max 200%, **circuit breaker disabilitato**, healthCheckGracePeriod=0 | `describe-services` |
| Storia task def | rev 1 (27/7/2025) e rev 2 (19/9/2025): memoryReservation **512 MiB**; rev 3 (4/6/2026): **1024 MiB** | `describe-task-definition` rev 1-3 |
| Storia istanza | Launch template `lt-07b17042ffd9b3849`: v1-v2 = **t4g.small**, **v3 (2026-06-04 08:44 UTC) = t4g.medium**, creata da CloudFormation (deploy CDK) | `describe-launch-template-versions`, CloudTrail `CreateLaunchTemplateVersion` |

### RDS
| Campo | Valore |
|---|---|
| Istanza | `prod-nivi-db`, PostgreSQL **17.10**, classe **db.t4g.small** (2 vCPU / 2 GB), creata 27/7/2025 |
| Storage | 20 GB gp3 (max autoscaling 100 GB), liberi ~16,8 GB (nessun problema disco) |
| **PubliclyAccessible: true** | in subnet pubblica (default `subnet_type=ec2.SubnetType.PUBLIC` in `laif-cdk/laif_cdk/constructs/db.py:72`); SG `sg-042283d831de43ccb` limita la 5432 a 1 IP (54.246.152.243/32) + SG del backend |
| Multi-AZ | no; backup giornaliero 22:35-23:05 UTC |
| Storia | 2/6 02:04 UTC: minor upgrade 15.12→15.17 (maintenance). **9/6 10:18-10:27 UTC: major upgrade 15.17→17.10 + cambio classe micro→small** (CloudTrail `ModifyDBInstance` del 9/6 12:18 CEST da ruolo CloudFormation: `dBInstanceClass: db.t4g.small, engineVersion: 17.10, applyImmediately: true`; eventi RDS: "Applying modification to database instance class" 10:24 UTC). Il DB è rimasto giù ~9 min per l'upgrade + ~2 min per il resize |

### ALB / Target group / CDN
- ALB `prod-nivi-credit-be-alb` (internet-facing, 3 AZ, creato 19/9/2025), **un solo listener HTTP:80**;
  il TLS termina su CloudFront `E1FLIETZTVTYJJ` (alias `nivi-credit.app.laifgroup.com`, origini: S3 FE + ALB).
- Target group `prod-nivi-credit-be-targets` (HTTP:80): health check su `/`, **interval 5s, timeout 4s**,
  healthy/unhealthy threshold 2/2 (default `alb_healthcheck_interval_seconds: int = 5` in `template_stack.py:98-100`).
- **1 solo target registrato** (l'unico task). ALB pagato ~18,2 $/mese (CE aprile) per bilanciare... 1 nodo.

### VPC / rete
- VPC app `vpc-0c02c17f8ade37e24` (10.0.0.0/16): **solo 3 subnet pubbliche**, **zero NAT gateway** (risparmio,
  ma tutto — EC2, RDS — ha IP pubblico). Seconda VPC 172.31.0.0/16 (data transfer). 3 EIP associati.

### Allarmi CloudWatch
- **ZERO allarmi applicativi**. Gli unici 2 alarm esistenti (`TargetTracking-nivi-credit-prod-be-asg-AlarmHigh/Low`
  su `CapacityProviderReservation`) sono auto-creati dal managed scaling ECS. Nessun alarm su CPU, memoria,
  5xx, UnHealthyHostCount, RDS. Conferma il problema #1 del brief: i down li scoprono i clienti.

---

## 2. Forensica: le metriche (11/4 → 10/6, CloudWatch `get-metric-data`, periodo 1h)

### Crescita del traffico
RequestCount ALB: aprile ~800-5.800 req/giorno → maggio 7.500-13.000 → giugno **13.700-23.000 req/giorno**
(picco 4/6: 22.972). Il carico è ~4-5x rispetto ad aprile; nei weekend resta ~830/giorno (bot/monitor).

### Il pattern del down (giorni con minuti a 0 target healthy)
| Giorno | Min DOWN (0 healthy) | Min degradati (≥1 unhealthy) | ELB 5xx | Target 5xx | ECS CPU max | Note |
|---|---|---|---|---|---|---|
| 27/5 | 10 | 64 | 20 | 0 | 49,3% | |
| 28/5 | 3 | 91 | 12 | 0 | 49,8% | |
| 29/5 | 6 | 65 | 38 | 0 | 49,2% | |
| **3/6** | **37** | **229** | **372** | 0 | 49,9% | giorno peggiore |
| 4/6 | 29 | 176 | **807** | 0 | 50,0% | **giorno dell'upsize EC2** |
| 5/6 | 15 | 98 | 116 | 0 | 50,0% | dopo upsize EC2 |
| 8/6 | 9 | 51 | 119 | 0 | 49,8% | |
| 9/6 | 12 | 144 | 313 | 422 | 49,9% | giorno upsize RDS (DB giù 10:18-10:27 UTC) |
| **10/6** | **6** | **71** | 23 | 0 | 49,8% | **dopo ENTRAMBI gli upsize: ancora down** |

Totale: **127 minuti di down** (HealthyHostCount=0, periodo 60s) tra il 25/5 e il 10/6; 25/5 e 26/5 hanno
avuto inoltre 281 errori Target 5xx (errori applicativi, non di infrastruttura).

### ECS: CPU è il collo di bottiglia, non la memoria
- `CPUUtilization` max si inchioda a **~50% per ore** nei giorni di down (3/6 h10-12 UTC: 48,8-49,9%;
  4/6 h10: 50,0%; 9/6 h10-12: 49,6-49,9%). Il container non ha riserva CPU (cpu=0) → la metrica è relativa
  ai 2 vCPU dell'host: **50% = 1 vCPU saturo**. Il backend usa un solo worker/core; il secondo vCPU resta inutilizzato.
  Vale sia su t4g.small sia su t4g.medium: **hanno entrambi 2 vCPU** (il medium aggiunge solo RAM).
- `MemoryUtilization` media 80-110% *della soft reservation di 512 MiB* prima del 4/6 (max 143% il 20/5
  = ~730 MiB usati) → in assoluto ~450-560 MiB su un host con 2 GB: **mai vicino all'esaurimento host**.
  Nessun evento OOM nei service events; gli stop sono tutti "failed container health checks" /
  "replaced 1 tasks due to an unhealthy status".
- Credito CPU EC2: istanza in modalità **unlimited** (`describe-instance-credit-specifications`) → nessun
  throttling da burstable.

### RDS: sotto pressione di memoria, ma non causa primaria
- `CPUUtilization` max 37-60% nei giorni di down (un solo picco anomalo 99,7% il 23/4); media giornaliera 4-7%.
- `FreeableMemory` min **28-36 MB** (su 1 GB del micro) nei giorni di carico, con `SwapUsage` fino a
  **457 MB il 3/6**: il micro swappava → query più lente nei picchi (concausa di lentezza, non di kill).
- `DatabaseConnections` max **48** (9/6) — lontano dal limite (~110 per un micro con
  `max_connections = LEAST(DBInstanceClassMemory/9531392, 5000)`): **niente esaurimento connessioni**.
- `CPUCreditBalance` min 253 su 288 (mai esaurito, salvo reset a 0 il 9/6 per il cambio classe).
- `FreeStorageSpace` stabile ~16,8 GB: **niente problema disco**.
- Dopo l'upsize (10/6): FreeableMemory min 683 MB, swap ~0 — il resize DB ha effettivamente eliminato lo swap.

### La meccanica esatta del down (esempio 10/6, service events ECS)
```
12:48:58 started task ea231032 ... "replaced 1 tasks due to an unhealthy status"
12:52:23 stopped 1 running tasks (61d07b28)        ← il vecchio task viene ucciso
12:56:42 started b22b7a2c ... "replaced 1 tasks due to an unhealthy status"  ← anche il nuovo fallisce subito
```
Sequenza: picco richieste → l'unico worker satura 1 vCPU → `curl /` (timeout 5s) fallisce 2 volte in 10s →
ECS marca unhealthy e avvia un sostituto (~2,5-4 min tra pull immagine e startPeriod 60s) → nel frattempo
anche l'ALB (timeout 4s, threshold 2) toglie il target → **0 healthy → 502/503**. Con `desired_count=1`
non esiste ridondanza che assorba il transitorio. Nelle ultime 34h osservabili (eventi ECS): **9 cicli di
sostituzione task**. I task fermati non sono più descrivibili (`describe-tasks` → MISSING, retention ~1h),
ma i service events riportano esplicitamente "failed container health checks" (es. 9/6 11:06:39, task a28486e7).

---

## 3. L'upsize: cosa è stato fatto, cosa è costato, cosa ha risolto

### Cronologia (tutta via CloudFormation/CDK — CloudTrail)
| Data | Intervento | Prima → Dopo |
|---|---|---|
| 4/6 08:44 UTC | EC2 backend | t4g.small (2 vCPU/2 GB) → **t4g.medium (2 vCPU/4 GB)**; memoryReservation 512→1024 MiB (task def rev 3) |
| 9/6 10:18-10:27 UTC | RDS | db.t4g.micro (2 vCPU/1 GB) → **db.t4g.small (2 vCPU/2 GB)** + PostgreSQL 15.17→17.10 (con ~11 min di DB down in orario lavorativo, 422 Target-5xx e 206 ELB-5xx nell'ora) |

**Config drift**: `nivi-infra/prod.yaml` committato dice ancora `rds_major_version: "15"` / `rds_full_version: "15.7"`
e non specifica né instance type né memoria (ultimo commit `a7b988b` del 13/5/2026, working tree pulito).
I default di `laif-cdk` sono `rds_instance_type=t4g.micro` (`template_stack.py:74`) e
`backend_cluster_instance_type=t4g.small` (`template_stack.py:90-92`). **I deploy del 4/6 e 9/6 sono partiti
da una working copy mai committata**: il codice in repo non riproduce la prod.

### Costo (prezzi effettivi da Cost Explorer, profilo `laif`, usage type EU)
| Risorsa | Prima | Dopo | Delta |
|---|---|---|---|
| EC2 `EU-BoxUsage:t4g.small` → `t4g.medium` | 0,0184 $/h = 13,4 $/mese | 0,0368 $/h = 26,9 $/mese | **+13,4 $/mese (+100%)** |
| RDS `EU-InstanceUsage:db.t4g.micro` → `db.t4g.small` | 0,0170 $/h = 12,4 $/mese | 0,0350 $/h = 25,6 $/mese | **+13,1 $/mese (+106%)** |
| **Totale upsize** | 25,8 $/mese | 52,5 $/mese | **+26,6 $/mese ≈ +319 $/anno (+103%)** |

Contesto: l'intero account nivi-prod costa ~64 $/mese (maggio: Usage 64,27 $, **interamente azzerati da
crediti AWS** — record type Credit -64,27 $). L'ALB da solo vale ~18,2 $/mese, ~28% del conto, per servire un
singolo target. Quando i crediti finiranno, l'upsize sarà spesa reale.

### Verdetto: era la risposta giusta?
- **EC2 t4g.small→medium: NO.** Il collo di bottiglia era 1 vCPU saturo da un'app single-worker; il medium
  ha gli stessi 2 vCPU. La RAM host non era esaurita (container a ~550 MiB su 2 GB). Infatti: 4/6 (dopo
  l'upsize) è stato il giorno con più ELB 5xx (807), e il 10/6 il task è stato ucciso ancora 3 volte.
- **RDS micro→small: PARZIALMENTE sì** (unico intervento con una base: FreeableMemory a 30 MB e swap a
  457 MB erano reali), ma non era la causa dei kill, e farlo con un major upgrade 15→17 `applyImmediately`
  alle 12:18 ora italiana ha causato esso stesso ~11 min di down e centinaia di 5xx.
- La causa radice (health check killer + zero repliche + app monoworker) **non costa nulla da sistemare**.

---

## 4. Cosa avrebbe risolto il problema (in ordine di costo/beneficio)

1. **Defangare l'health check container** (`template_stack.py:501-506`): interval 30s, retries 3-5,
   endpoint `/health` leggero non bloccato dal worker applicativo. Costo: 0 $. Elimina la maggior parte dei kill.
2. **2+ worker applicativi** (gunicorn/uvicorn `--workers 2-4`): sfrutta il secondo vCPU già pagato. Costo: 0 $.
3. **desired_count=2** dietro l'ALB già pagato (vero fix della classe di problemi "un task = un down").
   Oggi è bloccato dal **hostPort 80 statico in bridge mode** (1 solo task per istanza, `ecs.py` port mapping):
   servono dynamic host ports (hostPort 0) o awsvpc; con 2 task sulla stessa t4g.medium il costo extra è 0 $,
   con 2 istanze t4g.small si torna a +13,4 $/mese ma con vera ridondanza ed è comunque ≤ dell'upsize fatto.
4. **Circuit breaker/rollback e allarmi**: oggi deploymentCircuitBreaker=false, alarms=none. Un alarm su
   `UnHealthyHostCount>0` e su `HTTPCode_ELB_5XX_Count` (SNS→Slack) avrebbe fatto scoprire i down a LAIF
   invece che al cliente. Costo: ~0 (primi 10 alarm gratis).
5. **Tenere il resize RDS** (giustificato dallo swap) ma pianificare i major upgrade fuori orario.

## 5. Lezioni per il ridisegno (generalizzabili alla fleet)
- I default di `laif-cdk` producono ovunque questo pattern: 1 task, health check 5s/5s/2, bridge+hostPort
  statico, niente alarm, niente autoscaling del servizio (il "managed scaling" dell'ASG scala le *istanze*,
  non i *task*: desired resta 1 per sempre), DB e EC2 in subnet pubbliche senza NAT.
- Il monitoraggio minimo per evitare il "caso Nivi" è banale: 4 alarm CloudWatch per account
  (ELB 5xx, UnHealthyHostCount, RDS FreeableMemory, RDS CPUCredit) + Container Insights.
- Config drift repo↔prod: senza pipeline che vincola il deploy al commit, la repo infra non descrive la
  realtà (qui: Postgres 15 in repo, 17 in prod; t4g.small implicito in repo, medium in prod).
