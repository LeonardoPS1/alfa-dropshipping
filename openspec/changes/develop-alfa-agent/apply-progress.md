# Apply Progress: Safe Product Discovery Vertical Slice

## Session and mode

- Change: `develop-alfa-agent`
- Batch: PR 1 work unit only; previous apply progress was absent.
- Mode: Standard (`strict_tdd: false` per `openspec/config.yaml` and native status). The loaded TDD skill was applied to new behavior; do not describe the project as Strict TDD.
- Delivery: `auto-chain`, `feature-branch-chain`; intended PR 1 base is the feature/tracker branch.
- Repository limitation: `D:\Codex` has no `.git` root and no nested repository. No repository was initialized; no branch, commit, push, or PR was created.

## Completed tasks

- [x] 1.1 — Added the product package `test:contract` script and `tsx` dev dependency; npm updated its package lock. The exact product contract command executed.
- [x] 1.3 — Added product contract tests and a local-only PostgreSQL concurrency/integration harness. The local PostgreSQL case is present but skipped because no `LOCAL_TEST_DATABASE_URL` exists.
- [x] 2.1 — Added stable Dropi detail-URL/source-ID validation and nullable observed-price parsing. Missing or malformed prices are unavailable, not zero.
- [x] 2.3 — Added evidence-aware scoring, tenant-scoped product ownership checks, persisted evaluation evidence, nullable component/total scores when inputs are missing, and no transitive Ads/TikTok calls.

## Incomplete assigned tasks

- [ ] 1.5 — Not performed: deployed schema inspection, backup, duplicate resolution, or deployed DB probing were not authorized. No remote database/session/credential was used. A local disposable database was also unavailable.
- [ ] 1.6 — Migration `db/migrations/002_discovery_evidence.sql` is authored and documents the reverse boundary, but forward/reverse execution against a disposable PostgreSQL database was unavailable; do not claim the migration is runtime-verified.
- [ ] 2.2 — The server discovery/score entry points now require `ORCHESTRATOR_PRODUCT_TOKEN` plus trusted tenant and request-ID headers, and persistence uses atomic tenant/source/external-ID upsert. Contract coverage verifies tool-level input rejection and upsert SQL shape, but the HTTP auth boundary and PostgreSQL behavior were not exercised; keep pending for focused endpoint/runtime validation.
- [ ] 2.4 — Focused contract tests and build passed; required concurrent PostgreSQL upsert/tenant-isolation integration was skipped because no local disposable PostgreSQL runtime is available.

## TDD and verification evidence

| Check | Command / observed outcome |
|---|---|
| RED | Before production changes, `npm run test:contract --prefix subagent-producto` ran 7 cases: 6 failed against missing expected product helpers and 1 local DB case skipped. The first attempt before installing the declared runner only failed because the script was absent; it is not counted as RED evidence. |
| RED-GREEN regression | Added a malformed-price assertion; it failed because `$ 12.990 estimated` was parsed as `12990`. Tightened parsing; the final suite passed. |
| Focused contracts | `NODE_OPTIONS=--require=D:\Codex\.test-node-os-preload.cjs npm run test:contract --prefix subagent-producto` — exit 0; 8 tests, 7 passed, 0 failed, 1 skipped (PostgreSQL-only). |
| Build | `NODE_OPTIONS=--require=D:\Codex\.test-node-os-preload.cjs npm run build --prefix subagent-producto` — exit 0 (`tsc -p tsconfig.json`). |
| PostgreSQL migration/integration | Not run: no `LOCAL_TEST_DATABASE_URL`; no `psql`, `pg_isready`, or Docker executable was found. Remote access remained prohibited. |
| Runtime detail | The exact npm scripts require a temporary Node preload because this sandbox's `node:os.userInfo()` fails with `uv_os_get_passwd returned ENOMEM` inside `tsx`. The preload only supplies a local test username/home path; the preload files are not part of the deliverable. Runtime was Node 26.8.2, not design-target Node 20. |

## Files changed

| File | Change |
|---|---|
| `subagent-producto/package.json` | Added `test:contract` and `tsx` dev dependency. |
| `subagent-producto/package-lock.json` | Updated matching package lock via npm install. |
| `subagent-producto/tests/discovery.contract.test.ts` | Added deterministic identity, price, evidence, ownership, tenant isolation, and no-Ads regression contracts. |
| `subagent-producto/tests/helpers/postgres-discovery.integration.ts` | Added loopback-and-disposable-database-guarded migration/concurrent-upsert integration harness. |
| `subagent-producto/src/scrapers/dropiCatalog.ts` | Rejects missing/unstable product identities; canonicalizes product URLs; validates nullable observed price. |
| `subagent-producto/src/tools/searchDropiCatalog.ts` | Adds input validation, structured discovery provenance, injectable test seams, and atomic `ON CONFLICT ... RETURNING id` tenant-scoped upsert. |
| `subagent-producto/src/tools/scoreProduct.ts` | Adds ownership-scoped reads, nullable evidence-based scoring, evidence persistence, and removes automatic Ads lookup. |
| `subagent-producto/src/server.ts` | Protects discovery/score routes with constant-time internal-token check and trusted tenant/request headers. |
| `db/migrations/002_discovery_evidence.sql` | Adds nullable `evaluations.evidence` and the partial tenant/source/external-ID unique index; includes manual rollback notes. |
| `openspec/changes/develop-alfa-agent/tasks.md` | Checked only tasks 1.1, 1.3, 2.1, and 2.3; left all runtime-blocked work unchecked. |

## Work-unit evidence and boundary

