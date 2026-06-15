# Quick win — interventi a basso sforzo (risparmio + chiusura buchi gravi)

> Sottoinsieme del catalogo (`catalogo-interventi.md`) con effort **ore / pochi giorni** e impatto
> immediato: o **risparmio diretto** o **chiusura di un buco grave** (down a costo 0, sicurezza).
> Prodotto in Fase B (workflow 6 agenti, 2026-06-11). Cifre € ancorate a `sintesi/01-baseline-costi.md`.
> 20 quick win su 47 interventi totali.

## TL;DR — i risparmi quick win, riconciliati

La somma grezza degli agenti (€2.030-3.260/mese fleet) **gonfia**: l'IPv4 era contato due volte
(COST-IPV4 ≡ porzione IPv4 di NETSEC-01) e includeva il consolidamento VPC (bucket di lungo periodo).
Riconciliato al tetto della baseline (**quick win −900/−1.300 $/mese**):

| Intervento | €/mese | Realizzabilità |
|---|---:|---|
| **RI/SP 1y** (rinnovo RI scadute 30/04) | 250-300 | subito, 0 rischio |
| **EC2 idle → 1 istanza** (1 su 2 unhealthy/account) | 300-500 | dev subito; prod dopo il fix scaling |
| **Auto-turnoff RDS dev** (tag già pronto a False) | 150-250 | subito (serve schedule riaccensione) |
| **Backup retention dev → 7gg** | 100-150 | subito (dev); prod per cliente |
| **AWS Config tuning dev** | 60-100 | subito (verificare Control Tower) |
| **Cleanup** (Secrets/CE-API/EBS orfani/log CloudFront/Lambda) | 60-90 | subito, basso rischio |
| **Rilascio EIP idle** (parte di IPv4) | ~28 | subito |
| **Subtotale quick win fleet** | **~950-1.420** | ≈ baseline −900/−1.300 ✓ |
| SFTP on-demand (solo account DataTransfer) | 110-223 | richiede mappare gli utenti SFTP |
| CociProd t4g.2xlarge right-size (solo Coci) | 90-200 | **prima** monitorare, poi decidere |

> **Non doppio-contare**: la riduzione IPv4 strutturale (4→2/account, €200-300) richiede le **subnet
> private** (NETSEC-01, effort settimane → non è quick win) e si **sovrappone** al consolidamento VPC
> (bucket lungo periodo, €700-1.200). Qui conto solo il **rilascio degli EIP idle** (~28 $), che è immediato.

E poi le quick win a **costo 0** che non risparmiano ma **chiudono i down e i buchi di sicurezza** —
il vero motivo per cui i clienti si lamentano. Queste valgono più dei soldi.

---

## A. Risparmio immediato (cost, 0 rischio)

**QW-A1 · Ricomprare RI/SP 1y** `[COST-RI-RENEW]` · €250-300/mese · ore · P1
Le RI no-upfront sono scadute il 30/04 → +480 $/mese on-demand non coperto. Comprare RI/SP 1y sul
baseline costante della flotta (db.t4g.micro/small/medium, t4g.small/medium). **Preferire Savings Plans**
(flessibili) alle RI rigide, e coprire solo il baseline che il consolidamento NON eliminerà.
⚠️ Coordinare con la decisione consolidamento (non riservare capacità destinata a sparire).

**QW-A2 · Attivare l'auto-turnoff RDS dev** `[COST-RDS-DEV-TURNOFF]` · €150-250/mese · ore · P3
Lo stack `lambda-rds-turnoff` è già deployato in ogni account con rule oraria ENABLED, ma le RDS sono
taggate `Auto-TurnOff=False`: gira a vuoto. Cambiare il tag a **True sulle sole RDS dev**. Risparmio
già costruito, basta il tag. ⚠️ Verificare che esista anche una rule di **riaccensione** mattutina; mai
toccare le prod.

**QW-A3 · Ridurre la retention backup RDS dev a 7gg** `[COST-RDS-BACKUP-RETENTION]` · €100-150/mese · giorni · P6
Il backup extra costa 229 $/mese (default ≥14gg ovunque, dev=prod al byte). 7gg nei dev; verificare l'RPO
contrattuale prima di toccare i prod.

