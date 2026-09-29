# ALFA Reconstruction Roadmap

**Status:** planning for review; no product implementation authorized by this file. **Date:** 2026-09-28.

Reconstruct the complete operational SaaS in bounded vertical slices. Only the foundation has a detailed implementation plan now. Each later workstream requires its own dependency-ready plan and approval before implementation; the table below is coverage, not executable task detail or a completion claim.

**Approved design:** [ALFA SaaS reconstruction](../specs/2026-09-28-alfa-saas-reconstruction-design.md). **First plan:** [SaaS foundation](2026-09-28-alfa-saas-foundation-plan.md).

## Dependency map

```text
F Foundation ─── X Product experience ─── D Discovery/providers
       │                    │                     │
       ├────────────────────┴──── C Creatives ── H Shopify
       │                                            │
       ├──────────────────── A Ads/qualified metrics ┘
       ├──────────────────── S Social/DM/reporting
       ├──────────────────── W Automations/n8n
       └──────────────────── B Billing/agency
                 all workstreams ─── R Complete-flow acceptance/rollout
```

Some fixture development can overlap after shared contracts are stable; live activation cannot bypass its gate. Campaign launch requires approved media/destination and authorization. Autopause/replacement additionally requires qualified metrics and an approved policy. Agency navigation must never expose another organization's data.

## Complete coverage and acceptance

Paths in the target column are proposed, not claims that they already exist. Existing code areas are starting points to inspect/test, not proof of readiness. New module test filenames are proposals; exact commands belong to their subsystem plans.