- Intended PR #1: additive data/evidence migration plus product identity/evidence service changes, based on the feature/tracker branch; later PRs remain outside this batch.
- Focused tests/build: pass as recorded above; database runtime integration: skipped/blocked, not passed.
- Rollback: revert the PR-1 product package/service/test changes together. If the migration is later applied, retain the additive evidence column and unique index until consumers are removed; only reverse after backup and explicit evidence-retention review. Never delete product/evaluation rows.
- Review budget: Git diff/stat is unavailable because there is no Git repository. Approximate authored scope is 500–800 changed lines including tests and generated lockfile changes; this is not a measured additions-plus-deletions count. The feature-branch chain remains the appropriate boundary; no size exception was requested.

## Risks and next steps

- Dropi's live DOM selectors and product URL pattern remain unverified; no live Dropi credentials or remote access were used.
- `ORCHESTRATOR_PRODUCT_TOKEN` deployment configuration belongs to a later slice; discovery/score endpoints fail closed when the token is unset.
- Run task 1.5 only after the user authorizes the exact deployed database destination/session and preflight operation; then apply and reverse-test the migration on an explicitly local disposable DB before claiming task 1.6 or 2.4 complete.
- Re-run focused endpoint-auth tests and PostgreSQL integration before marking task 2.2 or 2.4 complete.

## Corrective rerun: bounded environment and runtime recheck

- Refreshed native status: `applyState: ready`, `taskProgress: total=27, completed=4, pending=23`; native locators resolve to this OpenSpec change, including this apply-progress file.
- Re-read the prior full Engram apply-progress observation (ID 16) and merged this follow-up without replacing prior evidence or completed-task state.
- Bounded local PostgreSQL audit found `LOCAL_TEST_DATABASE_URL` and `DATABASE_URL` absent, no `psql`, `pg_isready`, or Docker command, no local postgres process, and no PostgreSQL service. No remote endpoint was probed.
- Local HTTP check: with product token configuration absent, `POST /tools/search_dropi_catalog` to a loopback-only service returned **401** before DB access. This verifies the fail-closed missing-configuration path only; it does not prove the configured-token path or database persistence.
- Parent spot-check rerun: product contracts exited 0 (8 total, 7 passed, 0 failed, 1 PostgreSQL case skipped); product build exited 0. Temporary OS preload was removed after the run.
- No tasks were checked during this rerun. Tasks 1.5, 1.6, 2.2, and 2.4 remain pending: deployed-schema inspection is unauthorized remotely, and required real-PostgreSQL checks cannot run without a local disposable instance. No credentials were invented or used.
- Stop after this single corrective rerun; do not advance to PR 2 or retry the unavailable database path again without an environment/user-state change.

## PR 1 evidence update — 2026-09-27

This is a cumulative update to the earlier apply record and corrective rerun above; historical results are retained as historical evidence, not rewritten as if they happened now.

### Current cumulative task state

- [x] 1.1 — Product `test:contract` script and `tsx` dependency/lockfile are present.
- [x] 1.3 — Product contract suite and guarded PostgreSQL integration harness are present.
- [ ] 1.5 — Remains pending. The deployed ALFA schema/version and production ALFA backup were not verified. A disposable database duplicate preflight is not a substitute for this acceptance criterion.
- [x] 1.6 — Migration 002 forward application, schema/index verification, rollback, and re-application were reported on a disposable PostgreSQL database.
- [x] 2.1 — Stable source identity and nullable observed-price handling are implemented.
- [ ] 2.2 — Remains pending. The configured-token HTTP path and full trusted-context request behavior were not proven; the earlier loopback 401 only proved fail-closed behavior with missing configuration.
- [x] 2.3 — Evidence-aware scoring and tenant-owned persistence are implemented.
- [x] 2.4 — Product contracts/build and real PostgreSQL concurrent identity-race/tenant-isolation scenario are evidenced below.

### New database/runtime evidence

- Parent-reported authorized disposable PostgreSQL session: SSH host fingerprint was verified and PostgreSQL version was 17.9. No secrets or credentials are recorded here.
- A disposable database and role were created on that instance; migration 001 was applied; duplicate preflight returned zero groups; migration 002 was applied and its nullable evidence column and partial unique index verified; migration 002 rollback was verified and then re-applied.
- Parent-reported `npm run test:contract --prefix subagent-producto` result: 8/8 passed, including the real concurrent partial-unique-index race through an SSH tunnel. The disposable database and role were removed afterward.
- No production ALFA database backup or configured-token HTTP success is claimed. The existing shared/mixed n8n database is not an ALFA migration target; deployment requires a separate ALFA database on the same PostgreSQL instance.

### Fresh local verification in this update

| Check | Command / observed outcome |
|---|---|
| Initial exact contract attempt | `npm run test:contract --prefix subagent-producto` — exit 1 before test execution because Node 26.8.2 `tsx` failed in `node:os.userInfo()` with `uv_os_get_passwd returned ENOMEM`; PowerShell also emitted an access warning from its npm shim. This is an environment failure, not a test assertion failure. |
| Focused contract suite | `npm.cmd run test:contract --prefix subagent-producto` with a temporary `$TEMP` Node preload for `os.userInfo` — exit 0; 8 tests, 7 passed, 0 failed, 1 local-PostgreSQL test skipped because no local `LOCAL_TEST_DATABASE_URL` was configured. The parent-reported remote-tunnel integration above is separate evidence. |
| Build | `npm.cmd run build --prefix subagent-producto` with the same temporary preload — exit 0 (`tsc -p tsconfig.json`). |
| Temporary harness cleanup | The temporary preload was removed in `finally`; no preload/workaround file is part of the repository. |
| Remote Git refs | `git ls-remote --heads origin main feat/alfa-agent feat/alfa-agent-pr1-db-verification` failed because this environment could not connect to `github.com:443`. Remote branch existence and pushes therefore remain unverified/blocked. |

