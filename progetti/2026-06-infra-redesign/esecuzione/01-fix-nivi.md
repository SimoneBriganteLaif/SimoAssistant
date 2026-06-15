# Esecuzione 01 — Fix resilienza Nivi (test su Nivi soltanto)

> Prima quick win eseguita. Obiettivo: chiudere la classe di down del caso Nivi (analisi/08) su **nivi-prod
> soltanto**, a **costo 0**, per validare prima del rollout di flotta. Stato: **modifiche pronte su branch,
> NON deployate.** Data: 2026-06-11.

## Causa-radice confermata (in locale)
`credit-assistant/backend/run.py:80-87`: il numero di worker è `WEB_CONCURRENCY` ma il default è
**hardcoded a 1** (l'auto-detect dei core è commentato). Il backend gira con **1 solo worker** → satura 1
dei 2 vCPU del t4g.medium → l'health check `curl /` (endpoint `@app.get("/")`, leggero ma servito
dall'unico worker occupato) va in timeout e ECS uccide il task. `/health/*` richiede auth+DB → non adatto
come health check; si resta su `/`.

## Cosa è stato cambiato (2 branch, commit locali, NO push, NO deploy)

### laif-cdk — branch `fix/backend-resilience` (worktree `~/LAIF/repo/laif-cdk-resilience`, off `master`)
Commit `44199be`. Aggiunge parametri **retrocompatibili** (default = comportamento attuale → nessun altro
cliente cambia):
- `template_stack.py`: `backend_health_check_interval_seconds` / `_retries` / `_timeout_seconds` /
  `_start_period_seconds` (usati al posto dei valori hardcoded 5/2/5/60); `backend_circuit_breaker`,
  `backend_health_check_grace_period_seconds`, `backend_desired_count` (default None→1).
- `ecs.py` (`add_application_load_balanced_service`): nuovi `circuit_breaker` + `health_check_grace_period_seconds`,
  inoltrati a `add_service` → `_create_ec2_service` → `ecs.Ec2Service` (oggi i `**ec2ServiceProps` venivano scartati).

### nivi-infra — branch `fix/backend-resilience`
Commit `089ec3f`. `prod.yaml` (sotto `default_stack`) + `app.py`:
- `web_concurrency: 2` → `container_environments={"WEB_CONCURRENCY":"2"}` (merge con le env infra, non le sovrascrive). **Il fix più importante.**
- health check container: `interval 30s`, `retries 5`, `timeout 5s`, `grace 120s` (era 5s/2/5).
- `backend_circuit_breaker: true`.
- ALB health check: `interval 30s`, `timeout 10s` (parametri già esistenti).
- `desired_count` resta **1** (scelta conservativa per il primo test).

## Come testare e deployare (lo fa Simone)
Il branch laif-cdk non è pushato: per il test si installa dal worktree locale.
```bash
aws sso login --profile nivi-prod
cd ~/LAIF/repo/nivi-infra
git checkout fix/backend-resilience
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt                      # laif-cdk da master
pip install -e ~/LAIF/repo/laif-cdk-resilience       # override con il branch del fix
cdk diff   --profile nivi-prod -c env=prod prod-nivi-stack   # ← RIVEDERE: atteso solo task def (health check, env WEB_CONCURRENCY) + service (circuit breaker, grace)
cdk deploy --profile nivi-prod -c env=prod prod-nivi-stack
```
Atteso nel diff: modifica della **TaskDefinition** (HealthCheck interval/retries/timeout, env `WEB_CONCURRENCY=2`)
+ **Service** (deploymentCircuitBreaker rollback, healthCheckGracePeriod) + **TargetGroup** ALB (interval/timeout).
NESSUNA modifica a VPC/RDS/ALB/bucket. Se il diff mostra altro, fermarsi.

## Come verificare che funzioni
- `aws ecs describe-services --cluster prod-nivi-credit-be-cluster --services prod-nivi-credit-be-service --profile nivi-prod` → eventi: **niente più** "replaced 1 tasks due to an unhealthy status".
- Task def nuova: health check `interval=30`, `retries=5`; env `WEB_CONCURRENCY=2` presente.
- Log del container all'avvio: "🚀 Starting FastAPI server with 2 workers...".
- Sotto traffico/picco: il target resta healthy (prima moriva). Osservare 1-2 giorni.

## Rollback
`git checkout master` in nivi-infra + `cdk deploy` con laif-cdk master (o `pip uninstall` del branch e reinstall requirements) → torna allo stato precedente. Le risorse stateful (RDS) non sono toccate.

## Note / decisioni aperte
- **WEB_CONCURRENCY via infra** (container_environments) vs via env-config dell'app: scelto infra-side per
  toccare solo Nivi senza deploy dell'app. In alternativa si setta in `credit-assistant/backend/envs`.
- **dev.yaml**: il fix è su `prod.yaml` (lì avvengono i down). Si può rispecchiare su `dev.yaml` se si vuole testare prima in dev.
- **Push/merge**: per il rollout di flotta, mergiare PRIMA `laif-cdk fix/backend-resilience` → master (è
  retrocompatibile), POI nivi-infra. Finché laif-cdk non è in master, NON mergiare nivi-infra in master
  (passerebbe kwargs inesistenti).
- **2 workers e RAM**: 2 worker su t4g.medium (4 GB) stanno larghi (~1.1 GB stimati). OK.

## Prossime quick win laif-cdk (stesso pattern, dopo la validazione Nivi)
WAF enable (`waf_stack.disabled: false`), pin laif-cdk a tag (TOOL-05), SG hardening (NETSEC-05),
log retention, alarm→ (serve l'endpoint Wolico). Vedi `interventi/quick-wins.md`.
