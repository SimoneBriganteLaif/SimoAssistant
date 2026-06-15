# Catalogo interventi infra — completo (47 interventi)

> Prodotto in Fase B (workflow 6 agenti per area, 2026-06-11). Le quick win sono dettagliate in
> `quick-wins.md`; qui c'è **tutto**, classificato e costato, base per la roadmap (Fase D).
> Cifre € ancorate a `sintesi/01-baseline-costi.md`. Evidenze in `analisi/*` e `sintesi/00-findings.md`.

## Come leggere
- **Size**: `quick-win` (ore/pochi giorni, impatto immediato) · `small` (giorni) · `medium` (settimane) ·
  `large` (settimane/mesi, rework strutturale).
- **€/mese**: risparmio. `scope`: `fleet` (totale flotta) · `per-account` (1 account) · `one-off` (1 risorsa/account) ·
  `none` (nessun risparmio diretto — vale per monitoring/sicurezza/affidabilità).
- **Benefit** `c/m/s/r/x` = costo / monitoring / sicurezza / affidabilità / semplificazione, 0-3.
- **Applies**: `library` (fix nei default laif-cdk → si propaga a tutta la flotta) · `per-repo` · `org` · `tooling`.

## Modello di risparmio riconciliato (anti doppio-conteggio)

| Bucket | €/mese | Cosa contiene |
|---|---:|---|
| **Quick win (no re-architettura)** | **−900 / −1.300** | RI/SP, EC2 idle, RDS dev turnoff, backup dev, Config dev, cleanup, EIP idle |
| **Consolidamento VPC/account (lungo periodo)** | **−700 / −1.200** | meno "floor" di isolamento: ALB condivisi, IP privati, RDS dev multi-tenant, account ridotti |
| Single-account (a sé) | SFTP 110-223 · CociProd 90-200 | non scalano sulla flotta |

**Overlap da non sommare**: la riduzione IPv4 strutturale (€200-300, `COST-IPV4`/`NETSEC-01`) è **dentro** il
consolidamento; va contata **una volta**. Il consolidamento **subsume** i risparmi di floor (ALB, IPv4, RDS
dev): non è additivo sopra le quick win di floor, le **realizza per altra via**. Tetto realistico complessivo:
da **~39.700 $/anno a <25.000 $/anno** (baseline §5). La maggior parte degli interventi (35/47) ha `savings=none`:
il loro valore è **chiudere i down, il monitoring e i buchi di sicurezza**, non il risparmio.

---

## Tabella master (47 interventi)

### MON — Monitoring & Osservabilità (8)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| MON-01 | 4 alarm CloudWatch (fix Nivi) | quick-win | ✅ | none | ore | 0/3/0/3/1 | 1 |
| MON-04 | Topic SNS → Slack/email | small | ✅ | none | giorni | 0/3/1/3/1 | 1 |
| MON-02 | Container Insights ON | small | ✅ | spesa lieve | ore | 0/3/0/2/1 | 2 |
| MON-03 | RDS: PI + Enhanced Mon + log | small | ✅ | spesa lieve | ore | 0/3/0/2/1 | 2 |
| MON-07 | **DECISIONE A**: Checkmk + CloudWatch | medium | | none | settim. | 0/2/0/2/0 | 2 |
| MON-05 | Dashboard CloudWatch per-cliente | medium | | none | giorni | 0/3/0/1/1 | 3 |
| MON-06 | Log retention disciplinata | quick-win | ✅ | 0-30 fleet | ore | 1/1/0/0/2 | 3 |
| MON-08 | **DECISIONE B**: tutto CloudWatch, dismetti Checkmk | large | | none | settim. | 0/3/0/2/2 | 3 |

### SCALE — Affidabilità & Scaling (8)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| SCALE-01 | Defangare health check container | quick-win | ✅ | none | ore | 0/0/0/3/1 | 1 |
| SCALE-02 | 2+ worker applicativi | quick-win | ✅ | none | ore | 0/0/0/3/1 | 1 |
| SCALE-03 | desired_count=2 | quick-win | ✅ | none | ore | 0/0/0/3/0 | 1 |
| SCALE-06 | Circuit breaker + rollback | small | ✅ | none | ore | 0/1/0/2/0 | 1 |
| SCALE-04 | **ALB → servizio ECS** (dynamic ports/awsvpc) | medium | | none | settim. | 1/0/0/3/2 | 2 |
| SCALE-05 | Autoscaling applicativo on/off | medium | | none | settim. | 1/1/0/3/2 | 2 |
| SCALE-07 | Multi-AZ RDS opzionale (prod) | small | | none (↑costo) | giorni | 0/0/0/3/0 | 3 |
| SCALE-08 | Tag immagine immutabili | small | ✅ | none | giorni | 0/0/1/2/1 | 3 |