| Workstream and deliverable | Target routes and existing/new code/test areas | Prerequisites and acceptance | Unresolved gate owner |
|---|---|---|---|
| **F SaaS foundation**: persisted accounts, memberships, store scope, team authority, encrypted vault metadata, commands, jobs, policies, audit | `/app/settings`, `/app/settings/team`, `/app/settings/stores`, `/app/settings/integrations`, `/app/activity`; `dashboard/src/lib/auth.ts`, proposed `dashboard/src/lib/saas/`, `db/migrations/003_*` onward; proposed `dashboard/tests/foundation.*.test.ts` | Detailed first plan. Two-organization/store isolation, membership revocation, explicit legacy mapping, real persisted team/settings operations, unknown outcomes and kill switch. Vault status is not a claim of provider connectivity. | Owner: approved mapping, root-account provisioning and platform key custody. Infrastructure operator: disposable DB/restore rehearsal and later destination authorization. |
| **X Public/auth/product experience**: reusable design system, actual public site, registration/recovery, onboarding and operational shell | `/`, `/login`, `/signup`, `/account/recovery`, `/onboarding`, `/app`; existing `dashboard/src/app`, `middleware.ts`, `components`; proposed auth/onboarding/accessibility/E2E tests | F identity APIs. Persisted onboarding; single-use recovery, abuse controls, safe redirects; graphite/light/lime direction, es-419, 360px/tablet/desktop, keyboard/WCAG 2.2 AA/reduced motion; summary counts from scoped data, unavailable distinct from zero. Do not invent trust claims. | Owner: registration/trial policy and mail delivery provider. Executor: approved typography/license and browser test tooling; no invented installed runner. |
| **D Discovery and interchangeable suppliers**: Dropi plus bounded CSV/API adapters and product dossiers | `/app/products`, `/app/products/[productId]`; `subagent-producto`, `dashboard/src/lib/pipelineQuery.ts`, `productDetail.ts`; existing discovery contract tests plus proposed import/supplier/economics tests | F + X. Preserve evidence/provenance/nullability, deduplicate source identity, validated bounded CSV mappings, SSRF-safe API connections; reviewed supplier switching must retain historical order/listing economics. Currency/fees/tax/FX assumptions visible; compliance is review guidance. | Provider/account owner: Dropi API access and allowed endpoints. Product owner: CSV limits and market/compliance/economic policy; official docs researcher verifies adapter capabilities. |
| **C Copy/image lifecycle**: durable generation, editing/versioning, approval and destination validation | `/app/creatives`, `/app/creatives/[creativeId]`; `subagent-copywriting`, `subagent-imagen`, proposed dashboard asset modules; proposed version/approval/format/cost tests | F + D. Correlated jobs, immutable approved versions, media ownership, format validation, provider/model provenance and cost authorization; no static image submitted as video. | Owner: model/image provider and budget policy, asset rights; provider access/docs verification. No new video/GPU subsystem. |
| **H Shopify commerce**: verified connection, draft/review/publish, variants/inventory/orders/fulfillment | `/app/shopify`; `subagent-ecommerce`, proposed dashboard commerce API/screens; proposed inventory/order/webhook/reconciliation tests | F + D + C. Correct variant/inventory identifiers, explicit currency/pricing, verified store ownership, authenticated replay-safe webhooks, no default-tenant orders, unknown create reconciliation, disconnect blocks new work while preserving history. | Shopify account owner + documentation researcher: supported API version/scopes/eligibility and controlled test store. Owner: fulfillment routing and explicit mapping. |
| **A Campaigns and decisioning**: typed Meta/TikTok launch/pause/budget, qualified reporting and creative replacement | `/app/campaigns`, `/app/campaigns/[campaignId]`; `subagent-ads`, existing `CampaignTable.tsx` replaced, proposed command/attribution tests | F + C + H. No chat-text mutation button; provider acknowledgment proves paused/launched state. Account/store caps, source/window/timezone/currency/freshness/refund/FX consistency; insufficient/zero-spend data never yields invented ROAS or autopause. Pause and relaunch are distinct authorized actions. | Account owner/docs researcher: Ads access, formats/scopes/review/sandbox. Owner: attribution/refund/FX policy, thresholds/window/minimum-spend/grace/data-age and funding model. |
| **S Social and messaging**: calendar, publish/schedule/cancel, supported DM workflows and WhatsApp reports | `/app/social`; `subagent-rrss`, proposed reporting/DM modules; proposed DST/publication/dedup/consent tests | F + C + W scheduling. Scoped accounts, valid formats, persisted UTC schedule with timezone/DST, external publication/message IDs and truthful failures. WhatsApp recipients/templates/consent explicit. DM research required: an inbox is not acceptance. | Account owner + researcher: Instagram/TikTok publishing/DM feasibility, permissions/review and WhatsApp provider/template/consent eligibility. Full original scope blocked unless supported or user explicitly revises it. |
| **W Configurable automations and assistant**: manual/assisted/autopilot, approvals, signed scoped n8n workflows | `/app/automations`, contextual assistant, job/approval centers and activity; `orchestrator/src/routes/chat.ts`, `mcp/registry.ts`, `n8n-workflows/auto-optimizacion.json`, `reporte-roas.json`, `saturacion-compliance.json`; proposed policy/service-identity tests | F; uses D/C/H/A/S capabilities only after independently proved. Shared command authority across buttons/chat/n8n; unregistered tools denied; expiring capability-scoped service identities, trigger replay controls, persisted approvals, limits, kill switch and reconciliation. No duplicate cron/n8n execution. | Owner: per-action limits/modes and recipient schedule. Infrastructure operator: n8n credentials/version/runtime topology and activation authorization. |
| **B Subscription and agency operations**: tiered individual/agency plan flow, metering, checkout/portal/invoices, multi-store/member administration | `/app/settings/subscription`, onboarding checkout, public plans, context selectors/team/stores; proposed gateway/entitlement/usage modules and signed-webhook tests | F + X. Server-side entitlements never expand role authority; job/effect usage dedup; checkout identity and webhook/reconciliation determine payment, not browser success. Agency policies/assigned stores function end to end. | Owner decides gateway, prices/quotas/trial/tax/currencies/terms/refunds/cancellation and customer-direct vs platform spend. Gateway eligibility officially verified before live checkout. |
| **R Full acceptance and rollout**: complete original journey and all menu acceptance | Cross-package fixture harness, disposable PostgreSQL tests, operational runbook and separately authorized live checklist | All above. Correlated product → evidence → approved copy/image → Shopify → campaign → qualified ROAS → controlled pause/replacement → social/report trace. Every route has persisted behavior, permissions and empty/loading/error/partial states. Fixtures are not live proof. Restore/rollback, secret-safe telemetry, queue/reconciliation/spend alarms verified before activation. | Owner accepts plan/execution/releases and external-effect scope; infrastructure operator supplies reviewed migration/backup/restore/destination/credential authorization; provider owners supply controlled accounts/assets/spend caps. |

