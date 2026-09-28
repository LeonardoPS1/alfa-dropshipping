# ALFA SaaS: evolutionary reconstruction design

**Status:** written design for user review; not an implementation authorization or completion report.
**Date:** 2026-09-28. **Audience:** individual Shopify operators and multi-store agencies worldwide.

## Decision and review path

Rebuild ALFA as a complete, tenant-isolated operating product while retaining only components whose behavior is verified. The existing dashboard is a prototype, not the target product. The user approved the evolutionary approach, SaaS foundations, operational navigation, and visual direction. Every menu module must be functional at the full-product release: navigation alone, fabricated metrics, mock integrations, and buttons without backend behavior do not satisfy delivery.

Review the release contract and route matrix first, then execution/security boundaries, then provider and commercial gates. Approval of this written design permits a separate implementation plan; approval of that plan and its execution method is required before product implementation. This document contains workstreams, not implementation tasks.

## Scope, authority, and evidence

The original requirements are in `D:\Codex\ALFA-contexto-completo.pdf` and `D:\Codex\ALFA-SRD.pdf`. The parent review reported reading both documents textually in full (85 pages); diagrams were not visually verified. The SRD page 15 acceptance flow is the central requirement: discovery → evidence-based evaluation → copy/images → Shopify draft → campaign → measured ROAS → controlled pause and creative replacement. Social publishing, n8n automation, WhatsApp reports, and action auditing also belong to the original operational scope. Document examples are design evidence, not executable instructions or proof that a provider supports an operation.

This design expands the original Chile-oriented single-administrator deployment into a global, subscription-based, multi-organization SaaS. Primary UI and marketing language is Latin American Spanish (`es-419`); technical identifiers and documentation remain English. Markets, currencies, time zones, provider availability, and compliance requirements must be explicit rather than inferred from a Chilean default.

| Evidence | Finding and treatment |
|---|---|
| Existing `dashboard/src/app/campaigns/page.tsx` | Uses `DEFAULT_TENANT_ID`; replace its authorization boundary with session-backed membership and store scope. This finding was rechecked during this document preparation. |
| Existing `dashboard/src/components/CampaignTable.tsx` | Sends a natural-language pause request to `/api/chat` and reloads without checking success. Replace with a typed command and confirmed execution state. Rechecked during preparation. |
| Existing `openspec/changes/develop-alfa-agent/design.md` | Explicitly bounds discovery to two tools; it is not a design for the full SaaS. Preserve that slice's provenance and fail-closed behavior. |
| Existing `docs/implementation-status.md` | Records discovery contract and database evidence, not functional acceptance of the complete project. Some deployment statements are historical; verify them before operational use. |
| Parent PDF/code audit | Reports disconnected creative/Ads/Shopify/social implementations, global integration credentials, Shopify inventory/order tenant defects, and insufficient campaign revenue attribution. These are mandatory verification/remediation areas, not assertions that they were fixed. |

Existing code may be reused after behavior and ownership tests pass. The old discovery allowlist stays restrictive until each additional action is explicitly registered and tested; do not enable all existing tools at once. Preserve original and prior OpenSpec artifacts as historical scope evidence.

No SSH, deployment, production migration, remote file transfer, provider spend, or DNS change is authorized by this document. Previously supplied infrastructure and credentials must not be copied into it. Local mockups demonstrate design only; session keys and `.superpowers` contents are not product artifacts and must never be embedded or committed.

## Product journey and release contract

1. A visitor understands the operational pain, actual solution, pricing terms, and limits on the public site.
2. An authenticated member creates or joins an organization, chooses its plan, connects a Shopify store, then configures required providers.
3. An operator imports/discovers a product, reviews traceable evidence and economics, generates and approves creatives, and publishes a Shopify draft or approved listing.
4. The operator launches a supported campaign with explicit destination, budget, and policy. ALFA reconciles provider status and qualified metrics.
5. Manual, assisted, or autopilot policies govern pause, creative replacement, publishing, reports, and scheduling through the same execution layer.

**Full-product release:** every route below must implement its described workflow with persistent, isolated data and tested errors/permissions. A correctly implemented integration can report missing credentials or unsupported permissions and guide setup; a static placeholder cannot. Unsupported provider capabilities must be disclosed and resolved or explicitly renegotiated with the user before claiming the full original scope complete.

Incremental releases are allowed only as explicitly named slices. Hidden/incomplete modules, fixture-backed previews, or unresolved launch gates must be reported as pending, never described as the finished SaaS. Demo data must be visibly labeled and cannot enter spend-capable production workflows.