### Updated work-unit and delivery evidence

- PR 1 slice remains additive schema/evidence plus product identity/scoring behavior. Intended base: tracker branch `feat/alfa-agent`; work branch: `feat/alfa-agent-pr1-db-verification`. Both branches were created locally from the clean local `main` commit `0af69834be52c307113b72991fee6568e1d8d197` after the remote-ref check failed. No PR was opened.
- Rollback boundary: revert only the PR1 product service/scraper/scoring, migration/test harness and PR1 task/status evidence changes. If migration 002 is applied in a real ALFA DB later, stop discovery writers first, retain additive schema during compatibility, and reverse only after backup and evidence-consumer review; never delete product/evaluation rows.
- Review line count: `git diff --numstat feat/alfa-agent...feat/alfa-agent-pr1-db-verification` measured 62 additions and 16 deletions (78 changed lines) for this evidence/docs/task work unit, within the 400-line budget. This is not a count of the earlier bootstrap commit's already-present implementation.

### Still pending / out of scope

- Task 1.5: production ALFA schema/backup/duplicate preflight; disposable preflight evidence alone does not satisfy the deployed-schema and backup portions.
- Task 2.2: configured-token HTTP/authenticated request proof. Do not infer it from implementation or the missing-token 401.
- Tasks 1.2, 1.4, 1.7–1.8 and all Phase 3–5 tasks remain outside PR1.
- Remote branch existence/push are blocked: the ref query and subsequent normal (non-force) push of both refs each failed with a connection error to `github.com:443`. Do not claim remote delivery.

## PR 1 task 2.2 — injected HTTP contract verification — 2026-09-27

This follow-up continues the same PR1 work branch and preserves all prior task evidence above.

### Task outcome

- [x] 2.2 — Added an Express app factory with an injectable discovery search dependency. Production startup still calls the factory with no dependencies, so it uses the real `searchDropiCatalog` helper. There is no test-only environment flag or unauthenticated bypass.
- Route contracts exercise missing and incorrect internal tokens (401), valid token plus trusted tenant/request UUID context (200 and exact trusted context forwarded), invalid tenant/request UUIDs (400), and a body-tenant mismatch (400). Rejected requests assert the injected search function is never called.
- Auth retains the existing length check and `timingSafeEqual` comparison; the existing route response/error behavior is preserved.
- The test factory injects a fake search function; no live Dropi request or external source call is made.

### TDD and verification evidence

| Check | Command / observed outcome |
|---|---|
| RED | Added `tests/server.contract.test.ts` before production changes. `npm.cmd run test:contract --prefix subagent-producto` with a temporary Node preload exited 1: 5 new HTTP contract tests failed at an assertion that the server must export an injectable Express factory; existing product contracts passed and the local PostgreSQL case skipped. This was a real assertion failure, not a missing-script/dependency failure. |
| GREEN | Same product contract command with temporary `$TEMP` preload: exit 0; 13 tests total, 12 passed, 0 failed, 1 local PostgreSQL test skipped. The five HTTP route tests passed, including zero injected-search calls for rejected requests. |
| Build | `npm.cmd run build --prefix subagent-producto` with the same temporary `os.userInfo` preload: exit 0 (`tsc -p tsconfig.json`). |
| Runtime isolation | HTTP tests used ephemeral loopback Express servers and an injected fake. No local database or live Dropi credentials/calls were used. The pre-existing parent-reported disposable PostgreSQL race evidence remains separate. |
| Cleanup | Temporary preload and test servers were removed/closed; no workaround file was added to the repository. |

### Current cumulative PR 1 task state

- [x] 1.1, 1.3, 1.6, 2.1, 2.2, 2.3, 2.4.
- [ ] 1.5 remains pending: production ALFA schema/version and backup were not verified; disposable preflight does not replace these criteria.
- Tasks 1.2, 1.4, 1.7–1.8 and all Phase 3–5 tasks remain outside this PR1 unit.

### Files changed in this follow-up

| File | Change |
|---|---|
| `subagent-producto/src/server.ts` | Exported `createProductApp`; dependency injection for discovery search; production startup retains real helper default and only listens when run as main module. |
| `subagent-producto/tests/server.contract.test.ts` | Added route-level HTTP auth/context tests with a fake search dependency. |
| `openspec/changes/develop-alfa-agent/tasks.md` | Marked only task 2.2 complete after the HTTP seam and existing atomic-upsert evidence were verified. |
| `docs/implementation-status.md` | Updated current 2.2 status while preserving task 1.5 as pending. |

### Work-unit boundary

- Current branch: `feat/alfa-agent-pr1-db-verification`; intended PR1 base remains tracker `feat/alfa-agent`. No PR was opened.
- Rollback: revert the server app-factory seam and its route tests together with the 2.2 status update; retain the earlier PR1 schema changes and previously completed task evidence.
- Push only the child ref as requested. Remote access has already failed in this environment; do not retry if the same network failure persists.

## PR 1 task 2.2 evidence and current state — 2026-09-27

### Current cumulative task state

