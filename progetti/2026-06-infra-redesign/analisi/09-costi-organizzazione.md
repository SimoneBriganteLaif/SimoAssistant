# 09 — Analisi costi dell'organizzazione AWS (Cost Explorer consolidato)

Data analisi: 2026-06-10 · Profilo: `laif` (management account 339712916302, ruolo AWSAdministratorAccess) ·
Metrica: **UnblendedCost**, regione di billing globale (risorse quasi tutte in `eu-west-1`, con `eu-south-1` da maggio).

> **Avvertenza metodologica.** Dal 2026-05-01 la bolletta è interamente coperta da **crediti AWS**
> (`RECORD_TYPE=Credit` = −3.308,50 $ a maggio, che azzera esattamente l'Usage). Tutte le cifre di questo
> report sono quindi calcolate **escludendo Credit/Refund/Tax** (filtro `Not RECORD_TYPE in [Credit,Refund,Tax]`),
> per fotografare il costo reale delle risorse. Le imposte (IVA) aggiungono ~19–22% (apr 2026: 558,56 $).
> Comando base: `aws ce get-cost-and-usage --profile laif --metrics UnblendedCost --filter '{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}' ...`

---

## 1. Trend mensile org (giu 2025 → mag 2026)

Costo risorse = Usage + Recurring (fee RI), tasse escluse e mostrate a parte.

| Mese | Usage $ | Recurring (fee RI) $ | Risorse $ | Tax $ | Totale fatturato $ |
|---|---:|---:|---:|---:|---:|
| 2025-06 | 2.331,40 | 224,06 | 2.555,47 | 0,00 | 2.555,47 |
| 2025-07 | 2.310,54 | 231,53 | 2.542,07 | 0,00 | 2.542,07 |
| 2025-08 | 2.302,41 | 231,53 | 2.533,94 | 515,03 | 3.048,97 |
| 2025-09 | 2.340,80 | 224,06 | 2.564,86 | 564,27 | 3.129,13 |
| 2025-10 | 2.490,22 | 231,53 | 2.721,75 | 598,79 | 3.320,54 |
| 2025-11 | 2.392,12 | 224,06 | 2.616,18 | 575,56 | 3.191,74 |
| 2025-12 | 2.340,13 | 231,53 | 2.571,66 (+**Upfront RI 1.512,00**) | 898,41 | **4.982,08** |
| 2026-01 | 1.885,71 | 231,53 | 2.117,24 | 465,79 | 2.583,03 |
| 2026-02 | 1.894,16 | 209,13 | 2.103,29 | 462,72 | 2.566,00 |
| 2026-03 | 2.159,67 | 231,53 | 2.391,20 | 525,66 | 2.916,87 |
| 2026-04 | 2.332,82 | 206,46 | 2.539,28 | 558,56 | 3.097,84 |
| 2026-05 | **3.308,50** | 0,00 | **3.308,50** | 0,00* | 0,00* (coperto da crediti) |

\* a maggio crediti −3.308,50 $ azzerano la fattura; le tasse non maturano su importo a zero.

- Run-rate attuale: **~3.300 $/mese di risorse ≈ 39.700 $/anno** (al lordo IVA ~46.000 $/anno), **+29% YoY** (2.555 → 3.308).
- Picco dic-2025 (4.982 $) = acquisto **Upfront RI 1.512 $** + tax 898 $ (`RECORD_TYPE=Upfront` su dicembre).
- Il salto apr→mag (+769 $ di risorse) **non è crescita di workload**: vedi §5 (scadenza RI il 30/04/2026 + nuovo deployment Sinergia in eu-south-1).

## 2. Maggio 2026 per account (classifica, costi risorse)

70 account nell'org (`aws organizations list-accounts`), **66 con costo >0, 57 sopra 5 $, 29 sopra 40 $, 11 sopra 90 $**.
Totale maggio: **3.308,50 $**. Top 20:

| # | Account | ID | $ mag 2026 | Nota |
|---|---|---|---:|---|
| 1 | **CociDev** | 746669202399 | **447,24** | t4g.2xlarge h24 (207 $) + 113,61 $ di CPUCredits: **un account DEV è il più costoso dell'org** |
| 2 | DataTransfer | 490004644050 | 231,58 | quasi tutto AWS Transfer Family: 1 endpoint SFTP h24 (223,20 $ di ProtocolHours) |
| 3 | SphProd | 211125341777 | 223,32 | RDS 75 $ + EC2 55 $ + **AWS Config 37,97 $** (outlier org: 8 $ medi altrove) |
| 4 | FipProd | 471112861870 | 158,37 | 1,6 ALB (29,48 $) + 6,4 IP pubblici (23,66 $) + WAF 5,96 $ |
| 5 | SabartProd | 043309343598 | 141,27 | RDS 69 $ (backup 11,57 $) |
| 6 | SinergiaProd | 318938007988 | 123,85 | di cui 58,36 $ in **eu-south-1** (nuovo da maggio) |
| 7 | VoltanProd | 440744240180 | 113,08 | RDS 47,64 $ con backup 19,06 $ |
| 8 | Wolico | 430118840542 | 110,78 | tooling interno: ALB+RDS+ECS+Config |
| 9 | UmbraProd | 386318839910 | 106,94 | 6,1 IP pubblici (22,72 $) |
| 10 | CociProd | 084828598996 | 99,64 | |
| 11 | BenozziProd | 011528292209 | 98,08 | |
| 12 | FipDev | 590183869288 | 86,04 | |
| 13 | PeopleProd | 914052798585 | 84,17 | |
| 14 | AndrianiProd | 539247473114 | 74,54 | |
| 15 | Production | 654654481895 | 68,30 | |
| 16 | LaifVpn | 850995538436 | 66,39 | VPN aziendale |
| 17 | PerriProd | 934565991082 | 65,89 | |
| 18 | AmatoriProd | 267580591605 | 64,29 | |
| 19 | NiviProd | 546054511770 | 64,27 | l'account dei "down" costa solo 64 $/mese |
| 20 | SinergiaDev | 822267359031 | 61,14 | 40,49 $ in eu-south-1 |

Account "infrastruttura LAIF" (non cliente): Laif 57,88 $ (di cui **44,34 $ di API Cost Explorer**, 4.434 chiamate × 0,01 $),
OCS 59,17, LaifVpn 66,39, Production 68,30, Development 20,31, LogArchive 15,05, Audit 0,24, Wolico 110,78 → **~398 $/mese di overhead piattaforma**.
Account a ~0 $: CasartelliDev/Prod e GreenEnergyDev/Prod (creati dopo maggio, non ancora in fattura), Lbs, PrimaPowerDev, BlqProd, CrifProd, KerakollProd, PairDev (0,03 $ cad.).

## 3. Maggio 2026 per servizio (org-wide)

| Servizio | apr $ | mag $ | % mag |
|---|---:|---:|---:|
| Amazon RDS | 542,37 | **888,11** | 26,8% |
| EC2 - Compute | 416,76 | **697,16** | 21,1% |
| Elastic Load Balancing | 473,67 | **487,83** | 14,7% |
| **VPC (= IPv4 pubblici)** | 427,28 | **441,83** | 13,4% |
| AWS Transfer Family | 216,95 | 224,97 | 6,8% |
| EC2 - Other (EBS, CPUCredits, DT) | 167,88 | 201,63 | 6,1% |
| AWS Config | 100,01 | 161,29 | 4,9% |
| AWS Cost Explorer | 46,78 | 44,34 | 1,3% |
| CloudWatch | 37,94 | 38,84 | 1,2% |
| Secrets Manager | 33,72 | 35,12 | 1,1% |
| S3 | 24,99 | 28,25 | 0,9% |
| ECS (Fargate) | 12,69 | 23,02 | 0,7% |
| ECR | 10,58 | 12,66 | 0,4% |
| WAF / Textract / KMS / Bedrock / R53 / CloudFront | ~26 | ~23 | 0,7% |

Tre evidenze immediate:
- **VPC = 4ª voce di spesa ed è composta solo da indirizzi IPv4 pubblici** (non c'è alcun NAT Gateway nell'org: zero voci `NatGateway-*` su 319 usage type). Le subnet sono pubbliche, **DB inclusi** (conferma problema #6 del brief).
- **ELB 487,83 $ ma LCU totali 0,83 $**: i load balancer processano traffico pressoché nullo (LCUUsage org-wide = 0,81 $ EU + 0,02 EUS1). Si paga l'ora-ALB, non il traffico → conferma problema #7 ("LB pagati ma non sfruttati").
- **CloudWatch 38,84 $ = 1,2%**: la spesa di monitoring è quasi inesistente (AlarmMonitorUsage 13,99 $, MetricsUsage 8,30 $) — coerente col problema #1 "zero monitoring".

## 4. Drill-down per USAGE_TYPE (maggio 2026, org-wide — 319 voci, top aggregate)

| Macro-voce | $ /mese | % | Dettaglio (usage type principali) |
|---|---:|---:|---|
| EC2 BoxUsage (istanze) | 634,32 | 19,2% | t4g.2xlarge 223,47 (CociDev 207!) · t4g.medium 145,01+15,24 · t4g.small 112,44 · t4g.large 87,26 · t3.small 33,99 · c7g.4xlarge 10,51 |
| ALB ore accese | 487,00 | 14,7% | EU-LoadBalancerUsage 469,75 + EUS1 17,25 = 19.292 h ≈ **26 ALB h24** |
| RDS ore istanza | 483,60 | 14,6% | db.t4g.small 151,06+15,89 · db.t4g.micro 148,23 · db.t4g.medium 132,06 · Multi-AZ 36,11 → flotta ≈ 20 micro + 5,8 small + 2,6 medium |
| **IPv4 pubblici** | **441,83** | **13,4%** | InUse 414,01 + **Idle 27,80** = 88.366 ore-IP ≈ **119 IP pubblici** a 3,72 $/IP/mese (0,005 $/h) |
| RDS backup extra | 228,98 | 6,9% | ChargedBackupUsage (retention oltre la dimensione del DB), spalmato su 52 account |
| SFTP Transfer Family | 223,20 | 6,7% | EU-ProtocolHours 744 h × 0,30 $ = **1 endpoint SFTP sempre acceso** (account DataTransfer) |
| RDS storage | 174,04 | 5,3% | GP3 162,96+1,62 · Multi-AZ-GP3 6,91 · GP2 2,54 |
| AWS Config | 161,29 | 4,9% | ConfigurationItemRecorded 147,99 EU + 9,85 EUS1 (+50% vs aprile: churn risorse) |
| **CPUCredits t4g** | 124,12 | 3,8% | **113,61 $ solo CociDev** (2.840 vCPU-h di burst!), 8,77 CociProd → istanze burstable sottodimensionate in unlimited |
| Data transfer | 74,63 | 2,3% | DT-Out 67,19 + Regional 5,91 — trascurabile |
| EBS | 71,68 | 2,2% | gp3 68,33+2,47, gp2 0,88 |
| Cost Explorer API | 44,34 | 1,3% | 4.434 richieste × 0,01 $ **tutte dall'account Laif** (polling di qualche script/tool) |
| CloudWatch | 38,84 | 1,2% | allarmi 13,99 + metriche custom 8,30 + resto logs/API |
| Secrets Manager | 35,12 | 1,1% | ~88 secret × 0,40 $ |
| Fargate | 22,84 | 0,7% | vCPU 18,73 + GB 4,11 — quasi tutto il compute è EC2, non Fargate |

## 5. Spiegazione del salto aprile→maggio (+769 $): le RI sono scadute il 30/04/2026

Prova con `UsageQuantity` (la flotta NON è cresciuta, ha solo perso la copertura):

| Usage type | apr: ore (≈istanze) → costo OD | mag: ore (≈istanze) → costo OD |
|---|---|---|
| EU-BoxUsage:t4g.small | 14.041 h (19,5) → **0,00 $** (RI) | 12.548 h (16,9) → **112,44 $** |
| EU-InstanceUsage:db.t4g.micro | 14.976 h (20,8) → 11,41 $ | 14.671 h (19,7) → **148,23 $** |
| EU-InstanceUsage:db.t4g.small | 3.980 h (5,5) → 11,79 $ | 4.316 h (5,8) → **151,06 $** |
| EU-BoxUsage:t4g.medium | 3.840 h (5,3) → 13,94 $ | 3.941 h (5,3) → **145,01 $** |
| EU-InstanceUsage:db.t4g.medium | 1.440 h (2,0) → 21,15 $ | 1.914 h (2,6) → **132,06 $** |

- Ad aprile le fee RI no-upfront (`EU-HeavyUsage:*` = RECORD_TYPE Recurring) valevano **206,46 $/mese**
  (db.t4g.micro 75,19 + t4g.small 58,33 + db.t4g.small 43,44 + t4g.medium 29,50) e coprivano **~13.200 ore-istanza/mese**.
  A maggio sono **tutte a 0**: non rinnovate.
- `get-reservation-utilization`: aprile 16.134 ore acquistate (≈22 istanze), util 100%, valore on-demand 398,73 $, fee ammortizzata 237,83 $, **risparmio netto 160,89 $/mese**. Maggio: solo 2.976 ore.
- Effetto netto della mancata-rinnovazione: le 6 famiglie t4g/db.t4g passano da 89,77 $ OD + 206,46 fee = 296 $ → **776,06 $ on-demand**: **+480 $/mese di extra-costo**.
- Altro contributo al salto: **eu-south-1 (Milano) compare a maggio** con ~99 $ (SinergiaProd 58,36 + SinergiaDev 40,49: ALB 17,25 + IPv4 16,09 + db.t4g.small 15,89 + t4g.medium 15,24 + Multi-AZ 14,04 + Config 9,85).

### Savings Plans / RI esistenti
- **Savings Plans: nessuno** (`get-savings-plans-utilization` → `DataUnavailableException`).
- **RI attive oggi: una sola subscription** — 4× **t4g.medium EC2, Standard 1 anno All-Upfront**, comprate il
  2025-12-10 (Upfront 1.512 $ in fattura dicembre, che include anche RI poi scadute ad aprile), scadenza **2026-12-10**, account Laif (condivisa org-wide),
  ARN `arn:aws:ec2:eu-west-1:339712916302:reserved-instances/a5946176-0bb1-4dc3-854e-6aa6a69866b4`,
  utilizzo 100%, risparmio netto 44,97 $/mese.

## 6. Il "costo fisso per account": la tassa dell'isolamento

Footprint standard misurato di un account **prod** (pattern ripetuto identico su ~21 account):

| Componente | $/mese/account | Evidenza |
|---|---:|---|
| 1 ALB sempre acceso | 18,75 | 744 h × 0,0252 $ — 21 account hanno esattamente 18,75 $ |
| 4 IPv4 pubblici (2 ALB + EC2 + RDS pubblico) | 14,89 | 2.977 ore-IP ≈ 4,0 IP nella quasi totalità dei prod |
| RDS db.t4g.micro dedicato | 13,39 | 744 h × 0,018 $ (~20 micro nell'org = 1 DB per account) |
| RDS storage GP3 + backup | ~7,7 | medie org: storage 3,3 + backup 4,4 |
| AWS Config | ~3,0 | ConfigurationItemRecorded per account |
| CloudWatch + Secrets + KMS | ~2,5 | |
| **Floor per account (senza compute applicativo)** | **~60 $** | |

- **Tassa di piattaforma org-wide** (costi che esistono solo perché ci sono ~60 VPC/account separati):
  ALB 487 + IPv4 442 + Config 161 + RDS backup 229 + Secrets 35 + CW 39 + KMS 3 + CE API 44 = **1.440 $/mese = 43,5% della bolletta**.
  Aggiungendo il floor RDS micro (1 DB/account, ~268 $) si arriva a **~1.700 $/mese = 52%** prima di un solo container applicativo.
- Conferma indiretta: la **mediana** dei 29 account ≥40 $ è ~65 $/mese — cioè la maggior parte degli account paga *quasi solo il floor*.
- In uno scenario consolidato (VPC condivisa, 2–4 ALB con host-routing, RDS multi-tenant per i dev, IP privati):
  il floor di ~25 account prod+dev "veri" si comprime da ~1.700 a ~300–500 $/mese.

## 7. Tabella finale: voce → costo → quota → comprimibilità

| Voce | $/mese | % | Comprimibile? Come | Stima risparmio |
|---|---:|---:|---|---:|
| EC2 istanze (BoxUsage) | 634 | 19,2% | RI/SP 1-anno (vedi sotto) + right-sizing CociDev | incluso sotto |
| ALB | 487 | 14,7% | LCU≈0 → consolidare su 2–4 ALB condivisi con host-based routing (scenario VPC unica); nel modello attuale: spegnere ALB dev fuori orario | −350/−440 |
| RDS istanze | 484 | 14,6% | RI RDS 1y no-upfront (~35%); nei dev: DB condiviso multi-schema | −150/−250 |
| IPv4 pubblici (119) | 442 | 13,4% | DB e EC2 in subnet private (risolve anche il problema sicurezza #6), eliminare 27,80 $ di IP **idle**; da 4 a 2 IP/account | −200/−300 |
| RDS backup extra | 229 | 6,9% | retention oltre free-tier: riportare a 7gg nei dev, verificare prod | −100/−150 |
| SFTP Transfer Family | 223 | 6,7% | endpoint h24 nell'account DataTransfer: valutare accensione a richiesta o Lambda+S3 presigned | −110/−223 |
| RDS storage | 174 | 5,3% | gp3 già ok; pulizia volumi over-provisioned | −20/−50 |
| AWS Config | 161 | 4,9% | escludere tipi di risorsa ad alto churn nei dev; recorder daily invece che continuous | −60/−100 |
| CPUCredits t4g | 124 | 3,8% | 113 $ è CociDev: right-size della t4g.2xlarge (o spegnerla: account DEV) | −90/−110 |
| Data transfer | 75 | 2,3% | trascurabile | 0 |
| EBS | 72 | 2,2% | snapshot/volumi orfani da audit | −10/−20 |
| Cost Explorer API | 44 | 1,3% | 4.434 call dall'account Laif: cache o ridurre frequenza polling | −35/−40 |
| CloudWatch | 39 | 1,2% | NON tagliare: qui bisogna SPENDERE di più (monitoring assente) | +50/+150 |
| Secrets Manager | 35 | 1,1% | consolidare secret per account; SSM Parameter Store per i non-rotati | −15/−25 |
| Fargate/ECS | 23 | 0,7% | ok | 0 |
| **Mancato rinnovo RI (Δ già in EC2/RDS)** | (+480) | — | **ricomprare RI 1y (o SP) su flotta t4g/db.t4g**: 776 $ OD → ~500 $ | **−250/−300** |
| **Totale risorse** | **3.308** | 100% | Quick win senza re-architettura | **−900/−1.300 (27–40%)** |
| | | | + consolidamento account/VPC (lungo periodo, §6) | ulteriori −700/−1.200 |

Nota strategica: da maggio 2026 la fattura è **coperta da crediti AWS** (−3.308,50 $/mese). Ogni dollaro di quick win
non riduce l'esborso di oggi ma **allunga la durata dei crediti** — e il run-rate a crediti finiti è quello su cui
si giudica il ridisegno: 39.700 $/anno oggi, comprimibile sotto i 25.000 $/anno.

## 8. Comandi usati (riproducibilità)

```bash
aws ce get-cost-and-usage --profile laif --time-period Start=2025-06-01,End=2026-06-01 \
  --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=RECORD_TYPE \
  --filter '{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund"]}}}'          # trend
# idem con Start=2026-05-01,End=2026-06-01 e group-by LINKED_ACCOUNT | SERVICE | USAGE_TYPE
# breakdown top account: filtro And[Not RECORD_TYPE, Dimensions LINKED_ACCOUNT=<id>] group-by SERVICE
# usage-type per account: filtro Dimensions USAGE_TYPE in [...] group-by LINKED_ACCOUNT, metrics UnblendedCost UsageQuantity
aws organizations list-accounts --profile laif                                                   # 70 account
aws ce get-reservation-utilization --profile laif --time-period Start=2026-05-01,End=2026-06-01 \
  --group-by Type=DIMENSION,Key=SUBSCRIPTION_ID                                                  # RI attive
aws ce get-savings-plans-utilization --profile laif ...                                          # DataUnavailableException → nessun SP
```
JSON grezzi salvati in `/tmp/laif-costi/` (trend-mensile, maggio-per-account, maggio-per-servizio, maggio/aprile-usagetype, acct-*.json, accounts.json).