**QW-A4 · Tuning AWS Config nei dev** `[COST-CONFIG-TUNING-DEV]` · €60-100/mese · giorni · P9
Config costa 161 $/mese (+50% per churn). Escludere i tipi ad alto churn nei dev / recorder daily.
Indagare SphProd (outlier 38 $). ⚠️ Mantenere Config completo sui prod per compliance/Control Tower.

**QW-A5 · Pacchetto pulizie** `[COST-CLEANUP-MISC]` (+ `MON-06`) · €60-90/mese · giorni · P4
(a) ridurre il polling Cost Explorer API (44 $/mese, 4.434 call/mese tutte dall'account Laif → cache);
(b) consolidare ~88 Secrets, spostare i non-rotati su SSM; (c) audit EBS/snapshot orfani (72 $/mese);
(d) lifecycle sui bucket log CloudFront e retention sui log Lambda (oggi infinita). ⚠️ Verificare i backup
prima di cancellare EBS.

## B. Affidabilità a costo 0 — il "fix Nivi" (chiude i down)

> Il caso Nivi prova che lo scale-up a mano (+26,6 $/mese) **non risolve**. Questi 4 interventi costano
> **0 $** e chiudono la classe di down "un task = un down". Tutti `library` → si propagano alla flotta.

**QW-B1 · Defangare l'health check container** `[SCALE-01]` · €0 · ore · P1
`curl / 5s/5s/2` hardcoded (`template_stack.py:499-506`) uccide l'unico task quando 1 vCPU satura.
→ interval 30s, retries 3-5, endpoint `/health` leggero non servito dal worker. **Esporre a config.**

**QW-B2 · 2+ worker applicativi** `[SCALE-02]` · €0 · ore · P1 · *(lato app)*
Avviare il backend con `--workers 2-4` per usare il 2° vCPU già pagato. È la coppia inseparabile di QW-B1.
⚠️ Più worker = più RAM: verificare su t4g.small (2 GB).

**QW-B3 · `desired_count=2`** `[SCALE-03]` · €0 (con QW-B4) · ore · P1
Due task → la morte di uno non azzera i target healthy. ⚠️ Oggi **bloccato** dall'hostPort 80 statico
(1 task/istanza): il vero 0 $ arriva con SCALE-04 (medio); altrimenti servono 2 istanze (+13 $/account,
comunque ≤ dell'upsize Nivi).

**QW-B4 · Circuit breaker + rollback automatico** `[SCALE-06]` · €0 · ore · P1
Un deploy con task che non diventano healthy viene fermato e rollato indietro invece di degradare il
servizio. Alzare anche `healthCheckGracePeriod` (oggi 0). Default ON.

> A questi si aggiungono i **4 alarm + canale di notifica** (sezione C/monitoring): senza, i down restano
> invisibili. QW-B + i 4 alarm = il pacchetto completo "caso Nivi non si ripete".

## C. Monitoring a (quasi) costo 0 — "lo sappiamo prima del cliente"

**QW-C1 · 4 alarm CloudWatch minimi** `[MON-01]` · €0 (primi 10 alarm gratis) · ore · P1
ELB 5xx, UnHealthyHostCount>0, RDS FreeableMemory bassa, RDS CPUCreditBalance. Sono esattamente i 4 che
avrebbero visto Nivi. Default ON con opt-out, instradati a QW-C2.

**QW-C2 · Canale SNS → Slack/email** `[MON-04]` · €~0 · giorni · P1
Trasforma "metrica oltre soglia" in "LAIF lo sa". Senza, gli alarm sono muti. ⚠️ Decidere topic per-account
vs hub centralizzato (meglio, ma cross-account).

**QW-C3 · Container Insights ON** `[MON-02]` · spesa lieve · ore · P2
Metriche CPU/memoria/task per-service (oggi disabled): durante un down si vede la saturazione del singolo task.

**QW-C4 · Osservabilità RDS** `[MON-03]` · PI gratis + spesa lieve · ore · P2
Performance Insights (free 7gg) + Enhanced Monitoring + log Postgres export. Oggi tutti off: niente diagnosi
slow-query/memoria reale durante un down.

> Monitoring non è una leva di risparmio (CloudWatch è 1,2% della bolletta): qui si **spende un po' di più**.
> Le quick win C rientrano nel budget +50/+150 $/mese previsto in baseline §5.

## D. Sicurezza a costo 0 (library → tutta la flotta)

**QW-D1 · Abilitare il WAF** `[NETSEC-04]` · ~5-6 $/account · ore · P1
Il WebACL **esiste già** in laif-cdk (rate limit + 5 managed rule) ma è deployato **0/24**. Associarlo a
CloudFront + WAF logging. ⚠️ Partire in COUNT poi BLOCK; efficace solo con QW-D pieno (vedi NETSEC-02/03).

**QW-D2 · SG hardening** `[NETSEC-05]` · €0 · giorni · P1
Chiudere SSH al mondo su EFS (`efs.py:61-65`), bloccare `expose_ssh/add_ingress_rule("ANY")`, eliminare gli
utenti EC2 con **password=username** (`constants.py`). ⚠️ Sostituire SSH con SSM Session Manager per non
perdere accesso operativo.

**QW-D3 · VPC Flow Logs** `[NETSEC-07]` · spesa lieve · ore · P3
Oggi i flow log esistono solo sulla VPC Control Tower inutilizzata. Servono per indagare i down e il debug
dopo il passaggio a subnet private. ⚠️ Filtro REJECT / retention breve per contenere i costi.

## E. Igiene / processo a basso sforzo

**QW-E1 · Pinnare laif-cdk** `[TOOL-05]` · €0 · ore · P1
0/24 repo pinnano (3 URL di cui 1 **rotto** su benozzi): ogni `pip install` prende l'HEAD → infra di tutti
può cambiare al deploy successivo. Pinnare a tag (v1.40 esiste) e uniformare l'URL. Anche nel cookiecutter.

**QW-E2 · SQS con DLQ + visibility sano** `[TASK-04]` · €0 · ore · P2
Riscrivere `SimpleQueue`: DLQ obbligatoria, visibility derivato dal consumer (oggi 12h hardcoded), alarm
sull'età messaggi. Mattone async del futuro modulo jobs.

**QW-E3 · Eliminare laif-deployer** `[TOOL-01]` · €0 · giorni · P2
Toolchain via `uv` (locale) + runner GH pinnati (CI): spariscono emulazione amd64 sui Mac ARM, i 4 mount, il
balletto dentro/fuori container, la catena di rilascio a 3 repo. ⚠️ In coppia con la convergenza CLI (TOOL-02).

**QW-E4 · Tag immagine immutabili** `[SCALE-08]` · €0 · giorni · P3
Sostituire `:latest` con git SHA/build id → deploy riproducibili, mitiga il config drift repo↔prod (Nivi).

---

## Ordine consigliato (fai questi per primi — tutti P1)

1. **QW-A1** RI/SP (€250-300 subito, 0 rischio) — il singolo intervento di risparmio più grande.
2. **QW-C1 + QW-C2** 4 alarm + SNS → smetti di scoprire i down dai clienti (vale più dei soldi).
3. **QW-B1+B2+B3+B4** fix Nivi a costo 0 → chiudi la classe di down.
4. **QW-D1+D2** WAF (già pronto) + chiudere SSH al mondo / password=username → buchi di sicurezza gravi.
5. **QW-E1** pinnare laif-cdk → ferma il rischio "infra cambia da sola".
6. **QW-A2** auto-turnoff RDS dev (€150-250, basta un tag).

Poi le quick win di costo a giorni (A3/A4/A5, EC2-idle sui dev) e le igieniche (E2/E3/E4).

## Dipendenze e trappole (da non sbagliare la sequenza)
- **EC2 idle** (€300-500): sui **dev** subito; sui **prod** solo dopo il fix scaling (SCALE-04), o si resta
  single-instance senza margine.
- **IPv4 strutturale** (4→2): richiede subnet private (NETSEC-01, settimane) → **non** è quick win; qui solo
  il rilascio EIP idle.
- **CociProd right-size**: prima il monitoring (QW-C), poi decidere con dati; altrimenti RI dedicata (0 rischio).
- **WAF** dà falsa sicurezza se il bucket FE resta pubblico (NETSEC-02) e l'ALB è bypassabile (NETSEC-03):
  pianificare il trittico insieme anche se NETSEC-02/03 sono "small/medium".