### NETSEC — Rete & Sicurezza (7)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| NETSEC-04 | Abilitare il WAF (già in libreria) | small | ✅ | none | ore | 0/1/3/1/0 | 1 |
| NETSEC-05 | SG hardening (SSH, ANY, password=username) | small | ✅ | none | giorni | 0/0/3/1/1 | 1 |
| NETSEC-01 | **RDS+workload in subnet private** (decisione NAT/endpoint) | large | | 200-300 fleet¹ | settim. | 2/0/3/1/1 | 1 |
| NETSEC-02 | OAC bucket frontend (no più pubblico) | medium | | none | giorni | 0/0/3/1/1 | 2 |
| NETSEC-03 | CloudFront→ALB: header segreto + HTTPS | medium | | none | giorni | 0/0/3/0/0 | 2 |
| NETSEC-06 | OIDC GitHub→AWS (no access key) | medium | | none | giorni | 0/0/3/1/2 | 2 |
| NETSEC-07 | VPC Flow Logs | quick-win | ✅ | none | ore | 0/3/2/1/0 | 3 |

### COST — Costi / FinOps (10)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| COST-RI-RENEW | RI/SP 1y (RI scadute 30/04) | quick-win | ✅ | 250-300 fleet | ore | 3/0/0/0/0 | 1 |
| COST-EC2-IDLE | Eliminare EC2 idle (1/2 unhealthy) | small | ✅ | 300-500 fleet | giorni | 3/0/0/1/1 | 2 |
| COST-RDS-DEV-TURNOFF | Auto-turnoff RDS dev (tag) | quick-win | ✅ | 150-250 fleet | ore | 3/0/0/0/1 | 3 |
| COST-CLEANUP-MISC | Pulizie (Secrets/CE-API/EBS/log) | small | ✅ | 60-90 fleet | giorni | 2/0/1/0/2 | 4 |
| COST-IPV4-REDUCE | Ridurre IPv4 (idle + 4→2/account) | medium | | 200-300 fleet¹ | settim. | 2/0/2/0/1 | 5 |
| COST-RDS-BACKUP-RETENTION | Backup RDS dev → 7gg | small | | 100-150 fleet | giorni | 2/0/0/0/1 | 6 |
| COST-COCIPROD-RIGHTSIZE | Right-size t4g.2xlarge CociProd | medium | | 90-200 per-acct | giorni | 2/1/0/0/0 | 7 |
| COST-SFTP-ONDEMAND | SFTP on-demand vs h24 | medium | | 110-223 one-off | giorni | 2/0/1/0/1 | 8 |
| COST-CONFIG-TUNING-DEV | Tuning AWS Config dev | small | | 60-100 fleet | giorni | 1/0/1/0/1 | 9 |
| COST-VPC-CONSOLIDATION-POTENTIAL | **Consolidamento VPC/account** (potenziale) | large | | 700-1200 fleet | mesi | 3/0/0/0/2 | 10 |

### TOOL — Tooling & Processo (8)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| TOOL-02 | **Eliminare laif-cli** (ricolloca 8 responsabilità) | large | | none | settim. | 0/1/2/1/3 | 1 |
| TOOL-04 | OIDC al posto di access key/GH_TOKEN | medium | | none | giorni | 0/0/3/1/2 | 1 |
| TOOL-05 | Pinnare laif-cdk a tag | quick-win | ✅ | none | ore | 0/0/1/3/1 | 1 |
| TOOL-06 | Cert/DNS nello stack (no doppio deploy) | medium | | none | settim. | 0/0/0/2/3 | 1 |
| TOOL-01 | Eliminare laif-deployer (uv + runner pinnati) | small | ✅ | none | giorni | 0/0/1/1/3 | 2 |
| TOOL-03 | CI per il deploy infra (oggi 0/24) | medium | | none | settim. | 0/1/3/2/2 | 2 |
| TOOL-07 | laif-dns modulare/automatizzato | medium | | none | settim. | 0/0/0/1/3 | 2 |
| TOOL-08 | values.yaml unica scheda (SSOT) | medium | | none | settim. | 0/0/0/1/3 | 2 |

### TASK — ETL & Task (6)
| ID | Intervento | Size | QW | €/mese | Effort | c/m/s/r/x | P |
|---|---|---|:-:|---|---|---|:-:|
| TASK-01 | **Modulo `jobs` dichiarativo** (cron/command/size/sync-async) | large | | none | settim. | 1/0/0/1/3 | 1 |
| TASK-04 | SQS con DLQ + visibility sano | small | ✅ | none | ore | 0/2/1/3/1 | 2 |
| TASK-02 | Task su Fargate (mai EC2 h24) | medium | | 10-40 fleet | giorni | 1/0/1/1/2 | 2 |
| TASK-03 | EventBridge Scheduler per i cron | small | | none | giorni | 0/1/0/1/2 | 3 |
| TASK-05 | Eliminare factory Step Functions custom (~1.300 righe) | medium | | none | settim. | 0/0/1/1/3 | 3 |
| TASK-06 | Eliminare background-task ETL + workflow FLG_ETL | medium | | none | giorni | 0/0/0/2/2 | 3 |