## Route and capability contract

All paths in the following table are **proposed target routes**, not claims that these routes exist today. Member routes use a trusted active organization/store resolved by the server; switching context is permission-checked. A route loading successfully is not its acceptance criterion.

| Proposed route | Functional actions and UI | Acceptance beyond rendering |
|---|---|---|
| `/` | Public landing: pain → solution → workflow → capabilities → honest trust evidence → plans → CTA. | Accessible without a session; no invented customer counts, ROAS promises, or testimonials. Links reach working login/signup/plan flows. |
| `/login`, `/signup`, `/account/recovery` | Sign in, registration, account recovery and logout; safe redirect to intended private destination. | Expiring single-use recovery, session invalidation, abuse protection, and no private-data leakage to visitors. |
| `/onboarding` | Organization setup, plan selection/checkout when enabled, first store, integrations, mode/limits, readiness checklist. | Saves progress; verifies connections; never marks onboarding complete from dummy success. |
| `/app` | Summary: store-aware KPIs, approvals, jobs, alerts, integration health and next actions. | Metrics reconcile to scoped records; source, currency, window and freshness shown; unavailable is distinct from zero. |
| `/app/products`, `/app/products/[productId]` | Search/import, provider comparison, filters, pipeline/table, evidence-aware scoring, economics and compliance review. Product dossier links creatives, Shopify, campaigns and audit timeline. | Stable source identity, tenant/store ownership, persisted evidence and incomplete evaluations; imports and errors visible; no fabricated demand, shipping or margin. |
| `/app/creatives`, `/app/creatives/[creativeId]` | Generate/edit/version copy and images; preview destination formats; approve/reject; associate product and campaign. | Long-running work persists; generated versus approved is distinct; approved versions immutable; media ownership and format validated. |
| `/app/shopify` | Connect store; prepare/review draft, publish with approval, synchronize variants/inventory, inspect orders and fulfillment handoff. | Correct provider IDs and inventory semantics; authenticated webhook ownership and deduplication; partial failures recover without duplicate listings/orders. |
| `/app/campaigns`, `/app/campaigns/[campaignId]` | Supported Meta/TikTok create/launch; budget adjustment; confirmed pause; metrics, attribution, creative versions and audit. | Typed mutation reaches authorized account; provider response/reconciliation proves status; spend caps and qualified ROAS policies hold; no chat-only buttons. |
| `/app/social` | Asset-aware calendar, review, publish/schedule/cancel, per-channel results and failure recovery. | Supported scopes/formats verified; timezone-aware persisted schedule; provider publication ID/result required. DM capability remains a permission/research gate below. |
| `/app/automations` | Configure rules/schedules/modes by store/action; approval queue; execution history; pause/resume and kill switch. | Testable rules, bounded budgets, scoped n8n invocation, idempotent execution, cancellation semantics and audit; no hidden autopilot. |
| `/app/settings` | Settings overview with working links and readiness status. | Reflects actual organization/store state, not a decorative settings page. |
| `/app/settings/integrations` | Encrypted credential vault; OAuth/API setup, test, permission diagnosis, rotate/revoke/remove. | Masked secrets never returned; real scoped connection checks; revoked connections stop queued dependent work safely. |
| `/app/settings/team` | Invite/remove members, role changes and membership overview. | Expiring invitations; privilege checks; prevent last-owner removal; revoked membership immediately stops access. |
| `/app/settings/stores` | Connect/disconnect Shopify stores, select provider and store-specific currency/timezone/modes. | Tenant ownership proven before binding; cannot attach another organization's connection; destructive impact explained. |
| `/app/settings/subscription` | Plan, usage, checkout, invoices, portal/change/cancel and payment state. | Signed/replayed webhook handling, server-side entitlements and reconciliation; commercial approval gates met. |
| `/app/activity` | Searchable audit/jobs, approvals, retries and recoverable errors. | Scoped and sanitized records with request/job/action IDs; actionable failures, not secret-bearing logs. |
| Contextual assistant across `/app/*` | Read scoped context; explain evidence; propose/execute registered actions according to role and policy; link affected records. | Uses the same commands as buttons and schedules; cannot invent success, select another tenant, bypass approval, or expose secrets. |

Navigation is a real operating surface: active module, organization/store selector, universal scoped search, contextual help, approvals and job center. Empty states lead to setup or legitimate actions. Errors preserve filters/input and provide safe retry. No menu item is accepted merely because it opens a screen.