- [x] 1.1, 1.3, 1.6, 2.1, 2.2, 2.3, 2.4.
- [ ] 1.5 remains pending: deployed ALFA schema/version and production backup are not evidenced; disposable duplicate preflight is not a substitute.
- Tasks 1.2, 1.4, 1.7–1.8 and all Phase 3–5 work remain out of this PR1 unit.

### Route-level auth/runtime proof

- RED before production edits: the five new route tests failed with assertion `server must export an injectable Express app factory`; seven existing runnable product contracts passed and the local PostgreSQL case skipped. This exposed the missing testable app boundary, not a missing script/dependency.
- GREEN: `npm.cmd run test:contract --prefix subagent-producto` with a temporary `$TEMP` `os.userInfo` preload — exit 0; 14 tests total, 13 passed, 0 failed, 1 local database test skipped.
- GREEN routes: missing token 401; wrong token 401; valid token/trusted tenant/request UUID 200 and exact trusted context reaches injected search; invalid tenant or request UUID 400; mismatched body tenant 400. Every rejected request asserted injected search call count zero.
- App module import does not bind a port; each HTTP test runs on an ephemeral loopback Express server and closes it. No live Dropi request, credential, or external source call was used.
- Existing `npm.cmd run build --prefix subagent-producto` with the same preload — exit 0 (`tsc -p tsconfig.json`). Temporary preload was deleted after verification.
- Production `start`/`dev` entry still creates the app without dependencies, so the default real `searchDropiCatalog` helper is retained; no environment flag or public unauthenticated path was introduced. Token length checks and `timingSafeEqual` remain in the request middleware.
- Task 2.2 acceptance combines these route contracts with the previously recorded source-level atomic upsert contracts and parent-reported PostgreSQL concurrency evidence. It does not claim a configured-token call against live Dropi or production DB.

### Files changed in the 2.2 follow-up

| File | Change |
|---|---|
| `subagent-producto/src/server.ts` | Added exported Express app factory and search dependency injection; preserved real-search default and production listen behavior. |
| `subagent-producto/tests/server.contract.test.ts` | Added HTTP auth/context contracts and rejected-request zero-call assertions with a fake dependency. |
| `openspec/changes/develop-alfa-agent/tasks.md` | Marked task 2.2 complete after observed route and persistence evidence. |
| `docs/implementation-status.md` | Updated current task status; task 1.5 remains pending. |

### Rollback boundary

- Revert the factory/dependency seam and its server contract tests together with task 2.2 status edits. Keep unrelated earlier PR1 migration/product behavior and tasks intact.

## PR 1 task 1.5 database preflight evidence — 2026-09-27

This is a cumulative update; all prior evidence and historical blockers above are retained as historical snapshots.

### Task outcome

- [x] 1.5 — The authorized PostgreSQL 17.9 target was inspected before schema rollout. No pre-existing `alfa*` database or role was found. A separate `alfa_db` and least-privilege login role `alfa_app` were created; the shared/mixed `n8n` database was not used for ALFA migrations.
- Before migrations, a custom-format backup was created at `/home/ubuntu/alfa-backups/alfa_db-pre-migration-20260927T181318Z.dump` (836 bytes). Its `pg_restore` catalog was validated, then it was successfully restored into a disposable restore database that was subsequently removed.
- Migration 001 was applied. Before the uniqueness rollout, the duplicate non-null `(tenant_id, source, external_id)` preflight returned zero groups; no duplicate resolution, deletion, or merge was needed. Migration 002 was then applied.
- A post-migration custom-format backup at `/home/ubuntu/alfa-backups/alfa_db-post-migration-20260927T181318Z.dump` (24303 bytes) was created and catalog-verified.
- Generated credentials were stored only in Dokploy application environment variables `ALFA_DATABASE_NAME`, `ALFA_DATABASE_USER`, and `ALFA_DATABASE_PASSWORD`; secret values are intentionally not recorded or committed.
- Scope limitation: no backup of pre-existing production ALFA data is claimed, because no prior ALFA database was found. This preflight is not application deployment or deploy-readiness evidence. PostgreSQL/PgBouncer are host-published and accessible only on the Compose bridge; stable private overlay connectivity remains unresolved. No `DATABASE_URL` or deployment success is claimed.

### Current cumulative task state

- [x] 1.1, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4 — eight of 27 total tasks complete.
- [ ] 1.2, 1.4, 1.7, 1.8, Phase 3–5 — outside the PR 1 slice and remain unchecked.

### Verification and work-unit evidence

| Evidence | Result |
|---|---|
| Focused product contracts/build | No rerun needed for this evidence-only task update; latest recorded contracts/build remain 14 total, 13 passed, 0 failed, 1 local PostgreSQL case skipped, and build exit 0. The parent separately observed the authorized PostgreSQL 17.9 database operations above. |
| Database preflight/runtime | Parent-observed target version 17.9; no prior ALFA DB/role; pre-migration backup restore-validated; duplicate preflight returned 0 groups before migration 002; post-migration backup catalog-verified. Disposable restore DB removed. |
| Rollback boundary | Revert only the task 1.5 checkbox and its evidence/status documentation in `tasks.md`, this file, and `docs/implementation-status.md`. Do not drop the dedicated DB or role or remove migrations through this documentation-only change. |

### PR 1 delivery boundary

- Work remains on `feat/alfa-agent-pr1-db-verification`; intended PR 1 base is `feat/alfa-agent`. No PR 2 work is included. This update does not claim remote push or application deployment.
- Local `git diff --numstat` for this update recorded 39 additions and 8 deletions (47 changed lines); prior work units are excluded from this evidence count.

## PR 2D — bounded audit hardening and final PR2 proof — 2026-09-28

