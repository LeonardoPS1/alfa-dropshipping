# Design: Safe Product Discovery Vertical Slice

## Technical Approach

Keep the existing authenticated Next.js dashboard → Express orchestrator → Express product subagent → PostgreSQL path, but make the discovery path an explicitly authenticated, bounded capability rather than a prompt-level convention. The first deployable journey accepts a dashboard-authenticated chat message, offers only `search_dropi_catalog` and `score_product` to the LLM, records each validated call and outcome, persists stable tenant-scoped products and evidence-aware evaluations, and reads them back from the dashboard. It does not invoke creative generation, Shopify, Ads, social, or n8n mutations. This implements the four delta specs without claiming the broader SRD or live providers are verified.

The code currently has one credentials-based admin identity, one fixed tenant UUID, and no user-to-tenant table. The design therefore supports that **current single-admin/single-tenant mapping** explicitly; it does not invent multi-user tenant selection. Tests inject two trusted tenant contexts at the service/data boundary to prove isolation. Future multi-user tenant mapping is a separate change.

## Architecture Decisions

### Decision: Bind tenant at authenticated service boundaries, not in prompt or request JSON

**Choice**: Dashboard API routes call `getServerSession(authOptions)` and resolve the configured server-side tenant UUID (the current default UUID, moved behind one shared dashboard helper). The chat proxy sends a server-to-server credential via `X-Alfa-Internal-Token`, a generated request ID, the tenant UUID, and the user message. The orchestrator rejects missing/invalid credentials, tenant UUIDs not equal to its configured single-tenant UUID, and a client/body tenant that contradicts the trusted context before any LLM/tool/database access. Use timing-safe token comparison, require nonempty configuration at startup, and remove the orchestrator's public Traefik route. A distinct credential protects the product subagent's discovery/evaluation `/tools/*` endpoints; the orchestrator supplies the trusted tenant and request ID. Browser input never supplies either authority. Product handlers reject untrusted direct calls and validate tenant/product ownership in SQL. Credentials stay in environment variables, not logs.

**Alternatives considered**: Trust `tenant_id` in `/chat` or product-tool bodies; trust only network location; introduce a new user/tenant table or general JWT issuer. **Rationale**: The first two are spoofable (the orchestrator is currently Traefik-routed and product tools are on a shared network), while a new identity model is unrequested scope. The service credential authenticates the only current caller, and a fixed server-owned tenant mapping matches actual NextAuth code. Dashboard session checks are still required in API routes, not only middleware. This does not assert that all unrelated service endpoints become secure; later changes must address direct n8n/product access separately. Existing direct unauthenticated n8n product-tool calls intentionally fail closed after protection until that integration is explicitly migrated.

### Decision: Validate a two-tool protocol with exact transcript linkage

**Choice**: Define a static discovery-tool registry with only `search_dropi_catalog` and `score_product`, their concrete argument validators, and `producto` as the only destination. Pass only these schemas to the provider; independently validate every returned tool name, unique nonempty call ID, JSON-object arguments, required/allowed fields, length/range/UUID constraints, and a finite per-request budget (at most six provider turns and eight tool calls). Preserve the assistant message with its complete provider `tool_calls` (ID, `type:function`, name, raw JSON argument string) before adding exactly one `role:tool` result per call ID. Do not coerce malformed JSON to `{}`. Reject an invalid batch before dispatching any call. A failing tool/source returns an explicit failure or partial outcome and stops unsafe continuation; no substitute tool, fabricated success, or silent dropped call. Bounded sanitized result summaries may be sent to the next provider turn; audit keeps full safe identifiers/status, not credentials or arbitrary unbounded provider payloads.

**Alternatives considered**: Expose `allToolSchemas()` and rely on system-prompt prohibitions; continue after errors with error-shaped tool messages; silently skip malformed arguments. **Rationale**: All three allow unsafe or misleading provider continuation. Fail-closed validation is deterministic and testable. `score_product` must not invoke `checkAdSaturation` transitively in this slice; it may read a same-tenant recent check if one already exists, otherwise competition evidence is unavailable.

### Decision: Audit every trusted attempt through existing `agent_logs`