## Architecture and ownership

Retain the current Next.js dashboard and service boundaries where verified, rather than introducing an unrelated framework rewrite. Separate presentation, application commands/queries, domain policies, persistence and provider adapters. Existing subagents are execution adapters, not independent authorization authorities.

```text
Public pages / authenticated UI / contextual chat / authenticated n8n triggers
  → session or service identity + server-resolved organization/store membership
  → typed query/command boundary + role + entitlement + approval + budget policy
  → durable job / domain service + audit + idempotency/outbox
  → narrow provider adapter (tenant-scoped credential handle)
  → provider acknowledgment/webhook/reconciliation
  → scoped persisted result + user-visible actual status
```

The authenticated dashboard boundary owns user access; the command layer owns authorization and execution policy; provider adapters own provider protocol conversion; jobs own durable progress/retry; queries expose sanitized state. Workers must revalidate policy and connection version before executing delayed actions. Chat proposes commands but does not supply authority. Internal bearer tokens alone do not confer arbitrary organization access.

### Tenant model

Organizations own memberships, subscriptions and shared configuration. Stores belong to exactly one organization and bind Shopify identity, provider connections and operational policies. Product candidates belong to an organization; store deployment records bind creatives/listings/campaigns and operational data to stores. Every applicable query and foreign-key relationship enforces organization ownership; store-specific actions additionally enforce store ownership. No production request falls back to a global tenant.

Users may belong to multiple organizations. Roles are owner, administrator, operator and reader. Owners manage billing and ownership; administrators manage stores, connections and members except ownership transfer; operators act within assigned stores and policies; readers cannot mutate. Store assignments narrow role access. Subscription entitlements never expand role privileges. Invitation, role change, cancellation and impersonation-like administrative operations are audited; global support access is not implicitly granted by this design.

Migration must explicitly map legacy tenant records to an organization and store, with an orphan/conflict report. Never assign uncertain records automatically to the active user or default organization.

### Integration vault

Connections include organization/store binding, provider account identity, supported capabilities/scopes, credential version, health and verification timestamps. Secrets are envelope-encrypted with deployment-managed key material; key IDs permit rotation. Database access alone must not reveal usable secrets. The browser receives masks/status and setup requirements, never secret values, refresh tokens, encryption keys or provider authorization headers.

OAuth state binds session, intended organization/store and nonce; callback identity and granted scopes are verified before activation. API-key connections use server-side checks with egress safeguards for interchangeable API endpoints. Restrict arbitrary URLs to validated public HTTPS destinations and defend against SSRF, redirects and internal metadata access. CSV imports enforce file/row/size limits and validated mappings. Provider responses, uploaded text and model output are untrusted data.

Vault states: not configured, verifying, connected, insufficient permissions, expired/revoked, error. Rotation/revocation updates queued job eligibility. Platform-owned infrastructure keys are supplied through deployment secret configuration, not tenant settings; readiness reports list missing platform prerequisites without exposing values.

### Typed API and capability boundaries

Use authenticated queries for reads and validated commands for mutations. Proposed boundary families are `/api/app/products`, `/api/app/creatives`, `/api/app/shopify`, `/api/app/campaigns`, `/api/app/social`, `/api/app/automations`, `/api/app/jobs`, and `/api/app/settings/*`; exact handlers belong to the later implementation plan. These are intended interfaces, not existing paths.

Mutation commands carry resource ID, validated arguments, idempotency key and expected version; the server attaches actor, organization/store, request ID and credential handle. Never trust tenant IDs, role claims or provider credentials in the command body. Reject cross-origin/CSRF mutations as appropriate to the authentication mechanism. Examples: `campaign.pause`, `campaign.setBudget`, `creative.generate`, `shopify.publishDraft`, `social.schedule`. Return a typed immediate result or job reference; errors have stable codes and sanitized, localized guidance. Missing authorization fails before dispatch.

UI, chat and n8n call the same capability registry and command service. Service identities are organization/store/capability-scoped, expiring and auditable; n8n cannot submit arbitrary tool names or bypass approval. Read endpoints do not discover, publish, schedule or spend implicitly.

### Jobs, reconciliation and truthful state

Persist jobs, attempts, approvals, effects, idempotency records and an outbox in PostgreSQL; workers claim with bounded leases. Use unique effect keys scoped to organization/store/action/resource. Persist intent before external effects, and persist provider identifiers before confirmation. Delivery is at least once: provider idempotency or external-ID reconciliation is required for safely repeatable effects, not an unsupported exactly-once claim.