This is a read-merged continuation of the cumulative apply record above and the prior PR2 apply evidence. Historical PR1 evidence remains intact. PR2 is the authenticated, bounded orchestration/audit slice only; PR3, private networking, Dokploy configuration, deployment, and live external calls are not part of this work unit.

### Cumulative task state

- [x] PR1 tasks: 1.1, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4.
- [x] PR2 tasks: 1.2, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5.
- Total: 15/27 complete. Still pending: 1.4, 1.8, Phase 4 tasks 4.1–4.5, and Phase 5 tasks 5.1–5.5.

### PR2 chain and prior evidence

- Local feature-branch chain: PR2A `641f687` → PR2B `b1129ae` → PR2C `104b8e9` → PR2D (this work unit), based on PR2C. The current branch is `feat/alfa-agent-pr2-audit`; no branch boundary was rewritten.
- PR2A–C implemented the static product-only tool allowlist and authenticated transport, trusted tenant/request context, provider transcript validation and bounded dispatch, audit linkage, and the offline route/transport contracts. Existing RED evidence and prior PR2 check results remain historical evidence; this apply did not claim to reproduce prior RED observations.
- PR2D adds bounded recursive audit sanitization (depth, key, array, and string limits), expands sensitive-key redaction to credentials/connection strings, sanitizes audit metadata, and records the partial outcome distinctly before halting provider continuation. The behavior matches the design's attributable, bounded, fail-closed audit contract.

### Fresh PR2D verification

The resolved mode is Standard (`strict_tdd: false` in `openspec/config.yaml`). No Strict TDD evidence is claimed. The exact orchestrator contract command was first run without a workaround and exited before test discovery because Node 26.8.2 `tsx` failed in `node:os.userInfo()` with `uv_os_get_passwd returned ENOMEM`. The following checks were then rerun with a temporary `$NODE_OPTIONS` preload at `D:\Codex\.test-node-os-preload.cjs`, outside the repository; the file and environment override were removed afterward.

| Check | Command / observed outcome |
|---|---|
| Initial environment attempt | `npm.cmd run test:contract --prefix orchestrator` — exit 1 before tests; Node 26.8.2 reported `uv_os_get_passwd returned ENOMEM`. |
| Orchestrator contracts | `npm.cmd run test:contract --prefix orchestrator` with the temporary preload — exit 0; 30 tests passed, 0 failed, 0 skipped. The tests cover bounded audit, sensitive-value redaction, partial failure, forbidden batch zero-dispatch, turn/call budgets, and loopback HTTP contracts. |
| Orchestrator build | `npm.cmd run build --prefix orchestrator` with the same preload — exit 0 (`tsc -p tsconfig.json`). |
| Product contracts | `npm.cmd run test:contract --prefix subagent-producto` with the same preload — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL-only test skipped because no local `LOCAL_TEST_DATABASE_URL` was configured. The skipped case is not a pass. |
| Product build | `npm.cmd run build --prefix subagent-producto` with the same preload — exit 0 (`tsc -p tsconfig.json`). |
| Candidate whitespace | `git diff --check` — exit 0 on the final candidate. |
| Runtime harness | The contract suite exercised the Express route on ephemeral loopback servers with injected provider/tool/audit dependencies; all 30 orchestrator cases passed. No live LLM, Dropi, n8n, database, Dokploy, or SSH operation was used. |

### PR2D work-unit evidence and rollback

- Focused check: orchestrator contract suite — 30/30 passed after the temporary environment workaround; both in-scope service builds and the product contracts also completed with the outcomes above.
- Rollback boundary: revert only the PR2D changes to `orchestrator/src/db/pool.ts`, `orchestrator/src/routes/chat.ts`, `orchestrator/tests/orchestration.contract.test.ts`, and the PR2D task/status evidence in this file, `tasks.md`, and `docs/implementation-status.md`. This leaves PR2A–C and PR1 boundaries intact.
- No generated lockfile is part of PR2D. After one honest slicing pass, the maintainer explicitly approved `size:exception`; do not minimize code, omit tests/docs, or alter the established A/B/C boundaries to fit 400 lines.
- Initial PR2D authored count before corrective rerun: 487 lines (456 additions + 31 deletions) against PR2C `104b8e9`; the final cumulative PR2D count is recorded in the corrective evidence below. No generated lockfile is included. This exceeds the default 400-line review budget; the explicit `size:exception` covers this cohesive bounded audit-hardening slice.
- No push, pull request, or deployment was performed. Parent handles remote delivery.

## PR2D corrective rerun — audit and evidence-boundary fixes — 2026-09-28

The automatic-mode gate identified three concrete defects and one stale artifact path. The worktree was clean at `f535c093ef017c11c18173bd1b2623fdc51c6289` before this correction; no earlier PR2 commits were amended, rebased, or reverted.

### Root causes and fixes

- A body tenant mismatch was rejected after authentication and trusted tenant/request-ID validation but returned before `recordFailure`; valid attributed rejections therefore had no audit event. It now records a bounded `protocol_failure` against only the validated header tenant and request ID, keeps returning 403 when recorded, fails closed with 500 if audit persistence fails, and never dispatches a provider or tool. Unauthenticated requests and invalid/untrusted tenant headers still return before audit.
- The audit sanitizer redacted credentials based on property names but retained credential-bearing URI userinfo and sensitive URI query values under ordinary property names. String sanitization now redacts URI credentials/query parameters before truncation.
- Sanitization bounded values and the number of object entries but copied arbitrarily long property names. Property names longer than 128 characters are now omitted in full rather than truncated into potentially colliding names; output remains deterministic and bounded.
- Task 1.2's obsolete chat-specific test-file reference was replaced with existing `orchestrator/tests/auth.contract.test.ts`, `orchestrator/tests/orchestration.contract.test.ts`, `orchestrator/tests/tools.contract.test.ts`, and `orchestrator/tests/transcript.contract.test.ts`; the design's affected-files row was corrected to match.

