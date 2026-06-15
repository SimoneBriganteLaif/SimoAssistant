# 07 — Inventario live AWS: casartelli-dev / casartelli-prod (deployment "tipo")

**Data ispezione**: 2026-06-10, sera (read-only, CLI). Regioni: eu-west-1 + us-east-1.
**Account**: dev = `492154492664` (profilo `casartelli-dev`), prod = `078001351962` (profilo `casartelli-prod`) — verificati con `aws sts get-caller-identity`.

> **Nota di contesto importante**: entrambi gli account sono stati **creati oggi** (Control Tower account factory ore 12:18 UTC, primo deploy CDK ore 18:20 dev / 18:40 prod — `aws cloudformation describe-stacks`). È il kick-off Casartelli: questo è quindi lo **stato "day zero" che laif-cdk produce oggi per ogni nuovo cliente**, fotografato prima di qualsiasi deriva manuale. Perfetto come "deployment tipo". Durante l'ispezione `prod-casartelli-stack` era in `UPDATE_IN_PROGRESS` (completato `UPDATE_COMPLETE` entro fine ispezione). Cost Explorer non significativo (account a 0 giorni di vita): i costi sotto sono **stime da listino eu-west-1**.

---

## 1. Executive summary

Il deployment tipo è: **CloudFront → (S3 website pubblico per il FE, ALB internet-facing per il BE) → ECS su EC2 (capacity provider/ASG, 1 task) → RDS Postgres pubblico**. Tutto in una VPC con **sole subnet pubbliche**. Dev e prod sono **identici al byte** (stesse taglie, stessi count). Trovati:

- **RDS `PubliclyAccessible=true` con EIP pubblico** in entrambi gli ambienti (mitigato dal SG: 5432 solo da VPN LAIF e dal SG ECS) — conferma live del problema #6 del brief, presente anche su un deploy nuovo di zecca.
- **Zero autoscaling applicativo** (`application-autoscaling describe-scalable-targets` → `[]` su entrambi), **zero alarm utili** (solo i 2 alarm auto-creati dal managed scaling ECS), **zero WAF**, **zero HTTPS sull'ALB** (CloudFront→ALB in HTTP chiaro, senza header segreto).
- **1 istanza EC2 su 2 idle/unhealthy per account** al momento dell'ispezione (1 task ECS, 2 istanze t4g.small).
- Costo a riposo stimato **~$83/mese (dev) + ~$87/mese (prod) ≈ $170/mese/cliente**, di cui ~25-30% evitabile subito (istanza idle, RDS dev h24, IPv4 pubblici).

---

## 2. CloudFormation

`aws cloudformation describe-stacks` — per ciascun account (identici):

| Stack | Stato | Note |
|---|---|---|
| `dev-casartelli-stack` / `prod-casartelli-stack` | UPDATE_COMPLETE | lo stack applicativo monolitico (49 risorse, v. sotto) |
| `lambda-rds-turnoff` | CREATE_COMPLETE | Lambda di spegnimento RDS schedulata (v. §10) |
| `CDKToolkit` | CREATE_COMPLETE | bootstrap CDK |
| 6× `StackSet-AWSControlTowerBP-*` | CREATE_COMPLETE | baseline Control Tower (config, roles, VPC factory) |

Esiste anche uno stack edge separato in us-east-1 (la Lambda@Edge `*-casartelli-be-edge-lambda` ha role `edge-lambda-stack-c8fd9bc-...`).

**Composizione di `dev-casartelli-stack`** (`aws cloudformation list-stack-resources`, count per tipo): 4 IAM::Role, 3 S3::Bucket, 3 Subnet + 3 RouteTable + 3 Route + 3 SecurityGroup (+3 ingress), 2 VPCEndpoint, 1 ciascuno di: VPC, IGW, LaunchTemplate, AutoScalingGroup, ECS::Cluster, ECS::CapacityProvider, ECS::Service, ECS::TaskDefinition, ECR::Repository, RDS::DBInstance, RDS::DBSubnetGroup, ELBv2 LoadBalancer/Listener/TargetGroup, CloudFront::Distribution, CloudFront::CachePolicy, SecretsManager::Secret(+attachment), Logs::LogGroup, Lambda::Function (custom resource cross-region). **Un solo stack monolitico**: rete, dati, compute e CDN vivono nella stessa unit di deploy.

## 3. Rete (VPC)

`aws ec2 describe-vpcs / describe-subnets / describe-route-tables / describe-nat-gateways / describe-internet-gateways / describe-vpc-endpoints`:

