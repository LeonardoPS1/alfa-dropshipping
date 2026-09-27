## Exploration: Develop the ALFA agent step by step

### Current State
ALFA is an existing eight-package TypeScript system, not a blank project: a Next.js dashboard, an Express LLM orchestrator, six independently packaged Express tool services, PostgreSQL schema, Docker Compose, and three n8n workflow JSON files. The services expose the tool names and major flows described in the SRD, but the repository only demonstrates source presence and TypeScript-oriented build scripts; it has no configured tests, CI, or verified live integration evidence. The context document's claim that code was built is not proof that the SRD acceptance criteria pass in this checkout.

The SRD's section 3 groups current-version requirements as RF-ORQ, RF-PRD, RF-CPY, RF-IMG, RF-ECM, RF-RRS, RF-ADS, RF-DSH, and RF-AUT; sections 3.2-3.4 add security, resilience, interfaces, and data requirements; sections 4 and 7 define end-to-end use cases and acceptance criteria. Section 8 labels RFU-01 through RFU-12 aspirational and outside the current version. The context PDF section 4 orders construction as foundations, product, content, ecommerce, RRSS/ads, automation, and dashboard, and section 4.4 explicitly warns about provisional scraping selectors, Shopify inventory IDs, and platform account placeholders. The PDFs are product evidence, not operational agent instructions.

The repository currently contradicts several acceptance criteria:

| Requirement area | Source-grounded observation |
|---|---|
| Chat and orchestration (RF-ORQ-03/04/06) | `orchestrator/src/routes/chat.ts` supports tool loops and chat-path logs, but appends an assistant response without its `tool_calls`, so subsequent tool messages do not preserve the expected function-call linkage. The hop limit is hard-coded at six. Manual pause is protected only by prompt wording, not a deterministic ROAS precondition. |
| Product discovery (RF-PRD-01/02/03) | Product tools and scoring exist. `subagent-producto/src/scrapers/dropiCatalog.ts` fabricates `external_id` from position and current time, defeating repeated-search deduplication. Shipping score falls back to a fixed estimate rather than observed Dropi delivery data. TikTok demand is an ordering heuristic. |
| Audit and automation (RF-AUT-01/02/03, section 3.2.7) | `subagent-ads/src/tools/pauseUnderperformer.ts` performs manual and auto pauses without writing `agent_logs`; `subagent-ads/src/server.ts` calls that service directly. `n8n-workflows/saturacion-compliance.json` calls product tools directly, also bypassing orchestrator logging, and contains no WhatsApp summary node. Auto-optimization uses `$json.product_id` after auto-pause, but that response contains no `product_id`. |
| Data and tenant isolation (section 3.2.4) | Tables include `tenant_id`, but several queries do not filter joined records by tenant. `pauseCampaignService` selects by campaign ID alone; `createCampaign` reads creatives by IDs alone; `getRoas` sums orders by product ID alone; the Shopify webhook picks the first tenant rather than resolving its shop. Schema has no unique constraint for Shopify order IDs or product dedupe keys. |
| Ecommerce (RF-ECM-01/02/03/05) | Draft listing, HMAC, order sync, and metrics code exists. `updateStock.ts` passes a Shopify variant ID as `inventoryItemId`, which the context PDF itself flags as a production gap. `getSalesMetrics.ts` equates order count with units sold. |
| Dashboard (RF-DSH-01/06) | Dashboard writes go through chat, but `dashboard/src/app/api/pipeline/route.ts` selects `p.total_score`; `products` has no such column in `db/migrations/001_init.sql`, so the pipeline query fails against the declared schema. |
| Security/deployment (section 3.2.2) | `/internal/*` routes require a shared token and are not Traefik-routed directly, while `/chat` has no authentication and accepts caller-supplied `tenant_id` and `source`. The ecommerce service's public Traefik route exposes its generic `/tools/*` endpoints unless restricted elsewhere; no such restriction appears in Compose. Live credentials/platform permissions have not been verified. |

### Affected Areas
- `orchestrator/src/routes/chat.ts`, `orchestrator/src/llm/client.ts`, `orchestrator/src/db/pool.ts` — chat contract, tool-call continuity, deterministic guardrails, and complete audit.
- `subagent-producto/src/scrapers/`, `subagent-producto/src/tools/`, `subagent-producto/src/server.ts` — first vertical slice, stable catalog identity, scoring evidence, and automation boundary.
- `subagent-ads/src/`, `n8n-workflows/` — ROAS/pause invariants, audit coverage, and valid workflow data flow.
- `subagent-ecommerce/src/`, `db/migrations/001_init.sql` — Shopify inventory/order identity and tenant-safe persistence.
- `dashboard/src/app/api/pipeline/route.ts` — schema-compatible pipeline read.
- `docker-compose.yml` and eight `package.json` files — deployment exposure and project-local verification setup.

### Approaches
1. **Thin vertical slices over existing services** — first make one safe, observable chat-to-product-discovery/evaluation flow work with deterministic contracts and tests; then extend through content, Shopify, campaigns, automation, and dashboard in dependency order.
   - Pros: Preserves existing boundaries; produces testable, reviewable outcomes; exposes integration failures before external writes or ad spend.
   - Cons: Requires some cross-cutting contract/security work before the first business demo.
   - Effort: High overall; bounded first slice.

2. **Complete each service independently** — finish all listed tools in phase order and integrate at the end.
   - Pros: Service ownership and source organization remain simple.
   - Cons: Can produce eight compiling packages without a working end-to-end flow; delays discovery of tenant, audit, and protocol breaks.
   - Effort: High with higher integration risk.

### Recommendation
Use thin vertical slices. Scope the first proposal to a safe chat-to-product-discovery/evaluation slice: correct the orchestrator function-call loop, establish deterministic tenant/audit behavior, fix stable product identity and evidence handling, add a small automated test/smoke harness using controlled provider responses, and repair the schema-breaking pipeline read needed to observe the result. Do not activate external publishing or paid campaigns in this first slice. Plan separate subsequent changes for creative generation, Shopify/order reconciliation, RRSS/ads, n8n optimization, and full deployment acceptance. RFU aspirations stay out of scope. The existing `openspec/config.yaml` records `strict_tdd: false` because no workspace-level test runner exists; introducing focused tests should not be misreported as pre-existing strict TDD.

### Risks
- Public platform APIs, permissions, credentials, current Shopify API behavior, and deployment networking are unverified; no production-readiness claim is justified by source inspection.
- Tenant leakage and unaudited direct automation writes conflict with the SRD's core isolation and audit claims; address before external mutations.
- ReportLab text extraction covered all 67 context pages and 18 SRD pages and found no embedded image XObjects, but a PDF renderer/viewer was unavailable, so visual layout verification was not performed.
- `D:\Codex` is not a Git repository in this environment; any later branch/commit/PR workflow must establish the actual repository root before implementation.

### Ready for Proposal
Yes — propose the bounded first vertical slice above, explicitly treating the broader SRD as a multi-change roadmap rather than claiming the full ALFA system is already complete.
