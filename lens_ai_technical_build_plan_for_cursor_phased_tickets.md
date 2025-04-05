# LensAI — Technical Build Plan for Cursor (Phased Tickets)

**Goal:** Give Cursor/codegen a sequenced set of small, testable tickets to build the lean, cost‑first wedge: **budget control + real‑time cost/latency visibility** for LLM usage. Phases map 1:1 to the roadmap. Each ticket includes: *story, deliverables, acceptance criteria, key files/folders, env vars, run commands, and test notes.*

---

## Repo Layout (Monorepo)

```
/README.md
/apps
  /dashboard            # Next.js 14 + TS, Tailwind
  /api                  # FastAPI + Pydantic v2, Uvicorn
/jobs
  /batch                # Nightly aggregation jobs (Python + DuckDB/ClickHouse)
/packages
  /sdk-python           # Python SDK (MVP)
  /sdk-node             # Node SDK (Phase 2)
  /cli                  # Local-only CLI (Phase 3)
  /shared               # Shared schemas, OpenAPI, SQL, utilities
/infra
  /terraform            # Cloudflare Worker, S3/R2 bucket, Postgres, ClickHouse (opt)
/docs                   # Docs site content (Phase 3)
/scripts                # Dev convenience (seed, stripe, slack)
```

**Primary stacks**

- Dashboard: Next.js 14 (app router), TypeScript, Tailwind, tRPC (optional) or REST fetch.
- API: FastAPI, SQLModel/SQLAlchemy, Pydantic v2, Postgres (auth/billing), Redis (later).
- Ingest: Cloudflare Worker (TypeScript) → R2/S3 Parquet.
- Query: DuckDB on Parquet (MVP) → optional ClickHouse single node later.
- Batch: Python (polars/duckdb) nightly ETL.
- Billing: Stripe Checkout + webhooks.
- Alerts: Slack Bot (chat.postMessage), incoming webhook.

**Top-level tooling**

- Package manager: pnpm for JS workspaces; uv/pip for Python (or poetry).
- Task runner: Makefile.
- Tests: pytest (API, batch), Vitest (dashboard utils), Playwright (e2e), Wrangler test for Worker.

**.env templates**