**Choice**: Generate a request ID at the dashboard boundary (and validate it at the orchestrator). For each accepted/rejected provider tool call, write `agent_logs` with trusted `tenant_id`, `subagent`, `tool_name`, sanitized bounded `input`/`output`, and metadata `{ request_id, tool_call_id, trigger: "chat", outcome, product_ids, evaluation_ids }`. Record provider/protocol/budget failures under an orchestrator event name with the same request ID; never claim a successful call before a durable audit write. A missing/untrusted tenant cannot be inserted into the FK-backed table; return a rejection and emit only a safe operational event without attributing it to a tenant. Do not log message text, raw provider payloads, tokens, or connection strings. Audit write failure makes the journey fail closed, even if an earlier internal write succeeded; report partial persistence, never transactional success.

**Alternatives considered**: Keep only current success-path logging; add a new audit table. **Rationale**: `agent_logs` already supports JSON metadata and tenant attribution. Cross-service DB transactions are unavailable, so honest partial-result semantics matter more than a false all-or-nothing promise.

### Decision: Require source-native stable IDs and a database-enforced scoped upsert

**Choice**: Extract a stable Dropi product identifier from a validated product link/data attribute, with a canonical source URL retained as provenance. Reject a row without a stable source-native ID; never derive one from row position, display name, or time. Use `(tenant_id, source, external_id)` as identity and an atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING id` after a partial unique index for non-null `external_id`. Preserve existing internal UUIDs across repeated discoveries and never match another tenant. Update only source-observed fields from a validated result. Do not include TikTok `search_trends` in this first path because its current name-based identity and rank-derived demand do not meet the stable-identity contract.

**Alternatives considered**: The current SELECT-then-INSERT check; a name hash; forcing a unique constraint over nullable identifiers. **Rationale**: SELECT-then-INSERT races, names change, and nullable IDs cannot establish stable provenance. Actual Dropi selectors/account behavior remain unverified; if the source does not expose a stable ID, the live result must fail explicitly rather than manufacturing identity.

### Decision: Persist evidence status separately from scores

**Choice**: Add nullable `evaluations.evidence JSONB` containing typed per-input records `{ status: "observed" | "estimated" | "unavailable", value, source, observed_at?, reason? }`, including `catalog_price`. For each validated Dropi row, persist `products.raw_data.discovery_evidence.catalog_price` as `observed` with parsed numeric supplier price, canonical product URL, source `dropi`, and capture timestamp; an absent/invalid price becomes `unavailable` with a reason, not zero. `score_product` copies that persisted price evidence into `evaluations.evidence.catalog_price` for the same tenant/product, preserving status and source rather than reconstructing provenance from a bare number. `products.raw_data` also retains stable source identity/URL; it is not an authority for invented values. TikTok rank is not observed demand; in this slice it is not used. Supplier price without a real sale price does not establish observed margin; no `supplierPrice * 2.2` default is called real. Missing shipping remains unavailable, never a five-day observation. Existing recent same-tenant saturation checks, if used, include their timestamp/source; otherwise competition is unavailable and no live Meta call is triggered. Component and total scores are nullable when required evidence is missing; return a partial evaluation with explicit missing inputs rather than a fabricated full score. Preserve the existing weight formula only when all four component scores have defensible inputs; do not reweight missing components invisibly.

**Alternatives considered**: Put labels only in `justification`; keep fallback numeric values while adding caveats. **Rationale**: Structured evidence survives API/database/dashboard layers; prose or footnotes cannot prevent a number from being read as measured. The schema already allows nullable score columns.

### Decision: Make pipeline a tenant-scoped observation, including incomplete discovery

**Choice**: The pipeline API checks the NextAuth session, resolves the same server-side tenant, selects only declared product/evaluation columns, joins the latest evaluation with `e.tenant_id = p.tenant_id`, and constrains any optional creative/campaign subqueries by tenant. Select `p.raw_data #> '{discovery_evidence,catalog_price}'` and `e.evidence`; expose `catalog_price_evidence` from the tenant-scoped evaluation when present, otherwise from the tenant-scoped discovery product, without relabelling `observed`, `estimated`, or `unavailable`. Also expose evaluation ID/status, source, and source ID. The board/detail render the price value together with status and provenance, or an explicit unavailable label; they never display a bare estimated/missing price as observed. Add an explicit discovered/incomplete column or status so a product with no complete numeric score is visible, while only a persisted evaluation is labelled evaluated. Do not infer publication from chat/provider text. Return an actual empty result only after a successful query; return a distinct non-2xx error on DB/schema failure. The linked product detail page must also use the trusted tenant for its product and related-record queries, or the new pipeline link could open an unscoped record.