¹ IPv4: `COST-IPV4-REDUCE` e `NETSEC-01` quantificano lo **stesso** risparmio (IP privati) → contarlo **una volta**.

---

## Dettaglio per area (cosa fare + dipendenze)

### MON — il monitoring white-box che manca
Tutti `library` salvo le due decisioni (`org`). Sequenza: **MON-04 (SNS) prima**, poi MON-01 (alarm),
MON-02/03 (metriche per popolarli), MON-05 (dashboard, passiva senza alarm). Le due decisioni sono **alternative**:
- **MON-07 (consigliata)**: tenere **Checkmk** per up/down (già integrato con downtime e criticità per ambiente)
  + **CloudWatch** per il white-box. Pro: zero regressione, separa "l'host risponde?" da "perché va giù?".
  Contro: due sistemi da mantenere.
- **MON-08**: migrare **tutto su CloudWatch+SNS** (synthetics per l'up/down) e **dismettere Checkmk/LCP**. Pro:
  un solo sistema, tutto in CDK, niente registrazione manuale. Contro: si perde il ping **esterno indipendente
  da AWS** (un down di account/regione non si auto-segnala), costo Synthetics, va replicato il downtime programmato.
- ⚠️ **Non spegnere LCP/Checkmk** finché CloudWatch non copre almeno l'up/down (è l'unica osservabilità esistente).

### SCALE — chiudere i down e abilitare lo scaling
Quick win a 0 $ (SCALE-01/02/03/06) → vedi `quick-wins.md` §B. Il rework strutturale:
- **SCALE-04** (medio): l'ALB deve registrare il **servizio ECS**, non l'ASG di istanze (oggi `ecs.py:688-698` +
  bridge/hostPort statico = max 1 task/istanza). Passare a **dynamic host ports** o **awsvpc**. È lo sblocco che
  rende veri SCALE-03 (a 0 $) e SCALE-05. ⚠️ awsvpc consuma ENI/task (limite per t4g) → dimensionare; pilota prima.
- **SCALE-05** (medio): autoscaling applicativo vero (`auto_scale_task_count`, oggi mai chiamato sul backend),
  **on/off a config** (feature flag del brief). Default OFF, accendere per-cliente. Richiede SCALE-04.
- **SCALE-07**: Multi-AZ RDS **solo prod** (raddoppia il costo istanza → mai default flotta).
- **SCALE-08**: tag immutabili (mitiga il config drift repo↔prod visto su Nivi).

### NETSEC — la decisione di rete domina i costi
- **NETSEC-01** (large, P1): RDS+workload in **subnet private**. La VPC oggi ha una sola `SubnetConfiguration`
  (`networks.py:56-62`) → public+private **impossibili** senza riscrivere il construct. **Decisione di egress**
  (parametrizzata per ambiente):
  - (a) **NAT Gateway condiviso** per ambiente/regione — un NAT h24 ~35 $/mese × ~60 account ≈ **~2.000 $/mese**
    se fatto 1-per-account: **cancellerebbe tutto il quick win**. Solo se condiviso (peering/TGW/consolidamento).
  - (b) **Interface endpoints** (ECR api+dkr, Logs, Secrets, SSM, STS) ~7,3 $/mese ciascuno: per il pattern LAIF
    (pull immagine + log + secret) coprono quasi tutto → **evitano il NAT**. Spesso l'opzione migliore.
  - (c) **NAT instance** (fck-nat t4g.nano) ~3-4 $/mese: più economico del NAT GW, da gestire.
  - **Raccomandazione**: RDS in `PRIVATE_ISOLATED` (no egress, costo NAT zero); dev egress condiviso (endpoint o NAT
    condiviso); prod interface endpoints. ⚠️ Prima correggere il bug Lambda-in-VPC (`lambdas.py:61` usa
    `SubnetType.PRIVATE` inesistente). Sblocca il risparmio IPv4.
- **NETSEC-02/03** (medi): OAC bucket FE + header segreto/HTTPS CloudFront→ALB. **Trittico con NETSEC-04 (WAF)**:
  il WAF da solo, con bucket pubblico e ALB bypassabile, è **falsa sicurezza**.
- **NETSEC-06** (medio): **OIDC** GitHub→AWS. Definire il role in **CDK** → chiude anche la responsabilità
  imperativa che giustifica `wipeout`. Si fa convergere con TOOL-04 (stesso intervento, vista tooling vs sicurezza).