```
# common
NODE_ENV=development

# dashboard
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXTAUTH_SECRET=<devonly>

# api
DATABASE_URL=postgresql+psycopg://lensai:password@localhost:5432/lensai
JWT_SECRET=devsecret
HMAC_INGEST_SECRET=dev_ingest_secret
SLACK_BOT_TOKEN=xoxb-...
SLACK_DEFAULT_CHANNEL_ID=C123...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# worker
WORKER_HMAC_SECRET=dev_ingest_secret
R2_BUCKET_NAME=lensai-events
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com

# batch
DATA_LAKE_S3_URL=s3://lensai-events/
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Event schema (core)**

```
ts TIMESTAMP, project_id TEXT, request_id TEXT, user_id TEXT NULL,
route TEXT, provider TEXT, model TEXT,
tokens_in INT, tokens_out INT,
cost_usd DECIMAL(12,6), latency_ms INT,
status TEXT, metadata JSON
```

---

# Phase 0 — Workspace Bootstrap

### P0.1 Create monorepo and tooling

**Story:** As a developer, I want a working monorepo with lint, format, test, run commands.

- **Deliverables:** Repo skeleton, Makefile, pnpm workspaces, uv/poetry config, pre-commit.
- **Accept:** `make dev` starts API (8000) & Dashboard (3000); `make test` runs unit tests.
- **Key files:** `package.json` (workspaces), `pyproject.toml`/`uv.lock`, `.pre-commit-config.yaml`, `Makefile`.
- **Run:** `pnpm i && make dev`.

### P0.2 Infra stubs & env management

**Story:** I can run locally with Docker for Postgres + MinIO (S3‑compatible) and a local ClickHouse (optional).

- **Deliverables:** `docker-compose.yaml` for Postgres, MinIO, (optional) ClickHouse; `.env.example` files.
- **Accept:** `make infra.up` brings services; healthchecks pass.

---

# Phase 1 — MVP Core (Weeks 1–4)

## 1.1 Python SDK (sync+async) — minimal wrapper

**Story:** As a developer, I can wrap OpenAI/Azure calls to emit events locally and send via HMAC to ingest.

- **Deliverables:** `packages/sdk-python/lensai/*.py`; config, decorators (`@trace_llm`), retry, background sender.
- **API:**

```python
from lensai import configure, trace_llm
configure(project_id="proj_x", ingest_url="https://ingest.lensai.dev/v1/events", hmac_secret="...")
@trace_llm(provider="openai", model="gpt-4o")
def call_llm(prompt: str): ...
```

- **Accept:** Unit tests generate payload, compute cost from token usage, sign HMAC header.
- **Env:** `HMAC_INGEST_SECRET`.

## 1.2 Cloudflare Worker — HTTPS ingest → R2/S3 Parquet

**Story:** As a platform, I ingest JSON events, verify HMAC, and append to Parquet in object storage.

- **Deliverables:** `infra/worker/src/index.ts`; Wrangler config; schema validation (zod); Parquet writer (duckdb‑wasm or stream to daily NDJSON → pack via batch job).
- **Accept:** `wrangler dev` accepts signed requests; invalid signature = 401; files partitioned by `dt=YYYY-MM-DD/project_id=`.

## 1.3 Batch job — nightly compaction & rollups

**Story:** Convert NDJSON to partitioned Parquet and compute daily aggregates.

- **Deliverables:** `jobs/batch/rollups.py`; cron (GitHub Actions or local); write tables: `daily_costs.parquet`, `daily_latency.parquet`.
- **Accept:** Running job produces partitions with expected columns; idempotent reruns.

## 1.4 Query layer — DuckDB (MVP) + optional ClickHouse

**Story:** API can query cost/latency aggregates quickly.

- **Deliverables:** SQL in `/packages/shared/sql/*`; helper in API to open DuckDB against S3 paths; *(optional)* ClickHouse DDL and connection.
- **Accept:** Queries for cost by model/user and P50/P95 latency under 1.5s at 10M rows (dev seed).

## 1.5 API (FastAPI) — budgets, alerts, metrics

**Story:** Provide REST endpoints for budgets and metrics powering the dashboard.

- **Deliverables:** `/apps/api/main.py`, routers, models, auth (magic-link later), simple API key auth now.
- **Endpoints (v1):**

```
POST /v1/budgets {project_id, limit_usd, period:"monthly"}
GET  /v1/budgets?project_id=...
POST /v1/budgets/{id}/override {minutes}
GET  /v1/metrics/summary?project_id=...&from=...&to=...
GET  /v1/metrics/cost-by-model?project_id=...&range=7d
GET  /v1/metrics/latency-pctl?project_id=...&p=95&range=7d
```

- **Accept:** OpenAPI generated; unit tests pass; error handling returns JSON problem details.

## 1.6 Slack Alerts + Kill‑switch

**Story:** Budgets trigger Slack alerts at thresholds and can hard‑stop via kill‑switch webhook.

- **Deliverables:** Slack app config; `apps/api/services/slack.py`; background job that evaluates spend vs. budget; `POST /v1/kill-switch/trigger`.
- **Accept:** On hitting 90%/100% budget in seed data, messages post to Slack test channel; kill‑switch state stored and reflected in API.

## 1.7 Auth (magic link) + projects & API keys

**Story:** Users sign in via magic link, create projects, and manage API keys.

- **Deliverables:** Postgres models: `users, projects, api_keys, budgets, alerts, audit_logs` with migrations; email sender stub (console in dev).
- **Accept:** Signup → email link → session cookie; CRUD for projects/keys; audit log rows created.

## 1.8 Billing (Stripe) — Starter/Growth + overages

**Story:** Users can subscribe and we meter events for overages.

- **Deliverables:** Stripe products/prices script; `POST /billing/create-checkout-session`; webhook handler for `checkout.session.completed`, `customer.subscription.updated`.
- **Accept:** Test checkout creates customer/sub; subscription state visible in dashboard; overage counters recorded (no charge capture yet if preferred).

## 1.9 Dashboard (Next.js) — first charts & flows

**Story:** New user can sign up, create project, install SDK, see first alert within \~60 min, and view charts.

- **Deliverables:** Pages: `/onboarding`, `/projects/:id`, `/budgets`, `/settings`; charts: cost by model/user, P50/P95 latency; copy‑paste SDK instructions.
- **Accept:** Lighthouse ≥ 85, basic e2e (Playwright) passes onboarding path.

## 1.10 Security — PII redaction & HMAC

**Story:** Ensure no sensitive content is stored; all ingest traffic signed.

- **Deliverables:** Redaction rules in SDK and Worker (configurable fields); HMAC middleware both ends; secrets rotation script.
- **Accept:** Tests verify redaction and signature failure cases.

---

# Phase 2 — Beta Hardening (Weeks 5–8)

## 2.1 Node SDK parity

**Deliverables:** `/packages/sdk-node`; TypeScript API mirroring Python; tests; examples for Express/Next API routes. **Accept:** Emit identical event schema; HMAC signatures match.

## 2.2 Onboarding polish + API keys UI

**Deliverables:** Wizard, copy‑button for env vars, API key creation/rotation; docs snippets for popular stacks (Express, FastAPI, Vercel Edge). **Accept:** Signup→First event median < 20 min in test script.

## 2.3 Rate limiting & quotas

**Deliverables:** Simple per‑project RPS guard on API; Worker enforces payload size and request rate; configurable in env. **Accept:** Load test shows 429 as expected; logs/audit capture.

## 2.4 Performance pass

**Deliverables:** Profiling, batch partition tuning, indices/materialized views; optional move to single‑node ClickHouse. **Accept:** p95 ingest < 400ms\@100RPS; top charts < 1.5s at 10M rows.

---

# Phase 3 — Public Launch (Weeks 9–12)

## 3.1 Usage metering & retention tiers

**Deliverables:** Event counters per project/month; sampling for free tier; retention policies executed via lifecycle rules. **Accept:** Automated deletion for expired data; billing page shows usage.

## 3.2 Billing proration & invoices

**Deliverables:** Stripe webhook handling for proration; invoice previews; overage SKU. **Accept:** Test upgrade/downgrade creates prorated invoice items.

## 3.3 Local‑only CLI (OSS)

**Deliverables:** `/packages/cli`; reads local logs, outputs cost/latency by model; no network; MIT license. **Accept:** `lensai-cli analyze file.json` prints table; unit tests.

## 3.4 Docs site + case study page

**Deliverables:** `/docs` with Docusaurus or Nextra; installation, FAQ, security page; public case study. **Accept:** Deployed static docs; all SDK links valid.

---

# Phase 4 — Depth & Integrations (Months 4–6)

## 4.1 Per‑model analytics & team policies

**Deliverables:** Dashboard filters; budget policies per model/route; CSV export for paid tiers. **Accept:** Users can set budget caps by model; exports generated.

## 4.2 VS Code extension

**Deliverables:** Surfacing “last request cost \$X, latency Y ms” from local cache; quick‑link to budgets. **Accept:** Installable VSIX; events show in status bar.

## 4.3 LangChain/LlamaIndex adapters

**Deliverables:** Minimal adapters/packages; examples. **Accept:** One‑line integration samples in docs.

---

# Phase 5 — Trust & Enterprise (Months 6–9)

## 5.1 Security whitepaper & controls map

**Deliverables:** Markdown whitepaper; mapping to SOC2; incident response policy; vulnerability mgmt schedule. **Accept:** Docs published; internal runbooks stored in repo.

## 5.2 Audit logs and exports

**Deliverables:** Immutable audit log table; export endpoint for customers. **Accept:** Tamper‑evident design; signed exports.

## 5.3 On‑prem/VPC PoC (paid)

**Deliverables:** Helm chart or Terraform module; bring‑your‑object‑store mode; support contract outline. **Accept:** Deploys to customer VPC with self‑hosted ClickHouse/Postgres.

---

# Phase 6 — Scale & Reliability (Months 9–12)

## 6.1 SSO/SAML

**Deliverables:** SAML via WorkOS/Auth0; role model extended. **Accept:** Okta test passes; JIT provisioning works.

## 6.2 Multi‑region ingest

**Deliverables:** Additional Worker regions; data residency flags; replication of aggregates. **Accept:** Region‑aware routing; latency SLO improves.

## 6.3 Savings‑Share SKU

**Deliverables:** Contract template; billing computation; validation against provider invoices. **Accept:** Report matches billing sources within tolerance.

---

## Database & Storage Schemas (MVP)

### Postgres (SQLModel)

```
users(id uuid pk, email text unique, created_at timestamptz)
projects(id uuid pk, owner_id uuid fk, name text, created_at timestamptz)
api_keys(id uuid pk, project_id uuid fk, name text, prefix text, hash text, created_at timestamptz, expires_at timestamptz)
budgets(id uuid pk, project_id uuid fk, limit_usd numeric, period text, hard_stop bool default true, created_at timestamptz)
budget_events(id uuid pk, budget_id uuid fk, threshold int, fired_at timestamptz)
alerts(id uuid pk, project_id uuid fk, channel text, payload jsonb, created_at timestamptz)
kill_switch(project_id uuid pk, active bool, reason text, activated_at timestamptz)
billing_customers(project_id uuid fk, stripe_customer_id text, plan text, status text)
subscriptions(id uuid pk, project_id uuid fk, stripe_sub_id text, seats int, created_at timestamptz)
audit_logs(id uuid pk, actor uuid, action text, subject text, meta jsonb, created_at timestamptz)
```

### Parquet partitions

```
s3://lensai-events/dt=YYYY-MM-DD/project_id=.../events-<hour>.ndjson
s3://lensai-events/parquet/dt=YYYY-MM-DD/project_id=.../*.parquet
```

### Aggregates (DuckDB/Parquet)

```
daily_costs(dt DATE, project_id TEXT, provider TEXT, model TEXT, route TEXT, cost_usd DOUBLE, calls BIGINT)
daily_latency(dt DATE, project_id TEXT, route TEXT, p50 DOUBLE, p95 DOUBLE, p99 DOUBLE)
```

---

## OpenAPI Snippets (key endpoints)

```yaml
openapi: 3.0.3
info: {title: LensAI API, version: 1.0.0}
paths:
  /v1/budgets:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [project_id, limit_usd, period]
              properties:
                project_id: {type: string}
                limit_usd: {type: number}
                period: {type: string, enum: [monthly]}
      responses:
        '200': {description: OK}
    get:
      parameters:
        - in: query
          name: project_id
          schema: {type: string}
      responses:
        '200': {description: OK}
  /v1/metrics/summary:
    get:
      parameters:
        - in: query
          name: project_id
          schema: {type: string}
        - in: query
          name: from
          schema: {type: string}
        - in: query
          name: to
          schema: {type: string}
      responses:
        '200': {description: OK}
```

---

## Makefile Targets

```
.PHONY: dev api dashboard infra.up infra.down test seed worker

infra.up: ## start local services
	docker compose up -d

infra.down:
	docker compose down -v

api:
	uvicorn apps.api.main:app --reload --port 8000

dashboard:
	pnpm --filter @lensai/dashboard dev

worker:
	cd infra/worker && wrangler dev

dev: infra.up
	make -j3 api dashboard worker

test:
	pytest -q && pnpm test --filter @lensai/dashboard

seed:
	python scripts/seed.py
```

---

## Test Plan (MVP)

- **Unit:** SDK payload/signature; API budget math; redaction rules.
- **Integration:** Ingest → object store; batch job produces aggregates; API queries read aggregates.
- **E2E:** Onboarding → project → SDK install (mock) → budget alert to Slack → dashboard shows cost/latency.
- **Load (local):** K6 script to POST 100 RPS; assert p95 < 400ms and error rate < 1%.

---

## Ready‑to‑Paste Tickets for Cursor

Copy each block into Cursor and run sequentially.

### Ticket 1 — Monorepo bootstrap

**Implement** repo skeleton, Makefile, pnpm workspaces, Python env (uv/poetry), pre‑commit, docker‑compose for Postgres+MinIO. **Done when** `make dev` starts API/dashboard/worker; healthchecks pass.

### Ticket 2 — Python SDK minimal wrapper

**Implement** `packages/sdk-python` with `configure`, `trace_llm` decorator, cost calculation helpers, HMAC signing. **Done when** unit tests show valid payload & signature; README example works.

### Ticket 3 — Cloudflare Worker ingest

**Implement** Worker that validates HMAC, does basic zod validation, writes NDJSON to R2 path with `dt` & `project_id` partitions. **Done when** posting a signed event creates an NDJSON file visible in R2/MinIO.

### Ticket 4 — Nightly batch & Parquet conversion

**Implement** `jobs/batch/rollups.py` that compacts NDJSON → Parquet and writes `daily_costs` & `daily_latency`. **Done when** running job on sample data outputs expected Parquet partitions.

### Ticket 5 — API endpoints (budgets/metrics)

**Implement** FastAPI endpoints for budgets & metrics, reading DuckDB/Parquet aggregates; generate OpenAPI. **Done when** Playwright dashboard can fetch metrics; pytest passes.

### Ticket 6 — Slack alerts & kill‑switch

**Implement** budget evaluation job + Slack notifier; kill‑switch endpoint & state. **Done when** seeded data triggers Slack 90%/100% alerts; kill‑switch flips and blocks non‑whitelisted routes.

### Ticket 7 — Auth (magic link) & projects/api keys

**Implement** email magic link auth, projects CRUD, API key mgmt; tie keys to HMAC signing. **Done when** new user can create a project and generate an API key used by SDK.

### Ticket 8 — Billing (Stripe) baseline

**Implement** Stripe Checkout/session creation + webhook handlers; show subscription state in settings. **Done when** test checkout changes plan and the UI reflects status.

### Ticket 9 — Dashboard MVP

**Implement** Next.js pages with onboarding wizard, charts (cost by model/user, P50/P95), budget UI. **Done when** new user path completes and charts render with seed data; Lighthouse ≥ 85.

### Ticket 10 — Security pass

**Implement** redaction config in SDK/Worker, secrets rotation script, audit logs for key actions. **Done when** PII fields are removed in stored payloads and actions recorded.

*(Proceed with Phase 2–6 tickets as listed in their sections.)*

---

This plan is optimized for small, composable diffs that compile and ship continuously, keeping infra burn low while proving the wedge quickly.