**Alternatives considered**: Replace `p.total_score` with `e.total_score` only; keep tenant filtering solely on `products`. **Rationale**: The absent product column is one bug, but unscoped lateral/subqueries and the linked detail page would still violate tenant isolation. No pipeline read may trigger discovery or writes.

### Decision: Use project-local Node 20 contract tests and controlled fixtures

**Choice**: Use Node 20's `node:test`/`node:assert` assertions and `tsx` as a package-local TypeScript test runner (new dev dependency in the three affected packages, rather than treating Next's build as a test). Add `test:contract` scripts using `tsx --test tests/*.test.ts` in `orchestrator`, `subagent-producto`, and `dashboard`; test files and exact commands are listed below. Inject provider, catalog, transport, session, and database seams rather than requiring live credentials. Add `orchestrator/scripts/smoke-discovery.ts` with `smoke:discovery: tsx scripts/smoke-discovery.ts`; it uses controlled LLM/catalog fixtures, a required disposable `ALFA_SMOKE_DATABASE_URL`, and the extracted dashboard pipeline query to exercise chat→product/evaluation→pipeline and report fixture mode/run ID/results. It rejects a missing disposable DB URL and fails if a forbidden transport is invoked. The smoke command is `npm run smoke:discovery --prefix orchestrator`. If disposable PostgreSQL is unavailable, report smoke as blocked, not passed; unit contracts still run. No live LLM, Dropi, Shopify, Ads, social, or n8n credential is needed for controlled acceptance.

**Alternatives considered**: Treat `npm run build` as tests; use live platform calls for smoke. **Rationale**: Neither proves deterministic protocol/isolation behavior, and live calls would make the bounded slice unsafe or flaky. `strict_tdd: false` is the current project context, but new focused tests are required before claiming this change verified.

## Data Flow

```text
Authenticated browser
  → dashboard /api/chat (NextAuth; server-owned tenant; request ID)
  → orchestrator /chat (internal credential + tenant binding)
  → controlled allowlist + LLM provider (at most 6 turns / 8 calls)
  → product /tools/search_dropi_catalog or /tools/score_product (internal credential)
  → PostgreSQL products / evaluations (tenant-scoped) + agent_logs (attributed outcome)
  → dashboard /api/pipeline (NextAuth; tenant-scoped SELECT only)
  → pipeline board / tenant-scoped detail
```

Failure branches stop at the first untrusted tenant, malformed provider batch, forbidden tool, exhausted budget, invalid product identity, failed source, failed persistence, or failed audit. A partial write is reported as partial; no external mutation-capable tool is called. The controlled smoke substitutes provider/catalog/transport dependencies and asserts that forbidden transports receive zero calls.

## File Changes