### RED → GREEN and required checks

| Check | Command / observed outcome |
|---|---|
| RED before production edits | `npm.cmd run test:contract --prefix orchestrator` with temporary Node preload — exit 1; 32 tests, 28 passed, 4 failed. The body-tenant mismatch nested case observed 0 audits instead of 1 (and its parent group failed); URI credential redaction retained the test sentinel; the million-character key made sanitized JSON exceed 1,024 characters. No sentinel value was emitted in the assertion message. |
| GREEN contracts | `npm.cmd run test:contract --prefix orchestrator` with temporary Node preload — exit 0; 32/32 passed, 0 skipped. The authenticated conflict is audited against trusted context, while missing/invalid credentials and untrusted tenant cases still produce zero audits and no dispatch. |
| Orchestrator build | `npm.cmd run build --prefix orchestrator` with temporary Node preload — exit 0 (`tsc -p tsconfig.json`). |
| Product contracts | `npm.cmd run test:contract --prefix subagent-producto` with temporary Node preload — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL-only test skipped because no `LOCAL_TEST_DATABASE_URL` was configured. The skipped case is not a pass. |
| Product build | `npm.cmd run build --prefix subagent-producto` with temporary Node preload — exit 0 (`tsc -p tsconfig.json`). |
| Whitespace | `git diff --check` — exit 0 on the final corrective candidate. |
| Environment cleanup | Node 26.8.2 initially required `os.userInfo()` preload to work around `uv_os_get_passwd returned ENOMEM`; temporary file and `NODE_OPTIONS` override were removed after checks. No live LLM, Dropi, n8n, database, Dokploy, SSH, or deployment operation was performed. |

### Corrected evidence and final boundary

- `tasks.md` task 1.2 now points only to existing contract files; the cumulative state remains 15/27.
- Corrective commit: recorded after verification. PR2D remains the work unit after PR2C `104b8e9`; the earlier PR2D commit is preserved as a parent of this corrective commit.
- Final cumulative PR2D authored additions plus deletions against PR2C `104b8e9`: **565 lines (531 additions + 34 deletions)**. No generated lockfile is included. The maintainer-approved `size:exception` remains in effect after the initial slicing pass.
- Rollback: revert the corrective commit to restore the prior PR2D candidate; reverting the PR2D work-unit commit as well returns to PR2C without disturbing PR2A–C or PR1.
- No push, pull request, PR3 work, private-network configuration, or deployment was performed.

## PR 3 — dashboard trust boundary and tenant-scoped pipeline — 2026-09-28

This is a read-merged continuation of the complete PR1/PR2 apply history above. The native dispatcher resolves this change to OpenSpec locators; the session had requested hybrid, and the Engram mirror uses `sdd/develop-alfa-agent/apply-progress`. This file and `tasks.md` are the OpenSpec artifacts. No prior section or historical evidence was replaced.

### Cumulative task state

- [x] PR1 and PR2 tasks: 15 tasks total.
- [x] PR3 tasks completed from observed implementation/contracts: 1.4, 1.8, 4.1, 4.2, and 4.3.
- [ ] PR3 tasks not yet proven complete: 4.4 and 4.5. The UI/detail source changes exist, but the required Next build could not start; the PostgreSQL runtime integration was skipped because no explicit local test URL is configured.
- [ ] PR4 tasks: 5.1–5.5 remain out of scope.
- Cumulative state: 20/27 complete; 7 tasks pending.

### PR3A backend/contracts boundary

- Base: PR2D final `1d988f7` on `feat/alfa-agent-pr3-dashboard`.
- Commit: `7ad957a` — `feat(dashboard): add tenant-bound chat and pipeline reads`.
- PR3A implements the dashboard-local `tsx --test` contract setup, centralized authenticated server tenant resolution, session-bound chat proxy with generated request ID and internal credential, schema-compatible tenant-scoped pipeline query, non-2xx read failures, evidence selection, detail query helper, and contract/guarded PostgreSQL tests.
- PR3A authored additions plus deletions: **691 lines**, excluding generated `dashboard/package-lock.json`. This is over the 400-line review budget after the one permitted backend/contracts-versus-UI split; no further slicing/code-golf was performed. Recommend `size:exception` for PR3A.

### PR3B UI/final-integration boundary

- Child branch: `feat/alfa-agent-pr3-dashboard-ui`, based directly on PR3A `7ad957a`; it contains the final dashboard board/card/detail integration and cumulative task/status documentation.
- No push, PR creation, external service access, deployment, Docker/Dokploy change, or production database access was performed.
- The UI displays source/source ID, evaluation ID/status, catalog-price status/provenance or unavailable, an explicit discovered/incomplete state, and persisted publication state only. The detail page and related-record helper constrain every read by trusted tenant. UI completion remains pending until a dashboard build can compile the final candidate.

### RED → GREEN and verification evidence

