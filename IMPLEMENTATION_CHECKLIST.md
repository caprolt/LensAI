### LensAI — Implementation Checklist

Use this as the single source of truth to drive execution. Each item is written to be small, testable, and verifiable locally.

---

### Pre-flight setup
- [x] **Install tooling**: `pnpm`, Python 3.11+, `uv` or `poetry`, Docker Desktop, `wrangler` (Cloudflare), `stripe` CLI (optional for webhooks)
- [x] **Decide Python manager**: `uv` or `poetry` (update `README.md` accordingly) - Using `uv` but fallback to `pip` for now
- [x] **Create `.env.example`** files per app with variables from plan
- [x] **Makefile** scaffolding added and runnable
- [x] **Pre-commit** hooks set up (lint/format)
- [x] **Run sanity**: `pnpm -v`, `python -V`, `docker -v`, `wrangler -v`

---

### Phase 0 — Workspace Bootstrap

- [x] **P0.1 Monorepo bootstrap**
  - [x] Repo skeleton: `apps/`, `packages/`, `jobs/`, `infra/`, `docs/`, `scripts/`
  - [x] `package.json` with pnpm workspaces; JS/TS configs
  - [x] Python env: `pyproject.toml` and lockfile (`uv.lock` or `poetry.lock`)
  - [x] `.pre-commit-config.yaml` with lint/format
  - [x] `Makefile` with `dev`, `api`, `dashboard`, `worker`, `test`, `infra.up`, `infra.down`, `seed`
  - [x] Verify: `pnpm i && make dev` runs API:8000, Dashboard:3000, Worker (dev) - API ✅, Dashboard ✅, Worker needs Docker

- [x] **P0.2 Infra stubs & env**
  - [x] `docker-compose.yaml` for Postgres, MinIO (S3-compatible), (optional) ClickHouse
  - [x] Healthchecks for containers
  - [x] `.env.example` for `dashboard`, `api`, `worker`, `jobs`
  - [ ] Verify: `make infra.up` and `make infra.down` succeed - Need Docker Desktop running

---

### Phase 1 — MVP Core

- [ ] **1.1 Python SDK (sync+async)**
  - [ ] `packages/sdk-python/lensai/` with `configure`, `trace_llm`, cost helpers, HMAC signing, background sender
  - [ ] Unit tests for payload structure, cost calc, HMAC header
  - [ ] Example in README works
  - [ ] Env: `HMAC_INGEST_SECRET`

- [ ] **1.2 Cloudflare Worker — ingest**
  - [ ] `infra/worker/src/index.ts` with HMAC verification, zod validation
  - [ ] Writes NDJSON to R2/MinIO: `dt=YYYY-MM-DD/project_id=...`
  - [ ] `wrangler.toml` configured; local dev writes to MinIO
  - [ ] Verify: invalid signature → 401; valid request creates NDJSON object

- [ ] **1.3 Nightly batch — compaction & rollups**
  - [ ] `jobs/batch/rollups.py` converts NDJSON → Parquet
  - [ ] Writes `daily_costs.parquet`, `daily_latency.parquet` (partitioned)
  - [ ] Idempotent reruns; sample data included
  - [ ] Verify: outputs expected partition schema

- [ ] **1.4 Query layer — DuckDB**
  - [ ] SQL helpers in `packages/shared/sql/` and DuckDB open-on-S3 helper in API
  - [ ] Optional ClickHouse DDL (single-node) prepared
  - [ ] Verify: queries for cost by model/user; p50/p95 latency under target on seed

- [ ] **1.5 API (FastAPI) — budgets, metrics**
  - [ ] `apps/api/main.py` and routers for budgets/metrics
  - [ ] Models, validation, simple API-key auth; OpenAPI generates
  - [ ] Endpoints: budgets CRUD, overrides; metrics summary, cost-by-model, latency-pctl
  - [ ] Tests for error handling (problem+json)

- [ ] **1.6 Slack alerts + kill-switch**
  - [ ] `apps/api/services/slack.py` and background evaluator for budget thresholds (90%/100%)
  - [ ] Slack config; default channel via env; message formatting
  - [ ] `POST /v1/kill-switch/trigger`; state persisted and enforced
  - [ ] Verify with seeded data → Slack posts and switch enforcement

- [ ] **1.7 Auth (magic link) + projects & API keys**
  - [ ] Postgres models: `users, projects, api_keys, budgets, alerts, audit_logs, kill_switch, billing_*`
  - [ ] Email sender stub (console in dev)
  - [ ] CRUD for projects and API keys; audit logs on actions
  - [ ] Verify: sign-up → email link → session cookie; key ties to HMAC signing

- [ ] **1.8 Billing (Stripe) — baseline**
  - [ ] Products/prices script; `POST /billing/create-checkout-session`
  - [ ] Webhooks: `checkout.session.completed`, `customer.subscription.updated`
  - [ ] Dashboard shows subscription state
  - [ ] Verify with Stripe test flows

- [ ] **1.9 Dashboard (Next.js)**
  - [ ] Pages: `/onboarding`, `/projects/:id`, `/budgets`, `/settings`
  - [ ] Charts: cost by model/user, P50/P95 latency
  - [ ] Copy-paste SDK instructions
  - [ ] Verify: Playwright basic e2e; Lighthouse ≥ 85