- VPC applicativa `10.0.0.0/16` (dev `vpc-05158f7db45c6dfb4`, prod `vpc-06a4dba75a82b5968`) con **3 subnet, tutte PUBBLICHE** (`/18` per AZ a/b/c, `MapPublicIpOnLaunch=True`, route `0.0.0.0/0 → igw`). **Non esiste alcuna subnet privata applicativa.**
- **0 NAT Gateway** in entrambi gli account (describe-nat-gateways vuoto): l'egress delle istanze passa dall'IGW con IP pubblico per-istanza. Risparmio (~$37/mese/NAT) ottenuto però al prezzo di mettere tutto in subnet pubblica.
- VPC endpoint **gateway** (gratuiti): S3 ×2 (uno per VPC) + DynamoDB ×1. Nessun endpoint interface.
- Seconda VPC `172.31.0.0/16` `aws-controltower-VPC` con 3 subnet **private** completamente **inutilizzata** (zero ENI applicative) — rumore della account factory; ironicamente le uniche subnet private dell'account sono quelle che non usa nessuno.

## 4. ECS

`aws ecs list-clusters / describe-services / describe-task-definition / describe-capacity-providers` + `aws autoscaling describe-auto-scaling-groups`:

- 1 cluster per account: `dev-casartelli-be-cluster` / `prod-casartelli-be-cluster`; 1 servizio: `*-casartelli-be-service`.
- **Launch type: EC2 via capacity provider** (`casartelli-{env}-be-cp`, type `EC2_AUTOSCALING`, managedScaling ENABLED target 100%, managed termination protection + draining ENABLED). **Non Fargate.**
- Servizio: `desiredCount=1`, `runningCount=1`, minHealthy 50% / max 200%, **circuit breaker disabilitato**, e — dettaglio strutturale — **`loadBalancers: []`**: il servizio ECS **non è agganciato all'ALB**. Il target group è di tipo `instance` ed è agganciato all'**ASG** (`TargetGroupARNs` su `casartelli-{env}-be-asg`), che registra le EC2 intere.
- Task definition `*-casartelli-be-task:1`: network mode **bridge**, container `backend` da ECR `{env}/casartelli/backend:latest`, **memoryReservation 1024 MB** (niente limiti cpu/mem hard, `Cpu: 0`), port mapping **8000 → host 80 fisso**. Conseguenza: **massimo 1 task per istanza** (porta host statica) → lo scale-out dei task richiede sempre nuove EC2; impossibile impacchettare.
- Config DB passata via env `DB_SECRET_ARN` (l'app legge il secret a runtime; nessun `secrets:` ECS).
- ASG: `Min=0, Max=2, Desired=2`, launch template `casartelli-{env}-be-lt`, **2× t4g.small** per account, `HealthCheckType=EC2` (non ELB → un'istanza col container rotto non viene mai sostituita dall'ASG).
- **Autoscaling applicativo: assente** — `aws application-autoscaling describe-scalable-targets --service-namespace ecs` → `{"ScalableTargets": []}` su entrambi. Il "max 2" dell'ASG serve solo al churn dei deploy, non a scalare sul carico.

**Stato live (ore ~20 UTC)**: cluster con 2 container instance registrate, **1 solo task running** → 1 istanza per account è **vuota** e risulta **unhealthy** nel target group (`aws elbv2 describe-target-health`: dev `i-0cfb99d845e0f5a17` unhealthy `Target.FailedHealthChecks`, prod `i-003122e1121b97dd8` idem). Con host port fisso + min instances di fatto 2, ogni account paga **una t4g.small a vuoto** (~$13.4/mese) salvo che il managed scaling la riassorba a 1 col tempo.

## 5. RDS

`aws rds describe-db-instances` — **identico dev/prod**:

| Proprietà | Valore (dev e prod) |
|---|---|
| Istanza | `dev-casartelli-db` / `prod-casartelli-db` |
| Classe / Engine | **db.t4g.micro**, PostgreSQL **17.10** |
| Storage | 20 GB gp3, autoscaling fino a 100 GB |
| **PubliclyAccessible** | **true** (endpoint con EIP pubblico: dev 52.214.174.98, prod 52.30.124.93, `ServiceManaged: rds` in `describe-addresses`) |
| MultiAZ | **false (anche in prod)** |
| Backup | retention 14 giorni; Encrypted=true; DeletionProtection=true; Performance Insights=true |
| Subnet group | le 3 subnet **pubbliche** della VPC applicativa |

Security group DB (`sg-007b7179b11f64b21` dev / `sg-0d109aa726c57de4a` prod): ingress 5432 **solo** da `54.246.152.243/32` (verificato: è `laif-vpn-elastic-ip-1` nell'account laif-vpn — `aws ec2 describe-addresses --profile laif-vpn`) e dal SG del cluster ECS. Quindi il rischio non è "DB aperto al mondo", ma **endpoint risolvibile pubblicamente con IP pubblico dedicato**: superficie d'attacco inutile (exposure a 0-day del listener Postgres, enumerazione, dipendenza da un singolo SG come unica barriera) + **$3.65/mese di IPv4** per DB. Conferma del problema #6 del brief sul deployment più recente in assoluto.

## 6. ALB

`aws elbv2 describe-load-balancers / describe-listeners / describe-target-groups / describe-target-health`:

- 1 ALB per account: `{env}-casartelli-be-alb`, **internet-facing**, 3 AZ.
- **Un solo listener: HTTP :80** (nessun listener 443; nessun cert ACM in eu-west-1 — `acm list-certificates` vuoto). Il TLS termina su CloudFront; la tratta **CloudFront→ALB viaggia in HTTP chiaro su internet** (origin `http-only`, v. §7).
- SG ALB: ingress 80 **solo dalla managed prefix list CloudFront** `pl-4fa04526` ("Open traffic from Cloudfront from specific Region"). Bene, ma **senza custom header segreto sull'origin** (CloudFront `CustomHeaders.Quantity: 0`) chiunque può creare una *propria* distribuzione CloudFront puntata a `{env}-casartelli-be-alb-*.elb.amazonaws.com` e bypassare dominio e (futuro) WAF: la prefix list non distingue *quale* distribuzione.
- Target group `{env}-casartelli-be-targets`: target type **instance**, porta 80, health check `GET /` su traffic-port. Stato: **1 healthy + 1 unhealthy** in entrambi gli account (l'istanza senza task, §4).
- L'ALB di fatto bilancia **1 solo target sano**: è il caso da brief "load balancer pagato (~$20+/mese) e non sfruttato" — qui serve solo come reverse proxy fisso per CloudFront.

## 7. CloudFront, Lambda@Edge, ACM, DNS

`aws cloudfront list-distributions / get-distribution-config`, `aws lambda list-functions --region us-east-1`:

- 1 distribuzione per account: dev `E1DWQGMHP0J2VP` → alias `casartelli-dev.app.laifgroup.com`; prod `EU5DEVFUTBG3T` → alias `casartelli.app.laifgroup.com`. PriceClass_100, cert ACM us-east-1 wildcard `*.app.laifgroup.com` (ISSUED, uno per account).
- 2 origin: (1) **S3 website endpoint** `{env}-casartelli-fe-build.s3-website-eu-west-1...` (default behavior, FE statico), (2) ALB (behavior `/api/*`). Entrambi gli origin **`http-only`**, **0 custom header**.
- Behavior `/api/*` con **Lambda@Edge `{env}-casartelli-be-edge-lambda`** (us-east-1, nodejs22.x, 128 MB, handler `url_changer.handler`) su `origin-request` — riscrittura path. Una Lambda@Edge per fare strip del prefisso, dove un semplice listener rule / path rewrite sarebbe gratuito.
- **WebACLId: ""** → **nessun WAF** (confermato anche da `wafv2 list-web-acls --scope CLOUDFRONT` vuoto in us-east-1), nonostante l'env del task contenga `CDK_INFRA__WAF_ENABLED` (feature esistente in laif-cdk ma spenta).

## 8. S3

`aws s3api list-buckets / get-public-access-block / get-bucket-policy-status` — 5 bucket per account:

| Bucket | Note |
|---|---|
| `{env}-casartelli-fe-build` | FE statico. **Website hosting, bucket PUBBLICO** (`PolicyStatus.IsPublic: true`, public access block tutto `false`). Pattern legacy: con OAC/OAI il bucket sarebbe privato; oggi chiunque può leggere il FE bypassando CloudFront. |
| `{env}-casartelli-data-bucket` | dati applicativi, public access block tutto `true` (ok) |
| `{env}-casartelli-stack-casartellicloudfront...` | log/ausiliario CloudFront |
| `cdk-hnb659fds-assets-<acct>-eu-west-1` e `-us-east-1` | bootstrap CDK (2 region per via dell'edge stack) |

## 9. Lambda (eu-west-1)

`aws lambda list-functions`: 3 funzioni per account — (1) custom resource CDK `CustomCrossRegionStringParameter*` (lettura parametri cross-region per il cert us-east-1), (2) `aws-controltower-NotificationForwarder` (baseline), (3) **`lambda-rds-turnoff-AutoRDSTurnoff*`** (v. §10). Nessuna Lambda applicativa: gli "ETL/task" del brief qui non esistono ancora.

## 10. lambda-rds-turnoff: meccanismo presente ma spento

- Stack dedicato in **entrambi** gli account (anche prod). EventBridge rule `Lambda_auto_turnoff_RDS-casartelli`, **`cron(45 * ? * * *)` = ogni ora al minuto 45**, ENABLED.
- La Lambda (python3.12, env `KEY=Auto-TurnOff, VALUE=True`, IAM `rds:Stop/StartDBInstance/Cluster` su `*` — template via `cloudformation get-template`) spegne le istanze RDS **taggate `Auto-TurnOff=True`**.
- **Entrambe le RDS sono taggate `Auto-TurnOff=False`** (`aws rds list-tags-for-resource`): il meccanismo gira a vuoto ogni ora su entrambi gli account. In prod giusto che sia spento (ma allora lo stack è inutile lì); in **dev è un risparmio già costruito e non attivato** (~50-65% del costo istanza RDS dev se spenta fuori orario: ~$7-8/mese... moltiplicato per ~30 clienti).

## 11. Monitoring e logging

- **CloudWatch alarms** (`describe-alarms`): **2 per account**, entrambi `TargetTracking-casartelli-{env}-be-asg-AlarmHigh/Low` su `CapacityProviderReservation` — creati automaticamente dal managed scaling ECS. **Zero alarm su**: CPU/memoria ECS o EC2, RDS (CPUUtilization, FreeStorageSpace, DatabaseConnections), ALB (5xx, TargetResponseTime, **UnHealthyHostCount** — che in questo momento scatterebbe!), CloudFront. Nessun SNS/notifica. Conferma piena del problema #1 del brief: **il TG ha un target unhealthy ADESSO e nessuno lo saprebbe**.
- **Log groups** (`logs describe-log-groups`): task log `{env}-casartelli-be-task-log-group` retention **14 giorni** (ok); i log group delle Lambda (rds-turnoff, custom resource, edge replica) **senza retention = never expire** (costo trascurabile ma pattern sporco); VPC flow logs **solo** sulla VPC Control Tower inutilizzata (90 gg) — **la VPC applicativa non ha flow logs**.

## 12. Secrets Manager, ECR, servizi assenti

- Secrets: 1 per account, `{env}-casartelli-db-sysuser-secrets` (credenziali master RDS), **rotation disabilitata**. ~$0.40/mese.
- ECR: `{env}/casartelli/backend` (scanOnPush **true**) + repo bootstrap CDK (scanOnPush false). Deploy con tag **`:latest`** (task def punta a `backend:latest`: i rollback ECS non sono deterministici).
- **Assenti del tutto** (liste vuote): ElastiCache, SQS, NAT, WAF, ACM regionale, EBS orfani non rilevati, nessuna risorsa applicativa in us-east-1 oltre a edge lambda + bootstrap.

## 13. EIP / IPv4 pubblici

`aws ec2 describe-addresses` + IP istanze: tutti gli IPv4 pubblici ora costano $0.005/h = **$3.65/mese ciascuno**.

| Account | EIP service-managed | IP pubblici EC2 | Totale IPv4 | Costo/mese |
|---|---|---|---|---|
| dev | 3 (2 ALB + 1 **RDS**) | 2 | 5 | ~$18.25 |
| prod | 4 (3 ALB + 1 **RDS**) | 2 | 6 | ~$21.90 |

L'IP pubblico dell'RDS e i 2 IP pubblici delle EC2 (5 su 11) esistono **solo** perché non ci sono subnet private: ~$15/mese/cliente di IPv4 evitabili con rete privata + 1 NAT condiviso (o endpoint).

## 14. Dev vs Prod

**Identici in tutto**: stessa VPC topology, 2× t4g.small, db.t4g.micro 20 GB, 1 task da 1 GB, ALB, CloudFront, stessi SG, stessi alarm (nessuno), stesso lambda-rds-turnoff. Uniche differenze: nomi/alias DNS (`casartelli-dev.app.laifgroup.com` vs `casartelli.app.laifgroup.com`) e l'ALB dev con 2 EIP vs 3 in prod (transitorio). Implicazioni:

- **Prod non ha nulla in più di dev**: no MultiAZ, no più repliche, no WAF, no alarm → nessuna resilienza aggiuntiva dove servirebbe.
- **Dev non ha nulla in meno di prod**: gira h24 con 2 istanze + ALB + RDS sempre accesi → nessun risparmio dove si potrebbe.
- La "configurabilità per ambiente" auspicata dal brief (feature on/off) oggi non esiste: un solo profilo, clonato.

## 15. Criticità riassunte (per il ridisegno)

**Esposizione pubblica**
1. RDS pubblico con EIP (entrambi gli ambienti) — §5. Mitigato da SG, ma da spostare in subnet private.
2. EC2 con IP pubblici in subnet pubbliche — §3/§13.
3. ALB raggiungibile da qualsiasi distribuzione CloudFront (no custom header segreto), tratta CloudFront→ALB in HTTP chiaro — §6/§7.
4. Bucket FE website **pubblico** invece di OAC — §8.
5. Nessun WAF, da nessuna parte — §7.

**Idle / sprechi**
6. 1 EC2 t4g.small su 2 idle e unhealthy per account (~$13.4/mese/account) — §4.
7. RDS dev h24 con meccanismo di auto-spegnimento già deployato ma `Auto-TurnOff=False` (~$7-8/mese) — §10.
8. ~$15/mese/cliente di IPv4 pubblici strutturalmente evitabili — §13.
9. ALB (~$20/mese) che bilancia 1 target: costo fisso da rivedere a livello di pattern (es. ALB condiviso, o CloudFront→Fargate dietro… nel ridisegno) — §6.
10. Lambda@Edge per un path rewrite; VPC Control Tower inutilizzata; stack rds-turnoff in prod che gira a vuoto ogni ora.

**Monitoring / scaling**
11. Zero alarm utili, zero notifiche; un target è unhealthy in questo preciso momento e non lo segnala nulla — §11.
12. Zero autoscaling applicativo; host port fisso 80 in bridge mode = max 1 task/istanza, scale-out solo aggiungendo EC2 — §4.
13. ASG health check `EC2` (non `ELB`): istanze con app morta non vengono sostituite; ECS service non collegato all'ALB (TG type instance via ASG) → deploy non coordinati col drain a livello task; `minimumHealthyPercent=50` con desired=1 ⇒ possibile downtime a ogni deploy; immagini `:latest` ⇒ rollback non deterministici — §4/§12.

## 16. Stima costi mensili a riposo (listino eu-west-1, on-demand)

| Voce | dev | prod |
|---|---|---|
| 2× EC2 t4g.small ($0.0184/h) | $26.86 | $26.86 |
| ALB ($0.0267/h + LCU minime) | ~$21 | ~$21 |
| RDS db.t4g.micro ($0.018/h) + 20 GB gp3 | ~$15.7 | ~$15.7 |
| IPv4 pubblici ($3.65 cad.) | ~$18.3 | ~$21.9 |
| CloudFront/S3/Lambda/Secrets/log (basso traffico) | ~$1-3 | ~$1-3 |
| **Totale** | **~$83** | **~$87** |

≈ **$170/mese/cliente prima di una sola richiesta utente**. Componenti aggredibili senza ridisegno: istanza idle ($27/cliente se il pattern 2-istanze persiste), RDS dev notturno ($8), IPv4 ($15-30 col ridisegno rete) → **~$35-50/mese/cliente (~20-30%)**. Su ~30 clienti con questo pattern: ordine di **$1.000-1.500/mese** di quick win, oltre al valore (non monetario) di alarm e autoscaling oggi assenti.

---
*Comandi usati (tutti read-only): `sts get-caller-identity`, `cloudformation describe-stacks|list-stack-resources|get-template`, `ec2 describe-vpcs|subnets|route-tables|nat-gateways|internet-gateways|vpc-endpoints|security-groups|instances|addresses`, `ecs list-clusters|list-services|describe-services|describe-task-definition|describe-capacity-providers|describe-clusters`, `autoscaling describe-auto-scaling-groups`, `application-autoscaling describe-scalable-targets`, `rds describe-db-instances|list-tags-for-resource`, `elbv2 describe-load-balancers|listeners|target-groups|target-health`, `cloudfront list-distributions|get-distribution-config`, `s3api list-buckets|get-public-access-block|get-bucket-policy-status`, `lambda list-functions|get-function|get-function-configuration`, `elasticache describe-cache-clusters`, `sqs list-queues`, `wafv2 list-web-acls`, `acm list-certificates`, `cloudwatch describe-alarms`, `logs describe-log-groups`, `secretsmanager list-secrets`, `ecr describe-repositories`, `events list-rules`.*