Job states include queued, awaiting approval, running, succeeded, partial, failed, canceled and outcome unknown. Provider resource states remain separate. A timeout after submission is unknown until reconciliation; retrying creation blindly is forbidden. Retry only transient failures with bounded backoff/jitter; validation/permissions failures require correction. Scheduling uses store timezone but persists UTC instants, including daylight-saving behavior. Webhooks verify signatures, connection ownership and replay/deduplication before updating state.

The UI distinguishes requested, processing, confirmed and failed. It shows provider/source, last synchronization and stale state. Cancellation stops unstarted effects; a completed external effect requires an explicit compensating command, not rewriting history. Audit failure before mutation blocks execution; post-effect persistence/audit failure becomes a recoverable uncertain outcome with reconciliation, never false success.

## Provider and domain policies

### Discovery and economics

Dropi is the launch supplier; CSV/API adapters permit changing providers without rewriting domain flows. Each adapter reports identity, catalog and operational capabilities separately; CSV catalog import does not imply automatic ordering/fulfillment. Switching suppliers does not rewrite historical orders or silently substitute an active listing's cost/stock; require reviewed mappings and explicit future-effect activation.

Preserve observed/estimated/unavailable evidence, source, capture time and nullable evaluations from the proven discovery slice. Supplier price alone is not selling price or observed profit. Margin calculations expose shipping, fees, taxes where configured, currency conversion and assumptions. Saturation/demand and compliance checks require evidence, not synthetic scores relabeled measured. Market-specific compliance is a reviewed policy aid, not blanket legal approval; regulated categories and unsupported jurisdictions require explicit human review.

### Creatives and Shopify

Generate copy and images as versioned product assets, with model/provider provenance and cost limits. Operators can edit, preview, approve and regenerate. Rights and platform policy checks precede publishing. Destination format validation prevents submitting static images to video-only placements. No new video-generation/GPU subsystem is introduced by this design.

Shopify is the only sales channel in v1. Store authentication, scopes and API version support must be verified against official documentation before implementation. Publish drafts first unless an approved store/action policy permits direct publication. Variant/inventory IDs, pricing/currency, image association, stock synchronization, order ownership and fulfillment routing require contracts and provider reconciliation. Store disconnect leaves history readable but stops new dependent actions. Orders cannot be attributed to a default tenant.

### Campaigns and qualified ROAS

Meta and TikTok are intended Ads adapters; enable creation/launch only after official supported account scopes, product access, placement formats and review requirements are verified. Unsupported operations return capability-specific setup guidance, not simulated success. Existing code is not proof of provider approval. Static image assets must not masquerade as videos; a supported format or approved existing media is required.

Campaign metrics record provider/account/campaign identity, attribution model/window, event source, reporting timezone, currency, period and freshness. ROAS is qualified attributed revenue divided by aligned spend, not total product sales divided by each campaign's spend. Reconcile Shopify conversion events with provider-reported results without double counting; expose disagreements and label the chosen metric. Refund treatment and FX source/time are explicit. Missing attribution, inconsistent windows/currencies or zero spend yields unavailable/insufficient evidence, not an invented ratio. Store currency and ad-account currency remain distinguishable.

Automatic pause requires an approved policy with threshold, evaluation window, minimum spend, data-age limit, conversion-lag grace period and currency-alignment rule. Evaluate only fresh qualified data; missing/stale data triggers an alert, not a low-ROAS decision. Bounded campaign/account/store budgets are checked atomically before execution and reconciled with provider spend; ALFA cannot guarantee a provider stops charging instantly. Pause is confirmed externally before showing paused. Creative replacement is a separate reviewed/versioned action; automatic relaunch requires explicit policy and budget authority, never follows implicitly from a pause.

### Social, messaging and n8n

Social publishing must support a validated content/calendar flow with account-scoped permissions, correct formats, durable schedules and publication IDs. Instagram/TikTok publishing feasibility and platform approval are official-documentation gates. Original social DM capabilities are not proven: research channel support, scopes, account eligibility, review and consent limitations before claiming them available. Full original-scope delivery remains blocked on this capability or an explicit user-approved scope revision; displaying an inbox is not fulfillment.

n8n provides authorized workflow execution and schedules, not a second permission system. Triggers are signed/scoped, use idempotency keys and consume the same commands. WhatsApp reports use an officially supported messaging provider, eligible accounts/templates and recipient consent; configure timezone, recipients, schedule and retry policy. No unsolicited sends or invented report delivery. Provider selection/credentials and WhatsApp/DM account approvals are live-launch gates.