| File | Action | Description |
|---|---|---|
| `dashboard/src/lib/auth.ts`, `dashboard/src/lib/db.ts` | Modify | Centralize authenticated single-admin tenant resolution; keep tenant mapping server-owned. |
| `dashboard/src/app/api/chat/route.ts`, `dashboard/src/lib/orchestratorClient.ts` | Modify | Validate request, attach request ID and internal credential, omit caller tenant authority, preserve non-success outcomes. |
| `dashboard/src/app/api/pipeline/route.ts`, `dashboard/src/components/PipelineBoard.tsx`, `dashboard/src/components/ProductCard.tsx` | Modify | Authenticated tenant-scoped schema-compatible read and honest incomplete/evidence display. |
| `dashboard/src/app/products/[id]/page.tsx` | Modify | Tenant-scope the detail link and all related reads. |
| `orchestrator/src/index.ts`, `orchestrator/src/routes/chat.ts` | Modify | Internal auth, trusted tenant binding, bounded allowlisted dispatcher and fail-closed outcomes. |
| `orchestrator/src/llm/client.ts`, `orchestrator/src/mcp/registry.ts`, `orchestrator/src/mcp/client.ts` | Modify | Preserve raw tool-call transcript, static capability filter, authenticated product transport. |
| `orchestrator/src/db/pool.ts` | Modify | Bounded attributable success/failure audit metadata and sanitization. |
| `subagent-producto/src/server.ts`, `subagent-producto/src/tools/searchDropiCatalog.ts`, `subagent-producto/src/tools/scoreProduct.ts` | Modify | Authenticated tool entry, tenant validation, atomic identity upsert, evidence-aware scoring without automatic Meta call. |
| `subagent-producto/src/scrapers/dropiCatalog.ts` | Modify | Stable source-native identifier/URL extraction, explicit invalid-result failure. |
| `db/migrations/002_discovery_evidence.sql` | Create | Add `evaluations.evidence` and tenant/source/external-ID uniqueness after duplicate preflight. |
| `docker-compose.yml`, `.env.example` | Modify | Internal-only orchestrator route and distinct configured service credentials; document deployment inputs. |
| `orchestrator/package.json`, `subagent-producto/package.json`, `dashboard/package.json` and corresponding lockfiles | Modify | Add `tsx` development dependency and exact `test:contract` scripts; orchestrator also receives `smoke:discovery`. |
| `orchestrator/tests/chat.contract.test.ts`, `subagent-producto/tests/discovery.contract.test.ts`, `dashboard/tests/pipeline.contract.test.ts` | Create | Controlled tenant, transcript, identity, evidence, query, and failure contracts. |
| `orchestrator/scripts/smoke-discovery.ts`, `dashboard/src/lib/pipelineQuery.ts` | Create | Controlled cross-service smoke command and reusable tenant-scoped query without a Next route dependency. |

No external publishing or automation file is changed in this slice. Existing unrelated unsafe endpoints are not validated as production-safe by this design.

## Interfaces / Contracts

```ts
type Evidence<T> =
  | { status: 'observed'; value: T; source: string; observed_at: string }
  | { status: 'estimated'; value: T; source: string; reason: string }
  | { status: 'unavailable'; value: null; source: string; reason: string };

type EvaluationEvidence = {
  catalog_price: Evidence<number>;
  demand: Evidence<number>;
  competition: Evidence<number>;
  margin: Evidence<number>;
  shipping: Evidence<number>;
};

type DiscoveryOutcome =
  | { status: 'complete'; request_id: string; product_ids: string[]; evaluation_ids: string[] }
  | { status: 'partial'; request_id: string; product_ids: string[]; missing: string[] }
  | { status: 'failed'; request_id: string; code: string };
```

The provider adapter returns the assistant `tool_calls` in provider wire shape, including raw argument strings; parsed/validated objects are a separate dispatch representation. `score_product` accepts only a UUID `product_id`; trusted tenant/request context is injected server-side. `search_dropi_catalog` accepts bounded optional search/category strings; source rows must have a stable external ID and valid observed attributes. The internal token never appears in provider messages or database audit JSON. HTTP 401/403 rejects untrusted context; 400/422 rejects malformed input/provider calls; 502/503 denotes tool/source/provider failure; 500 denotes database/audit failure. Exact response codes can follow the existing Express/Next route conventions, but error bodies must carry a safe stable code and request ID where trusted.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Orchestrator unit/contract | Missing/spoofed tenant, invalid token, allowed/forbidden tool, malformed JSON, duplicate/unmatched IDs, exact assistant/result transcript, turn/call limits, failure/partial audit, secret redaction | `node:test` with injected LLM/tool/audit fakes; assert zero forbidden dispatches and no later provider turn after invalid linkage. |
| Product unit/contract | Stable Dropi ID extraction, observed price with source URL/timestamp, invalid price as unavailable (never zero), repeated concurrent discovery, tenant-separated upsert, missing evidence, no implicit Meta call, tenant-scoped scoring | Controlled catalog rows and database adapter; PostgreSQL integration for unique-index/race semantics. |
| Dashboard route/query | Session required, spoofed tenant ignored/rejected, declared SQL columns, cross-tenant related-record isolation, observed/estimated/unavailable price provenance through product→evaluation→pipeline, empty vs DB error, read-only behavior, incomplete/evidence rendering, detail-link isolation | Route/session fakes plus migrated disposable PostgreSQL for actual SQL compatibility. |
| Controlled smoke | Full chat→persist→pipeline journey, request/audit linkage, two tenants at service boundary, repeated identity, zero external mutations, explicit skipped-live report | Local controlled LLM/catalog fixtures and disposable DB; fail if any live credential or mutation transport is consulted. |
| Package builds | Relevant TypeScript/Next.js compilation | `npm run build --prefix orchestrator`, `npm run build --prefix subagent-producto`, `npm run build --prefix dashboard`; separately run each new package-local test command. |

