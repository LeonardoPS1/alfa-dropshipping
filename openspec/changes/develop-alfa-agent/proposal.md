# Proposal: Safe Product Discovery Vertical Slice

## Intent

Make one ALFA journey demonstrably safe and observable: a tenant-bound chat request discovers products, evaluates their evidence, and exposes the resulting pipeline state on the dashboard. Existing service code is not proof that this journey works; the current chat tool-call transcript, product identity, tenant boundary, and pipeline query have known gaps.

## Scope

### In Scope
- Correct the orchestrator's bounded tool-call loop, including assistant/tool-call linkage, validated tool inputs, explicit failure handling, and audit records for chat-mediated actions.
- Bind requests and product data to a trusted tenant context; reject an untrusted or missing tenant rather than accepting a caller-supplied tenant identifier as authority. Restrict this slice to read-only external product discovery and internal product/evaluation persistence.
- Make discovered product identity stable across repeated searches. Record the provenance and availability of evaluation inputs, and do not present estimated shipping or heuristic demand as observed facts.
- Repair the dashboard pipeline read against the declared PostgreSQL schema so a tenant can observe discovered and evaluated products without cross-tenant leakage.
- Introduce project-local automated contract tests and a controlled-provider smoke path for this journey. The repository currently has no test suite or workspace test command; `strict_tdd: false` remains the documented starting state, not a claim that tests already exist.

### Out of Scope
- External publishing, live Shopify writes or order/inventory reconciliation, social posting, and paid campaign creation or optimization.
- Creative generation, image generation, n8n optimization or workflow repair, and automated campaign pauses. Existing unsafe paths must not be exercised by this slice; hardening them belongs to later changes.
- Full production deployment acceptance, live platform credential verification, and all RFU-01–RFU-12 future aspirations.
- A claim of end-to-end SRD completion. This is the first reviewable vertical slice of a larger roadmap.

## Capabilities

### New Capabilities
- `safe-chat-orchestration`: Tenant-bound chat requests preserve valid tool-call transcripts, enforce a bounded/allowlisted discovery flow, fail closed, and produce attributable audit records.
- `product-discovery-evaluation`: Read-only discovery yields stable per-source product identity and tenant-safe internal persistence; evaluation distinguishes observed evidence from estimates or unavailable inputs.
- `pipeline-observation`: A tenant-scoped dashboard read displays persisted product/evaluation state using columns that exist in the declared schema.
- `discovery-smoke-verification`: Deterministic tests and a controlled-provider smoke journey verify the chat-to-pipeline contract without live platform mutations.

### Modified Capabilities
None. `openspec/specs/` contains no existing capability specs to modify.

## Approach

Keep the existing dashboard → orchestrator → product subagent → PostgreSQL boundaries. Define the tenant, tool-response, product-identity, scoring-evidence, and pipeline-read contracts in specs before changing code. Implement the smallest end-to-end path with controlled provider responses and read-only catalog access; block or exclude mutation-capable tools from this journey. Verify repeated discovery, missing evidence, audit continuity, tenant isolation, and dashboard readback before considering later service integrations.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `orchestrator/src/routes/chat.ts`, `orchestrator/src/llm/`, `orchestrator/src/db/` | Modified | Tenant boundary, transcript/tool contract, and audit behavior. |
| `subagent-producto/src/scrapers/`, `subagent-producto/src/tools/`, `subagent-producto/src/server.ts` | Modified | Stable source identity, evidence-aware evaluation, and tenant-safe writes. |
| `dashboard/src/app/api/pipeline/route.ts` | Modified | Schema-compatible, tenant-scoped pipeline observation. |
| `db/migrations/` | Possible modification | Additive constraints or indexes only if needed for stable tenant-scoped identity; preserve existing data. |
| `orchestrator/`, `subagent-producto/`, `dashboard/` test and package configuration | New/Modified | Focused tests and smoke command for the slice; exact framework and commands belong in design. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A caller can spoof `tenant_id`, exposing or mixing product data. | High | Establish trusted server-side tenant binding and negative isolation tests before enabling the flow. |
| Catalog data is unstable or unavailable; current IDs and shipping/demand values can be misleading. | High | Use stable source keys, explicit provenance/missing-data states, and controlled fixtures; do not claim live-source reliability from smoke tests. |
| Tool loops can dispatch unintended actions or lose audit linkage. | Medium | Allowlist discovery/evaluation tools, validate calls, retain protocol linkage, and test failure paths. |
| Database identity constraints can conflict with existing rows. | Medium | Inspect duplicates before an additive migration; stage and validate the migration with rollback instructions. |
| Live credentials, platform APIs, and network exposure remain unverified. | High | Keep external writes off and report production readiness as unverified. |

## Rollback Plan

Revert this slice's orchestrator, product, and dashboard changes together; disable the new discovery entry point before rollback if deployed. Restore prior package test configuration only if needed. Any new database migration must be additive and have a documented reverse migration or a safe compatibility period; back up and inspect existing product rows before changing uniqueness rules. Internal products created by the slice remain tenant-scoped and must not be silently deleted. No external posts, Shopify mutations, or campaign spend should need reversal because they are excluded.

## Dependencies

- The existing PostgreSQL schema and dashboard/orchestrator/product service contracts; design must confirm the concrete trusted tenant mechanism and migration strategy before implementation.
- Controlled LLM/tool and catalog fixtures for repeatable tests; live platform credentials are not required for acceptance.
- A repository root and delivery baseline must be established before any branch, commit, or PR operation; the workspace root was not a Git repository during exploration.

## Success Criteria

- [ ] A controlled chat request completes discovery and evaluation, preserves valid assistant/tool-call linkage, and yields an auditable product record visible through the pipeline read.
- [ ] Missing or spoofed tenant context is rejected; tests demonstrate that tenant A cannot read or mutate tenant B's products through this journey.
- [ ] Repeating the same catalog result for one tenant resolves to the same source identity without duplicate product records.
- [ ] Evaluation output labels observed, estimated, and unavailable inputs accurately; absent shipping or demand evidence is not represented as observed.
- [ ] The pipeline endpoint executes against the declared schema and returns only the requesting tenant's persisted state.
- [ ] Focused automated tests and a controlled-provider smoke command pass, and relevant package builds pass. Results identify any skipped live integrations explicitly.
- [ ] The smoke path performs no publishing, Shopify writes, paid campaign actions, or n8n optimization.
