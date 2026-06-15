# Sintesi A.1 — Baseline costi (verificata 2026-06-11)

> Consolida `analisi/09-costi-organizzazione.md` (maggio 2026) con una **ri-verifica live su Cost
> Explorer** del 2026-06-11 (profilo `laif`, management account `339712916302`, read-only). Metrica
> UnblendedCost, escludendo `Credit/Refund/Tax`. Questa è la **base € per le stime di risparmio** della
> Fase B. Tutte le cifre sono "costo risorse" (la fattura reale è 0 da maggio perché coperta da crediti).

## 0. Risultato della ri-verifica (giugno conferma maggio)

| Mese | Costo risorse $ | Note |
|---|---:|---|
| 2026-04 | 2.539 | ultimo mese con RI attive |
| 2026-05 | 3.308 | RI scadute il 30/04 → +769 vs aprile |
| 2026-06 (MTD 01-10, 10 gg) | **1.108** → run-rate **~3.320/mese** | **stabile**: nessuna crescita di workload, RI ancora scadute |

**Run-rate confermato: ~3.300 $/mese ≈ 39.700 $/anno** (+IVA ~46.000 $/anno), **+29% YoY**.
La fattura è **azzerata dai crediti AWS** da maggio: ogni $ di quick win oggi **allunga la durata dei
crediti**; il giudizio sul ridisegno è sul run-rate a crediti finiti.

Per-servizio giugno-MTD (×3 ≈ mensile) — **identico a maggio**: RDS ~900, EC2 ~775, ELB ~490,
VPC/IPv4 ~446, Transfer Family ~211, Config ~157, EC2-Other ~108, Bedrock ~38, Secrets ~36,
CloudWatch ~29, ECS ~27, S3 ~26.

## 1. Le 4 voci che fanno il 64% della bolletta

| # | Servizio | $/mese | % | Perché (causa) |
|---|---|---:|---:|---|
| 1 | **RDS** | ~888 | 27% | ~20 db.t4g.micro + 6 small + 3 medium (1 DB/account) + **backup extra 229 $** + storage 174 $ |
| 2 | **EC2 compute** | ~697 | 21% | flotta t4g + **CociProd t4g.2xlarge ~316 $/mese da sola** (vedi §3) + CPUCredits |
| 3 | **ELB (ALB)** | ~488 | 15% | **~26 ALB h24** ma **LCU totali 0,83 $**: si paga l'ora, non il traffico → "LB pagati e non sfruttati" (brief #7) |
| 4 | **VPC = IPv4 pubblici** | ~442 | 13% | **~119 IP pubblici** (incl. 27,80 $ **idle**). Zero NAT nell'org: tutto in subnet pubbliche, **DB inclusi** (brief #6) |