Exact contract commands: `npm run test:contract --prefix orchestrator`, `npm run test:contract --prefix subagent-producto`, and `npm run test:contract --prefix dashboard`. Exact controlled smoke command: `npm run smoke:discovery --prefix orchestrator` with an explicitly supplied disposable `ALFA_SMOKE_DATABASE_URL`; no fallback to `DATABASE_URL` or live providers. `tsx` executes tests/scripts directly; the existing `tsc` and Next.js builds remain independent verification commands.

## Threat Matrix

The change alters HTTP tool routing and service integration, so the applicability check was performed. The reference matrix targets executable-file/VCS/PR command boundaries; none is implemented by this slice. Product tool-routing abuse is covered by the explicit orchestrator contract tests above, not by inventing file/commit tests.

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths (`requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh`) | N/A — no executable-file classification or path-to-command execution | No such execution surface exists in this change. | N/A |
| Git repository selection (`git -C`, relative/absolute paths) | N/A — no Git command runner in the product path | Delivery tooling is outside product design. | N/A |
| Commit state (staged, `commit -a`, empty index) | N/A — no commit automation | No index/worktree behavior added. | N/A |
| Push state (tracking branch, first push, explicit refspec) | N/A — no push automation | No remote VCS operation added. | N/A |
| PR commands (`--head`, environment prefix, composed commands) | N/A — no PR automation | No PR command composition added. | N/A |

## Migration / Rollout

1. Back up the database and inspect `products` for duplicate non-null `(tenant_id, source, external_id)` tuples. Do **not** automatically delete or merge existing rows; resolve duplicates with a recorded tenant-safe decision before applying uniqueness. Confirm deployed schema version rather than assuming `001_init.sql` was applied unchanged.
2. Add nullable `evaluations.evidence JSONB` and a partial unique index on `products(tenant_id, source, external_id) WHERE external_id IS NOT NULL` in `002_discovery_evidence.sql`. Existing evaluations remain readable as legacy/unknown evidence; never label them observed by default. Deploy schema before code that writes the new column.
3. Configure distinct nonempty dashboard→orchestrator and orchestrator→product credentials and the server-owned tenant UUID in environment/Compose; validate at startup. Deploy service protections and dashboard proxy together. Remove the public orchestrator Traefik route. Confirm any old direct n8n product-tool invocation now fails closed; repairing those workflows is later scope, not a reason to leave the route unprotected.
4. Run contract tests, migrated disposable-DB smoke, and the three package builds. Enable live read-only catalog use only after stable source IDs can be confirmed from the actual account/DOM. Do not claim live credentials, selectors, networking, or platform API reliability from controlled smoke.

Rollback is code-first: stop the new discovery entry point and revert dashboard/orchestrator/product services together. Retain the additive column/index during a compatibility window; old code ignores them. A reverse migration may drop the index and column only after backup and after confirming no new evidence consumers depend on it; it must not delete product/evaluation rows. Reinstating a public orchestrator route or unguarded product tools is **not** a safe rollback and requires separate security authorization.

## Open Questions

No blocking product decision remains for the controlled slice. Before a **live** catalog acceptance claim, verify Dropi's actual stable identifier/DOM and credentials against the deployed account; if no stable ID exists, keep that live path disabled and report it blocked. Before deployment, verify existing duplicate rows and the real database migration state. These are evidence gates, not permission to fabricate identity or modify out-of-scope providers.