### Manual, assisted and autopilot

Modes are configurable per store, capability and action. Manual executes explicit commands; assisted prepares proposals for approval; autopilot executes only approved policies. Define allowed accounts/products, per-action/day limits, spend caps, schedule and required evidence. Each cost-bearing confirmation displays account/store, effect, budget/cost estimate and uncertainty. Owners/admins can narrow modes; operators cannot grant themselves automation authority.

The kill switch blocks new outbound effects for its scope and cancels/holds unstarted dependent jobs. It does not claim to undo already accepted provider operations. An in-flight effect is surfaced and reconciled; emergency provider pause remains explicit. Re-enabling requires permission, policy checks and a clear choice about held work rather than automatically draining it.

## Visual system and interaction design

The approved direction is **dense operational clarity**: graphite sidebar, warm-light working area, restrained lime/teal accents, crisp boundaries and readable hierarchy. Preserve this direction without treating the mockup's DOM or static sample data as production architecture. Avoid generic purple-blue gradients, floating decorative blobs, excessive glass panels and universal oversized cards.

Use shared tokens for color, typography, spacing, radii, elevation and motion. Select readable, licensed typography during implementation and self-host appropriately; do not silently introduce external tracking font requests. Summary, tables, dossiers, forms, wizard, calendar, approval panels and status badges share components and states. Spanish copy is neutral es-419: for example, "Conecta tu tienda", "Revisar borrador", "Pausa confirmada" and "Datos insuficientes". Public copy addresses operational fragmentation and wasted manual effort without guaranteed revenue claims.

Responsive acceptance covers 360px mobile, tablet and desktop; tables use purposeful overflow or compact views, not clipped controls. Keyboard navigation, visible focus, semantic landmarks, labeled forms, announced async status, error association and WCAG 2.2 AA contrast are requirements. Charts include textual/table alternatives. Motion explains state changes using short transform/opacity transitions and honors `prefers-reduced-motion`; it does not delay decisions or obscure budget warnings. Loading, empty, partial, offline/error, disabled, pending approval and stale states are designed explicitly. Date/number/currency formatting respects locale and selected store timezone.

The app shell exposes real navigation, account/store context, job/approval counts and contextual assistant. Public landing, login and private `/app` are distinct experiences. Private middleware must not redirect the public marketing site to login; client rendering alone is never access control.

## Subscriptions and commercial boundaries

Support tiered individual and agency plans, with server-side entitlements for store/member capacity and metered costly operations. Preserve a usable owner account without conflating it with a universal tenant or bypassing access controls. Track usage against durable jobs/effects and reconcile billing events; retries must not double-count billable usage. Display upcoming costs/limits and overage behavior before enabling them.

Payment gateway, exact plan names/prices, quotas, trial policy, taxes, billing currencies, refund/cancellation terms and whether provider spend is customer-direct or platform-funded remain **unresolved owner decisions**. Do not invent prices or promise global payment support. The later plan may build a gateway interface and noncommercial acceptance flow, but paid checkout/live launch requires approved commercial policy and verified gateway eligibility. Secrets and webhook signing keys belong to deployment configuration. Signed billing webhook replay handling, checkout identity binding and entitlement reconciliation are mandatory; browser checkout success is not proof of payment.

## Verification and acceptance matrix

Strict TDD for reconstruction is **RED → GREEN → REFACTOR**, as configured by current project instructions. Historical discovery documentation mentioning `strict_tdd: false` is evidence of that older slice, not permission to disable reconstruction TDD. The implementation plan must confirm package runners and capture observed failing tests before new behavior, then passing focused and applicable full checks. Existing `test:contract` commands in dashboard, orchestrator and product packages are candidates to verify, not proof of future module coverage.