CloudWatch è **1,2% (~39 $)**: la spesa di monitoring è quasi inesistente → conferma "zero monitoring"
(brief #1). Qui il ridisegno deve **spendere di più**, non tagliare.

## 2. La "tassa dell'isolamento" — il 43-52% della bolletta è overhead fisso

**Floor per account prod** (~60 $/mese, pattern identico su ~21 account) prima di un solo container utile:

| Componente | $/mese/account |
|---|---:|
| 1 ALB h24 | 18,75 |
| 4 IPv4 pubblici (2 ALB + EC2 + RDS) | 14,89 |
| RDS db.t4g.micro | 13,39 |
| RDS storage + backup | ~7,7 |
| Config + CloudWatch + Secrets + KMS | ~5,5 |
| **Floor (zero workload)** | **~60** |

**Costi che esistono SOLO perché ci sono ~60 VPC/account separati**: ALB 487 + IPv4 442 + Config 161
+ RDS backup 229 + Secrets 35 + CW 39 + KMS 3 + CE-API 44 = **1.440 $/mese = 43,5%**. Aggiungendo il
floor RDS (~268 $) si arriva a **~1.700 $/mese = 52%**. La **mediana** dei 29 account ≥40 $ è ~65 $/mese
→ la maggioranza degli account paga *quasi solo il floor*.

Implicazione strategica: la leva di risparmio più grande non è il right-sizing, è **ridurre il numero di
floor** (consolidamento VPC/account, ALB condivisi, IP privati) — vedi Fase C.

## 3. Movimenti notevoli giugno vs maggio (dalla ri-verifica)

- **Il t4g.2xlarge "mostro" si è spostato da CociDev a CociProd.** A maggio CociDev era #1 dell'org
  (447 $, di cui 207 BoxUsage + 113 CPUCredits). A giugno CociDev è sceso a ~105 $/mese (istanza
  spenta/ridotta) ma **CociProd è ora #1** con **t4g.2xlarge a 105 $/10gg ≈ 316 $/mese da una sola
  istanza** + 8,5 $/10gg di CPUCredits. → resta una **quick win prioritaria**, ora su **prod** (capire
  perché Coci gira su 8 vCPU/16 GB; right-size o riservare).
- **Nuovi account dev in fattura**: CreamaDev (~58/mese proj.), NespakDev (~56), OlympusDev (~52) —
  non c'erano a maggio. La flotta cresce di ~3-4 account/mese → la tassa di isolamento **aumenta**.
- **Casartelli e GreenEnergy (dev+prod) ancora a 0** (account day-zero, deploy del 10/06). Il loro
  costo a riposo stimato è ~170 $/mese/cliente (vedi `analisi/07`).
- **Bedrock in crescita**: ~38 $/mese (era trascurabile) → GenAI in più progetti, da monitorare.
- **AWS Transfer Family 211 $/mese** = 1 endpoint SFTP h24 (account DataTransfer) per pochi minuti
  d'uso reale: candidato a on-demand / Lambda+S3 presigned.

## 4. Stato Reserved Instances / Savings Plans

- **Savings Plans: nessuno.**
- **RI attive: una sola** — 4× t4g.medium EC2 Standard 1y All-Upfront (comprata 2025-12-10, scade
  2026-12-10), util 100%, risparmio netto ~45 $/mese.
- **Le RI di aprile NON sono state rinnovate** (scadute 30/04): coprivano ~13.200 ore-istanza/mese
  (206 $/mese di fee) → da maggio le 6 famiglie t4g/db.t4g costano **+480 $/mese on-demand**. È il
  singolo intervento di risparmio più grande e a sforzo quasi nullo: **ricomprare RI/SP 1y**.

## 5. Tabella di comprimibilità (base per la Fase B)

| Voce | $/mese | Come comprimere | Risparmio stimato $/mese |
|---|---:|---|---:|
| Mancato rinnovo RI/SP | (+480) | ricomprare RI/SP 1y su t4g/db.t4g | **−250/−300** |
| ALB | 488 | LCU≈0 → consolidare su pochi ALB condivisi (host-routing); spegnere ALB dev fuori orario | −350/−440 |
| IPv4 pubblici | 442 | DB+EC2 in subnet private (risolve anche sicurezza #6), eliminare 28 $ idle, 4→2 IP/account | −200/−300 |
| RDS istanze | 484 | RI RDS 1y; nei dev DB condiviso multi-schema + auto-turnoff | −150/−250 |
| RDS backup extra | 229 | retention 7gg nei dev, verificare prod | −100/−150 |
| SFTP Transfer Family | 223 | endpoint on-demand / Lambda+S3 presigned | −110/−223 |
| Config | 161 | escludere tipi ad alto churn nei dev; recorder daily | −60/−100 |
| CPUCredits/CociProd t4g.2xlarge | ~316+ | right-size o RI dedicata della 2xlarge Coci | −90/−200 |
| EC2 idle (1 istanza/2 unhealthy) | ~27/acct | fix host-port/scaling: 1 istanza basta | −300/−500 (flotta) |
| RDS dev h24 (auto-turnoff deployato ma OFF) | ~8/acct | attivare il tag `Auto-TurnOff=True` già pronto | −150/−250 (flotta) |
| Secrets / CE-API / EBS orfani / CloudFront logs | ~120 | consolidare/pulire | −60/−90 |
| CloudWatch | 39 | **NON tagliare**: qui si spende di più (monitoring) | **+50/+150** |
| **Totale quick win (senza re-architettura)** | **3.320** | | **−900/−1.300 (27-40%)** |
| + consolidamento account/VPC (lungo periodo) | | meno floor (§2) | ulteriori **−700/−1.200** |

**Tetto teorico**: da ~39.700 $/anno a **sotto i 25.000 $/anno** (−37%+), con monitoring e autoscaling
oggi assenti aggiunti dentro questo budget.

## 6. Riproducibilità
Query base: `aws ce get-cost-and-usage --profile laif --metrics UnblendedCost --filter
'{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Refund","Tax"]}}}'` con
`--group-by DIMENSION:SERVICE|LINKED_ACCOUNT|USAGE_TYPE`. Mappa id→nome:
`aws organizations list-accounts`. Dettaglio metodologico completo in `analisi/09`.
