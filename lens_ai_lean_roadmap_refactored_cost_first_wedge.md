# LensAI Lean Roadmap (Refactored)

**Strategy theme:** Ship a lovable wedge that gives teams **budget control + real‑time cost/latency visibility** for LLM usage, then layer deeper analytics and enterprise features once paid demand is proven.

---

## 0) What changed from v1

- **Scope trimmed:** Focus on cost/latency visibility, budgets, Slack alerts. Defer anomaly detection, advanced RBAC, deep security scans, and heavy multi-tenant performance work until traction.
- **Infra simplified:** Start **SDK → HTTPS → Cloudflare Worker → R2/S3 (Parquet) → nightly batch → ClickHouse (tiny) / DuckDB**. No Firehose/Kinesis/Lambda in MVP.
- **Compliance timing:** Implement security controls now; pursue **SOC 2 “in progress”** after \$10k–\$20k MRR or an enterprise LOI.
- **GTM acceleration:** Convert design partners to **paid pilots** early; add **usage-based overages**, **retention add-ons**, and optional **savings‑share** for enterprise.
- **Free tier discipline:** Sampling + short retention; full fidelity is paid.

---

## 1) ICP & Value Proposition

- **ICP (initial):** SaaS teams with customer-facing AI features (support bots, content generation) spending \$2k–\$50k/mo on LLMs.
- **Jobs to be done:** Avoid surprise bills; enforce budgets; understand cost per request/model/user; keep latency within SLOs.
- **Promise:** “See every dollar and millisecond. Set budgets and auto‑protect them. No surprises.”

**Primary KPIs (first 90 days):**

- ≥ 2 design partners; ≥ 1 paid pilot
- Time‑to‑value < 1 hour from signup to first budget alert
- Daily Active Projects / Signups ≥ 40%
- Net data processed ≥ 5M events/month by Week 12

---

## 2) MVP Scope (Weeks 1–4)

**In‑scope**

- SDKs: Python first (Node in Week 6–8)
- Ingest: HTTPS endpoint (Cloudflare Worker)
- Storage: R2/S3 Parquet (append‑only); partition by `dt` + `project`
- Processing: Nightly batch aggregates (dbt/SQL jobs)
- Query: Tiny ClickHouse (single node) **or** DuckDB on Parquet for MVP
- Dashboard: Cost by model/user/route; P50/P95 latency
- Budgets: Hard budget caps + Slack alerts (thresholds & kill‑switch)
- Security: PII redaction on ingest; encryption at rest; secrets rotation
- Auth: Email+magic link; per‑project API keys
- Billing: Stripe (Starter/Growth), usage overages

**Out‑of‑scope (defer):** Real‑time anomaly detection, SSO/SAML, on‑prem/VPC, complex RBAC, auto‑scaling, Firehose/Kinesis, Intercom, multi‑region ingestion.

**Acceptance criteria**

- First budget alert delivered in Slack under 60 minutes from initial SDK install
- Dashboard loads top 3 charts < 1.5s for projects ≤ 10M rows
- p95 ingest < 400ms at 100 RPS (single region)

---

## 3) Lean Architecture

```
Client SDK (Python) → HTTPS Ingest (Cloudflare Worker)
   → R2/S3 Parquet (raw events, partitioned)
   → Nightly batch job (dbt/SQL or lightweight ETL)
   → ClickHouse single node (rollups) / DuckDB queries on Parquet
   → Next.js dashboard (Vercel) + FastAPI service (monolith) for API
   → Slack app for budget alerts + kill‑switch webhooks
```

**Data model (event core):** `ts, project_id, user_id, route, provider, model, tokens_in, tokens_out, cost_usd, latency_ms, status, metadata{}`

**Retention policy:** Free: sampled 20%, 7‑day retention. Paid: 100% fidelity, 30–365 days (as add‑on tiers).

---

## 4) Milestone Chart (Refactored)

| Phase                              | Window      | Objectives                                                                            | Key Deliverables                                                                                          | Exit Criteria                                            | Cost/Infra Impact                                          | KPIs                                   |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| **M0 – Kickoff & Design Partners** | Week 0      | Narrow ICP, select 3–5 partners, define event schema & budgets UX                     | ICP brief; event schema; partner MoUs; landing page draft                                                 | 2 signed partners; demo storyboard approved              | <\$50 one‑time                                             | 2 partners; 1 case study candidate     |
| **M1 – MVP Core**                  | Weeks 1–4   | Ship wedge: budgets + Slack alerts + basic dashboard                                  | Python SDK; HTTPS ingest; Parquet to R2/S3; nightly batch; CH/DuckDB; budgets; Slack alerts; Stripe basic | First partner sends data & receives alerts within 1 hour | \~\$100/mo (R2/S3, Vercel, tiny DB)                        | TTV < 1 hr; 1 pilot paying \$99–\$299  |
| **M2 – Beta Hardening**            | Weeks 5–8   | Onboarding polish; auth keys; performance tuning; Node SDK                            | Guided onboarding; API keys UI; Node SDK; rate limiting; p95 ingest < 400ms\@100RPS                       | 1–2 paid pilots; churn in beta < 20%                     | +\$50–\$100/mo                                             | ≥ 5 active projects; DAU/Signups ≥ 35% |
| **M3 – Public Launch**             | Weeks 9–12  | Case study, pricing page, Show HN/PH; overages; retention add‑ons                     | Marketing site v1; usage metering; retention tiers; billing proration; CLI (local) OSS                    | 10+ paying; \$3k MRR; 1 public case study                | +\$50–\$100/mo                                             | 10 logos; \$3k MRR                     |
| **M4 – Depth & Integrations**      | Months 4–6  | SDK Node solid, per‑model analytics, VS Code extension, LangChain/LlamaIndex examples | Model‑level views; team policies; VS Code extension; import guides                                        | \$8k–\$12k MRR; 1 enterprise LOI                         | Scale ClickHouse (cloud trial) +\$200–\$300/mo when needed | 25 logos; NRR ≥ 100%                   |
| **M5 – Trust & Enterprise**        | Months 6–9  | Controls map; pen test; “SOC 2 in progress”; on‑prem PoC (paid)                       | Security whitepaper; policy docs; audit logs; VPC/on‑prem PoC doc                                         | 1 on‑prem PoC; \$15k–\$25k MRR                           | VPC build costs covered by PoC                             | 40 logos; 1 enterprise pilot           |
| **M6 – Scale & Reliability**       | Months 9–12 | SSO/SAML; multi‑region ingest; savings‑share SKU; SLOs                                | SSO; multi‑region; Savings‑Share contract; p95 ingest < 250ms\@300RPS                                     | \$35k–\$50k MRR; churn < 3%/mo                           | ClickHouse Cloud prod; CDN; autoscale                      | 80–120 logos; ≥ 2 enterprise           |