## Existing defects: explicit remediation ownership

| Audit finding from approved design/PDF review | Owning workstream and required proof |
|---|---|
| Campaigns uses `DEFAULT_TENANT_ID`; natural-language pause never reaches allowed Ads tool | F isolates/gates historical routes; A replaces with typed scoped pause and asserts external confirmation. |
| Only discovery tools are registered | W adds narrow capability registration after each module's tests; never mass-enable dormant subagents. |
| Global provider credentials; disconnected creative/Ads/social flow | F vault and execution contract; C/H/A/S connect tenant-owned provider adapters and readiness tests. |
| Shopify inventory semantics and default-tenant orders | H asserts exact official API contracts, webhook store ownership and duplicate/unknown-outcome behavior. |
| Product revenue reused for each campaign's ROAS | A tests attributed revenue/window/currency/refund/FX alignment and insufficient-evidence decisions. |
| Original PDF snippets are unverified implementation examples | Each subsystem validates against current official docs and contract fixtures; no copy-and-activate shortcut. |
| Previous discovery slice advertised as whole app | Every release is named by slice. Full SaaS acceptance requires R and all unresolved gates resolved or explicitly renegotiated. |

## Delivery and workflow

- Proposed new tracker identity: `feat/alfa-saas-reconstruction`; foundation children `feat/alfa-foundation-01` through `10`. Names are proposals; no branch/PR created here. Do not reuse the historical discovery tracker as a full-product completion claim.
- Strategy: `auto-chain` / `feature-branch-chain`. Draft/no-merge tracker targets main; child 01 targets tracker, each later child targets its immediate predecessor; only integrated tracker ultimately merges to main. Every PR includes its dependency diagram, current boundary, tests, runtime proof, rollback and follow-ups.
- Budget: 400 authored additions + deletions per PR; include tests/docs, exclude generated output from authored estimate only. Make one honest slice pass. Record actual overages and the user's standing `size:exception` approval when a coherent behavior cannot split; never omit tests or compress code.
- Foundation forecast: ten coherent slices, roughly 250–550 authored lines each; approximately 3,000–4,500 total, high budget risk. Estimates are planning ranges, not observed counts. Later workstreams are not line-estimated until their plans exist.
- The old OpenSpec discovery change is historical. If execution uses SDD, create/reconcile a new reconstruction change through native status/preflight/planning and current authority before apply. No SDD phases or native mutations ran in this planning task.
- User approved design and plan preparation, not product implementation. Review the foundation plan and select execution method first. Recommend bounded delegated/subagent execution because isolation, credential handling and external-effect recovery require independent scrutiny; respect native review authority rather than creating a parallel review harness.
- Each later stage returns its verified outcome and pending gates, then asks whether to continue or stop as requested by the user. A functional foundation is not the full SaaS.

## Next review

Approve/correct the [foundation plan](2026-09-28-alfa-saas-foundation-plan.md) and choose execution method. Commercial, provider and rollout decisions do not block safe local foundation implementation after approval, but remain hard activation gates. No remote operation is implied by local planning.