| Area | Required proof |
|---|---|
| All menu routes | Role/context-aware navigation; actual persisted workflow; happy/empty/loading/error/partial/permission states; no placeholder release modules. |
| Isolation | Two organizations with overlapping IDs cannot read/change each other's stores, records, assets, jobs, metrics, vault or billing. Revocation and delayed-worker rechecks exercised. |
| Products | Provider/import contracts, identity deduplication, provenance preservation, nullable scoring, explicit assumptions and supplier-switch history. |
| Creatives | Versioning, generation job recovery, ownership/approval, format checks and linked approved asset use. |
| Shopify | Correct variant/inventory APIs, draft/publication result, order tenant binding, webhook deduplication and unknown-outcome reconciliation. |
| Campaigns | Typed pause/launch/budget contracts, role/spend limits, confirmed provider state; attribution/window/currency/freshness/minimum-spend fixtures and missing-data no-autopause tests. |
| Social and reports | Supported formats/scopes, persisted schedule/timezone, duplicate prevention, confirmed publication/message result; DM gate explicitly resolved. |
| Automations | Manual/assisted/autopilot policy matrices, approvals, kill switch with in-flight effect, bounded retry and scoped n8n triggers. |
| Vault/team/stores | Encryption/rotation, no secret exposure, OAuth state, SSRF defenses, invitations/last-owner rule and cross-store denied actions. |
| Subscription | Approved entitlements, signed event/replay contracts, usage deduplication and checkout ownership; commercial gates before paid activation. |
| Frontend | End-to-end keyboard and responsive workflows, visual inspection of actual screens, accessible states, honest data and reduced motion. |
| Complete ALFA flow | Product → evidenced evaluation → approved copy/image → Shopify → supported campaign → qualified metrics → policy-controlled pause/replacement → social/report trace, with correlated audit IDs. |

Provider contract tests use fixtures/fakes and assert exact requests, responses, permissions, retries and errors. They do **not** prove live integration or external account approval. Separately authorized provider sandbox/live acceptance records destination, operation, identity/credential channel, allowed assets, maximum spend, cleanup and expected effects. Missing approval/credential/sandbox or an unavailable check is reported blocked/skipped, never passed. Controlled end-to-end fixture tests and disposable-database integration tests are separate from production acceptance. Build/typecheck alone never fulfills functionality.

## Delivery workstreams and operational rollout

| Workstream | Responsibility and dependency |
|---|---|
| SaaS foundation | Organization/store membership, vault, commands, jobs, audit, policy and entitlement boundaries; prerequisite for outbound modules. |
| Product experience | Public/auth/onboarding and design system/app shell, then operational screens backed by authenticated queries/actions. |
| Discovery and commerce | Preserve discovery evidence; supplier adapters, creative lifecycle and Shopify publication/orders. Depends on foundation. |
| Ads and decisioning | Verified provider capabilities, campaign operations, attributed reporting and controlled pause/replacement. Depends on assets/commerce/foundation. |
| Social and workflows | Supported publishing, research-gated DMs, n8n and WhatsApp reporting. Depends on foundation and verified scopes. |
| Commercial readiness | Approved gateway/terms/plans, metering/billing, agency administration and full release acceptance. Depends on foundation and owner decisions. |

These workstreams require bounded specs/plans and reviewable feature-branch slices; they are not one giant unchecked rewrite. Existing services can remain behind capability flags while replacements are proved. No unrelated GPU/video generation, additional sales channels or support platform is included.

Use additive, versioned migrations first; rehearse forward migration, legacy mapping, backup restore and application rollback on disposable data. Inventory existing records and schema before mapping. Backups must be validated and access-controlled, not merely created. Keep old readers compatible during expansion; destructive column removal waits for verified replacement and rollback planning. Avoid duplicate cron/n8n triggers when enabling new workers.

Operational rollout requires explicit destination/operation/credential authorization, an approved migration/backup/rollback procedure and module readiness checks. Rollback includes application version, compatible schema, queued-job handling, credential versions and provider effects that cannot be undone. A code rollback cannot undo campaign spend/publication. Observe queue latency, failure/retry rates, denied actions, reconciliation backlog and spend alarms without logging secrets. Stop activation on unexplained isolation failures or unknown external effects.

## Open decisions and gates

| Decision/gate | Blocks |
|---|---|
| User review of this written design, then written plan/execution choice | Product implementation. Conversational/mockup approval does not skip these stages. |
| Gateway, approved prices/quotas/trials/terms, tax/currency and spend funding model | Paid checkout and commercial launch; do not fabricate defaults. |
| Official Shopify/Meta/TikTok/social scopes, formats, API versions and account eligibility | Affected live provider operations, not isolated fixture-based development. |
| Social DM support/permissions and WhatsApp provider/templates/consent | Messaging acceptance and full original-scope completion unless scope is explicitly revised. |
| Attribution source/window/refund/FX policy and approved autopause thresholds | Automated ROAS spending decisions; manual actions still obey limits and permission. |
| Platform credentials/key management, migration mapping, backup restore and destination authorization | Live deployment, migrations and external acceptance. |

No unresolved gate is a cosmetic placeholder exemption. The next step is user review of this design, then a separately approved implementation plan with exact verification commands and release slices.