The documented project mode is Standard (`strict_tdd: false` in `openspec/config.yaml`); this does not claim project-wide Strict TDD. New behavior was test-first. The first contract attempt before adding production helpers failed during module loading because the expected `tenantContext` implementation did not exist yet; it did not reach test discovery. A focused later RED was observed for the new evidence-selection contract: `npm.cmd run test:contract --prefix dashboard` exited 1 with 14 tests, 12 passed, 1 assertion failed because `selectCatalogPriceEvidence` was missing, and 1 PostgreSQL case skipped. The implementation was then added and the final contract suite passed.

| Check | Command / observed outcome |
|---|---|
| Dashboard contracts (final) | `npm.cmd run test:contract --prefix dashboard` — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL scenario skipped. A test caught and fixed a pipeline status-column key mismatch before the final pass. |
| Build | `npm.cmd run build --prefix dashboard` — exit 1 before compilation because `next` is not installed (`"next" no se reconoce como un comando interno o externo`). |
| Dependency installation | `npm.cmd install --prefix dashboard --ignore-scripts` could not fetch `tsx` from `registry.npmjs.org` in the network-restricted environment (EACCES); the first offline lock-only attempt reported uncached package metadata. After adding the already-resolved `tsx` 4.19.2 dependency graph from the sibling package lock, `npm.cmd install --package-lock-only --offline --ignore-scripts --prefix dashboard` completed successfully (92 packages audited, 0 vulnerabilities). No registry access succeeded and dependencies were not installed. |
| Test runner workaround | Dashboard dependencies were absent. The successful contract run used the existing `subagent-producto/node_modules/.bin/tsx` via `PATH`, plus a temporary `$TEMP` preload overriding `node:os.userInfo()` because Node 26.8.2 otherwise failed in `tsx` with `uv_os_get_passwd returned ENOMEM`. Temporary preload/environment state was removed; neither workaround is committed. |
| Disposable PostgreSQL | Guarded A/B tenant-isolation scenario is present and uses only explicit `LOCAL_TEST_DATABASE_URL`, rejects non-loopback URLs before connecting, and never falls back to `DATABASE_URL`. It was skipped because the explicit local URL was unset. No production database was contacted. |
| Whitespace | `git diff --check` / staged `git diff --cached --check` passed for the checked PR3 candidates. |
| CodeGraph | `.codegraph/` was absent; the prescribed `gentle-ai codegraph init --cwd ...` attempt failed because the `codegraph` executable is unavailable. Normal file exploration followed only after this initialization attempt failed. |

### Work-unit evidence and rollback boundary

| Evidence | Result |
|---|---|
| Focused test | Dashboard contracts: 14 total, 13 passed, 0 failed, 1 PostgreSQL-only skip. |
| Runtime harness | A/B PostgreSQL pipeline/detail scenario added with explicit loopback test-only URL guard; runtime result is skipped/blocked due to no `LOCAL_TEST_DATABASE_URL`, not passed. |
| Build | Blocked before compilation because dashboard package dependencies/Next.js are absent and registry install was denied by the environment. |
| Rollback | Revert PR3B UI/detail integration (`dashboard/src/app/products/[id]/page.tsx`, `dashboard/src/components/PipelineBoard.tsx`, `dashboard/src/components/ProductCard.tsx`) with the PR3B evidence/task/status update. Revert PR3A commit `7ad957a` to remove the chat/pipeline routes, tenant/query helpers, dashboard contract harness, and package test setup together; this leaves PR2D `1d988f7` intact. Preserve additive migration 002 and its evidence during compatibility; do not delete product/evaluation rows. |

### Remaining work and risk

- Re-run `npm.cmd install` only when authorized registry access/package cache is available, then run the exact dashboard contract command and build. Do not treat the current build failure as a code compile result.
- Run the guarded A/B integration only after an explicit local disposable `LOCAL_TEST_DATABASE_URL` is provided and confirmed loopback/test-only.
- Complete task 4.4 only after UI compilation/behavior is verified; complete 4.5 only after contract/build checks and the database runtime case have the evidence required by the task.
- PR3B authored additions plus deletions: **237 lines**, excluding generated `dashboard/package-lock.json`; this is the measured 236-line final-candidate diff plus this evidence line and remains within 400.
## PR3 corrective rerun — dashboard completion

This append supersedes the earlier PR3 pending-task/build/database blocker status above without removing its historical record. It continues the feature-branch chain on `feat/alfa-agent-pr3-dashboard-ui`; PR3A `7ad957a` and PR3B `cd16462` were not rewritten.

### Cumulative task state

- [x] PR1 and PR2: 15 tasks.
- [x] PR3: 1.4, 1.8, and 4.1–4.5.
- [ ] PR4: 5.1–5.5 remain pending and out of scope.
- Cumulative state: **22/27 complete; only 5.1–5.5 pending.**

### Corrective evidence

- Parent-provided guarded disposable PostgreSQL 17.9 evidence: migrations 001/002 applied; duplicate preflight returned zero; migration 002 rollback and re-application passed; guarded contract command passed **14/14, 0 skipped**, including tenant A/B pipeline and detail isolation. The random disposable database and role were removed. Only `LOCAL_TEST_DATABASE_URL` aimed at a verified loopback tunnel was used; no production database or credential was persisted. A listener-shutdown WinError 10038 occurred only after the tests passed; cleanup succeeded.
- Local `npm.cmd run test:contract --prefix dashboard`: **14 total, 13 passed, 0 failed, 1 skipped** (local PostgreSQL URL absent). It passed with a temporary `$TEMP` `node:os.userInfo()` preload because Node 26.8.2 otherwise fails inside `tsx` with `uv_os_get_passwd returned ENOMEM`; the preload was removed. This local skip is separate from, and does not negate, the parent-reported 14/14 disposable-DB run.
- `npm.cmd run build --prefix dashboard`: initial builds exposed TypeScript incompatibilities in the generic PostgreSQL adapter casts and the integration test's query callback. Minimal compile-only fixes were made to `pipelineQuery.ts`, `productDetail.ts`, and `tests/helpers/postgres-pipeline.integration.ts`. The final exact build passed with Next.js **14.2.35**, compiling, lint/type validation, static page generation, and route trace steps successfully.
- Parent installed dependencies with `npm.cmd ci --prefix dashboard --include=dev`. npm reports **4 vulnerabilities: 2 moderate, 1 high, 1 critical**. No audit fix, force option, or dependency-major change was run.
- `git diff --check` is required on the final candidate and will be recorded after this append and task/status updates.