### COST — vedi `quick-wins.md` per le quick win
Resta qui il **bucket strutturale**:
- **COST-VPC-CONSOLIDATION-POTENTIAL** (large): il 43-52% della bolletta è floor di isolamento (~1.700 $/mese).
  Consolidare (VPC condivisa, 2-4 ALB host-routing, RDS dev multi-tenant, IP privati) comprime il floor di ~25
  account da ~1.700 a ~300-500 $/mese. ⚠️ Riduce isolamento/blast-radius/separazione billing per cliente: è la
  **decisione strategica #1** (findings §8), trade-off non solo di costo. Vincola COST-RI-RENEW (non riservare
  capacità che sparirà) e COST-IPV4 (gli IP privati sono parte del consolidamento).
- **COST-COCIPROD-RIGHTSIZE**: t4g.2xlarge a ~316 $/mese su 1 account. **Prima monitorare** (manca il dato),
  poi right-size; o RI dedicata (0 rischio prestazionale).
- **COST-SFTP-ONDEMAND**: endpoint h24 (211 $/mese) per pochi minuti d'uso → on-demand o Lambda+S3 presigned.

### TOOL — eliminare laif-cli/deployer, tenere laif-dns
Sequenza corretta (dal summary dell'agente): **prima OIDC + risorse CDK-owned** (TOOL-04 → elimina init project,
wipeout, GH_TOKEN), **poi CI** (TOOL-03), **poi convergenza CLI** (TOOL-02), **poi cert/DNS nello stack** (TOOL-06,
elimina il doppio deploy).
- **TOOL-02** (large): dismettere laif-cli ricollocando le **8 responsabilità** (`analisi/02` §6). **Punto critico**:
  far convergere `laif` (laif-factory) sul **NUOVO CDK**, **non** stabilizzare il branch `feat/new-app-skill` sul
  vecchio flusso (i 24 script automatizzano le assurdità esistenti → andrebbero riscritti). ⚠️ L'orfano è `lcp`
  (Checkmk): riconciliare con MON prima di spegnerlo.
- **TOOL-06**: certificato ACM **DNS-validated dallo stack** + service ECS che non fallisce al primo giro → niente
  `deploy_services false→true`, niente "primo deploy fallisce by design", niente DISTRIBUTION_ID copiato a mano.
  Dipende da TOOL-07 (DNS scrivibile).
- **TOOL-07**: laif-dns modulare (oggi monolite 1705 righe, PR a mano, no modifica in-place) → delega di zona per
  cliente o API DNS. Deduplicare la copia dentro laif-factory.
- **TOOL-08**: `values.yaml` come **unica scheda** (oggi info in ≥5 posti) → ospita i **feature flag** del brief
  (autoscaling, monitoring, ETL, db privato) così il CDK sintetizza solo ciò che è abilitato. Si lega al nuovo CDK.

### TASK — un solo modello per i task (brief #4)
- **TASK-01** (large, P1): **modulo `jobs` dichiarativo** nella config (`jobs: [{name, command, schedule, size,
  kind}]`). La libreria genera Fargate + EventBridge + SQS da questo blocco → elimina il fork di app.py (gmm/andriani/
  ferrari/prima-power/coci = 5 varianti dello stesso bisogno). Prerequisito di TASK-02/03/04/05.
- **TASK-02** (medio): **Fargate** default per i task (mai EC2 capacity provider h24). ⚠️ Verificare i task pesanti
  (c7g.4xlarge andriani) vs limiti Fargate (16 vCPU/120 GB); GPU/speciali restano EC2 opt-out.
- **TASK-05** (medio): **buttare la factory Step Functions custom** (~1.300 righe) → DSL CDK nativo. 0/24 repo la
  importano → rischio basso.
- **TASK-06**: far convergere su `jobs` i background-task nel backend (competono col single-vCPU → co-causa Nivi) e
  il workflow GH gemello `FLG_ETL=1`.

---

## Note di sintesi per la roadmap (Fase D)
1. **Catena del valore immediato**: RI/SP + 4 alarm/SNS + fix Nivi a 0 $ + WAF + pin laif-cdk → risparmio subito,
   down chiusi, sicurezza, **senza** toccare l'architettura. È la "Fase 0/quick win".
2. **Sblocco strutturale**: NETSEC-01 (subnet private + decisione egress) e SCALE-04 (ALB→ECS service) sono i due
   rework `library` da cui dipende quasi tutto il resto (IPv4, scaling vero, autoscaling, sicurezza DB).
3. **Convergenza tooling**: TOOL-04→03→02→06 è una catena ordinata; il rischio maggiore è **stabilizzare due volte**
   (branch attuale vs nuovo CDK).
4. **Le 3 decisioni strategiche** (consolidamento account/VPC, monitoring Checkmk-vs-CloudWatch, convergenza tooling)
   vanno prese **in Fase C** perché vincolano sequenza e cifre.