---

## 5) Pricing & Packaging (v2)

- **Starter – \$99/mo**: 1 project, 5 seats, 5M events/mo, 30‑day retention, budgets & Slack alerts, basic charts.
- **Growth – \$499/mo**: 5 projects, 25 seats, 50M events/mo, 90‑day retention, per‑model analytics, priority support.
- **Enterprise – custom**: SSO/SAML, SOC2 reports, tailored retention (180–365d), VPC/on‑prem, DPAs, savings‑share option.
- **Add‑ons**: Retention upgrades; extra events (overages at \$X per 1M); P1 support; dedicated Slack.

**Notes:** Free plan (sampled 20%, 7‑day retention) optimized for trial/TTV—no CSV export.

---

## 6) Security & Compliance Path

- **Now:** PII redaction at ingest; encrypted storage; secure SDLC; least‑privilege IAM; audit logging; incident response runbook; DPA template.
- **Later (M5):** Controls mapping to SOC 2; external pen test; vulnerability mgmt cadence; customer‑facing security docs; “SOC 2 in progress” badge.
- **Trigger for full SOC 2:** \$10k–\$20k MRR and/or first enterprise LOI demanding report.

---

## 7) Metrics & Guardrails

- **Acquisition:** Signup→First Event ≤ 20 min; First Event→First Alert ≤ 40 min
- **Activation:** ≥ 3 dashboards viewed and ≥ 1 budget set in Day 1
- **Engagement:** Weekly active projects ≥ 60% of paying logos
- **Revenue:** ARPU ≥ \$250; Gross Margin ≥ 85%; Net \$ retention ≥ 100%
- **Reliability:** p95 ingest < 400ms (M2), < 300ms (M4), < 250ms (M6); 99.9% uptime post‑M4

---

## 8) GTM Plan (90‑Day)

1. **Design partners (Weeks 1–2):** 3–5 calls, 2 signed; pilots discounted but paid with success criteria (“no surprise bills” within 30 days).
2. **Content (Weeks 3–10):** Deep technical post (cost math per model), “how we built budgets on Parquet,” and a 2‑minute demo video.
3. **Launch (Weeks 9–12):** Case study + Show HN + PH + targeted founder/infra communities. Live savings calculator on landing.
4. **Developer love:** OSS local‑only CLI (SQLite) + VS Code extension nudging “this request cost \$X and took Y ms.”

---

## 9) Budget & Infra Targets

- **Target burn until 10 paying teams:** \$200–\$300/mo.
- **Vendors:** Cloudflare Workers + R2/S3 (storage), Next.js (Vercel hobby), FastAPI monolith (single VM), Postgres (auth/billing), tiny ClickHouse (or DuckDB), Stripe, GitHub.
- **Scale‑up switches:** ClickHouse Cloud; CDN; autoscaling; multi‑region; Intercom.

---

## 10) Risks & Mitigations

- **Data volume cost creep:** Use Parquet + partitioning, aggressive lifecycle policies, and sampled free tier.
- **SDK friction:** Provide copy‑paste recipes for popular frameworks; smoke tests; “hello cost” example in README.
- **Perception vs. observability incumbents:** Differentiate around **budgets/kill‑switch** and **cost math clarity**.
- **Compliance blockers:** Publish security whitepaper early; start “in progress” track before enterprise asks.

---

## 11) Checklists

**MVP Engineering Checklist**

-

**Beta/Launch Checklist**

-

---

## 12) Appendices

**A. Event Schema (proposed)**

```
ts: datetime
project_id: string
request_id: string
user_id: string | null
route: string
provider: string
model: string
tokens_in: int
tokens_out: int
cost_usd: decimal(12,6)
latency_ms: int
status: enum('ok','rate_limited','error')
metadata: object (jsonb)
```

**B. Budget Policies**

- Threshold alerts at 50/75/90/100% of monthly budget
- Hard stop (kill‑switch) at 100% with override window
- Per‑model and per‑route budgets beginning M4

**C. Savings‑Share SKU (enterprise)**

- Base platform fee + % of verified monthly savings (capped); requires read‑only billing access for verification.

**D. Data Lifecycle**

- Free: sample 20%, 7 days; Paid: 30/90/180/365 days
- Auto‑compaction of Parquet by day; Glacier/IA after 30 days (paid tiers)

**E. SLOs (evolving)**

- Ingest p95: <400ms (M2), <300ms (M4), <250ms (M6)
- Query p95 (top charts): <1.5s @ 10M rows; <1.0s @ 50M rows (M6 with CH Cloud)

---

*This refactor prioritizes fast time‑to‑value, low infra burn, and a crisp wedge that converts early users into paying pilots—while keeping an on‑ramp to enterprise trust & scale.*