### Task 4.4 and 4.5 evidence

Task 4.4 is complete: the board/card/detail UI exposes persisted evaluation/source identity and evidence status/provenance, retains discovered/incomplete distinctions, renders unavailable evidence honestly, and keeps detail/related reads within trusted tenant scope. Contract coverage directly checks these paths; the database run proves the actual tenant-isolated pipeline/detail reads.

Task 4.5 is complete: local contracts and production build pass; the guarded disposable PostgreSQL run covers actual schema/query compatibility, cross-tenant isolation, detail reads, empty/error distinction, and read-only query behavior. Evidence presentation and no-mutation boundaries are also asserted by the contract suite. No live service or production database was accessed.

### Branch and rollback boundary

- PR2D final base: `1d988f7`.
- PR3A parent: `7ad957a` on `feat/alfa-agent-pr3-dashboard`, authored changed lines **691** excluding generated package lock; the one allowed backend/contracts vs UI split is exhausted. Retain the `size:exception` recommendation for PR3A; no approval is claimed.
- PR3B child: `cd16462` on `feat/alfa-agent-pr3-dashboard-ui`, parent PR3A `7ad957a`; authored changed lines were **237 before this corrective rerun**. Final count will be recalculated from the PR3A base excluding generated package-lock changes.
- Rollback: revert only new corrective type fixes and task/status evidence to restore `cd16462`; reverting PR3B restores PR3A; reverting PR3A then returns to PR2D `1d988f7`. Preserve migration 002 and product/evaluation evidence; do not delete rows.
- No push, amend, rebase, force, Compose/env edit, private networking, deployment, remote DB access, or PR4 work was performed.

### Final candidate measurement

- PR3B final authored changed-line count is **329**; total additions plus deletions are **334** excluding generated `dashboard/package-lock.json`, including five build-generated lines in `dashboard/next-env.d.ts`. This remains under 400; PR3A remains 691 lines with an unapproved `size:exception` recommendation.
- Final `git diff --check` passed. Task ledger readback confirms **22 complete and 5 pending**.

## PR3 manual corrective pass — dashboard contract typecheck — 2026-09-28

This one bounded manual correction fixes the validator's reproduced direct TypeScript errors. The working branch remains `feat/alfa-agent-pr3-dashboard-ui`; PR3A `7ad957a`, PR3B `cd16462`, and the corrective commits already on this branch remain intact.

### RED → GREEN evidence

- **RED:** `dashboard/node_modules/.bin/tsc.cmd --project dashboard/tsconfig.json --noEmit --incremental false` exited 2 before edits. The generic fake passed to `queryPipeline` returned concrete fixture rows but did not implement the polymorphic `Query<Row>` contract; the transport fake returned `{ data }` without the required numeric HTTP `status`.
- The failures originate only in `dashboard/tests/pipeline.contract.test.ts`; production type contracts and `tsconfig.json` were left unchanged.
- **GREEN:** the same direct `tsc` command exited 0 after the query test doubles declared the `pipeline.Query` generic contract and the success transport supplied `status: 200`.
- `npm.cmd run test:contract --prefix dashboard` — exit 0; **14 tests, 13 passed, 0 failed, 1 guarded local-PostgreSQL scenario skipped** because `LOCAL_TEST_DATABASE_URL` was absent. A temporary external Node preload addressed the existing Node 26.8.2 `tsx` `uv_os_get_passwd returned ENOMEM` failure and was removed afterward.
- `npm.cmd run build --prefix dashboard` — exit 0 with Next.js 14.2.35; compilation, type validation, page generation, and build tracing passed.
- Parent's prior disposable PostgreSQL evidence remains **14/14, 0 skipped** against the unchanged guarded database harness, including migrated-schema compatibility and tenant A/B pipeline/detail isolation. No new database assertions were added, so this evidence remains applicable.
- `git diff --check` is required again on the final committed candidate.

### Scope and remaining verification warning

- The type fixes are test-double-only. They do not weaken production types, alter project configuration, or skip compilation.
- Task 4.5 remains complete based on direct typecheck, dashboard contracts, production build, SQL structural contracts, and the parent-provided disposable runtime evidence above. Cumulative state remains 22/27, with only Phase 5 tasks 5.1–5.5 pending.
- Warning: the disposable fixture proves separate tenant A/B product/detail isolation but did not seed a wrong-tenant related row under the same product or multiple evaluations to check latest-row selection at runtime. Existing SQL contracts assert tenant equality and latest ordering. Expanding those runtime fixtures would require the parent to rerun the guarded disposable DB scenario; do not claim that stronger scenario was run.
- Native SDD artifact store is OpenSpec. The session requested hybrid; the cumulative OpenSpec task/progress files are the native-locator artifacts, and `sdd/develop-alfa-agent/apply-progress` remains the Engram mirror.