- [ ] **1.10 Security — PII redaction & HMAC**
  - [ ] Redaction rules in SDK and Worker (configurable fields)
  - [ ] HMAC middleware both ends; secrets rotation script
  - [ ] Tests for redaction and signature failure

---

### Phase 2 — Beta Hardening

- [ ] **2.1 Node SDK parity**
  - [ ] `packages/sdk-node` with TS API mirroring Python; tests and examples
  - [ ] Emits identical schema and matching HMAC signatures

- [ ] **2.2 Onboarding polish + API keys UI**
  - [ ] Wizard, copy buttons for env vars, key creation/rotation
  - [ ] Docs snippets for Express/FastAPI/Vercel Edge
  - [ ] Verify: Signup → First event median < 20 min in script

- [ ] **2.3 Rate limiting & quotas**
  - [ ] Per-project RPS guard on API; Worker payload size + rate enforcement
  - [ ] Configurable in env; logs/audit entries
  - [ ] Load test shows expected 429 behavior

- [ ] **2.4 Performance pass**
  - [ ] Profiling; batch partition tuning; indices/materialized views
  - [ ] Optional ClickHouse single-node migration
  - [ ] Targets: ingest p95 < 400ms@100RPS; top charts < 1.5s at 10M rows

---

### Phase 3 — Public Launch

- [ ] **3.1 Usage metering & retention tiers**
  - [ ] Event counters per project/month; sampling for free tier
  - [ ] Retention policies via object-store lifecycle rules
  - [ ] UI shows usage; automated deletion for expired data

- [ ] **3.2 Billing proration & invoices**
  - [ ] Webhooks for proration; invoice previews; overage SKU
  - [ ] Verify: upgrade/downgrade creates prorated invoice items

- [ ] **3.3 Local-only CLI (OSS)**
  - [ ] `packages/cli` reads local logs → cost/latency by model; no network
  - [ ] `lensai-cli analyze file.json` outputs table; unit tests

- [ ] **3.4 Docs site + case study**
  - [ ] `/docs` with Docusaurus/Nextra; installation, FAQ, security, case study
  - [ ] Deployed static docs; all SDK links valid

---

### Phase 4 — Depth & Integrations

- [ ] **4.1 Per-model analytics & team policies**
  - [ ] Dashboard filters; budget policies per model/route
  - [ ] CSV export for paid tiers

- [ ] **4.2 VS Code extension**
  - [ ] Show “last request cost $X, latency Y ms” from local cache; quick-link to budgets
  - [ ] Installable VSIX; events in status bar

- [ ] **4.3 LangChain/LlamaIndex adapters**
  - [ ] Minimal adapters/packages; examples; one-line integration samples

---

### Phase 5 — Trust & Enterprise

- [ ] **5.1 Security whitepaper & controls map**
  - [ ] Whitepaper; SOC2 mapping; IR policy; vuln mgmt schedule

- [ ] **5.2 Audit logs and exports**
  - [ ] Immutable audit log table; signed export endpoint

- [ ] **5.3 On‑prem/VPC PoC**
  - [ ] Helm chart/Terraform; bring-your-object-store mode
  - [ ] Deploys to customer VPC with self-hosted ClickHouse/Postgres

---

### Phase 6 — Scale & Reliability

- [ ] **6.1 SSO/SAML** via WorkOS/Auth0; Okta test; JIT provisioning
- [ ] **6.2 Multi‑region ingest** with residency flags; aggregate replication; region-aware routing
- [ ] **6.3 Savings‑Share SKU** contract + computation; validate vs provider invoices

---

### Environment variables (reference)
- [ ] Common: `NODE_ENV`
- [ ] Dashboard: `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_SECRET`
- [ ] API: `DATABASE_URL`, `JWT_SECRET`, `HMAC_INGEST_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Worker: `WORKER_HMAC_SECRET`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`
- [ ] Batch: `DATA_LAKE_S3_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

---

### Make targets (verify locally)
- [ ] `make infra.up` starts Postgres/MinIO/(ClickHouse)
- [ ] `make dev` runs `api`, `dashboard`, `worker` concurrently
- [ ] `make test` runs `pytest` and dashboard tests
- [ ] `make seed` loads seed data

---

### Test gates (MVP)
- [ ] Unit: SDK payload/signature; API budget math; redaction rules
- [ ] Integration: ingest → object store; batch produces aggregates; API reads aggregates
- [ ] E2E: onboarding → project → SDK install (mock) → budget alert to Slack → dashboard shows charts
- [ ] Load: K6 100 RPS; ingest p95 < 400ms; error rate < 1%

---

### Ticket queue (copy/run in order)
- [ ] Ticket 1 — Monorepo bootstrap
- [ ] Ticket 2 — Python SDK minimal wrapper
- [ ] Ticket 3 — Cloudflare Worker ingest
- [ ] Ticket 4 — Nightly batch & Parquet conversion
- [ ] Ticket 5 — API endpoints (budgets/metrics)
- [ ] Ticket 6 — Slack alerts & kill‑switch
- [ ] Ticket 7 — Auth (magic link) & projects/api keys
- [ ] Ticket 8 — Billing (Stripe) baseline
- [ ] Ticket 9 — Dashboard MVP
- [ ] Ticket 10 — Security pass
- [ ] Phase 2–6 tickets (see sections above)


