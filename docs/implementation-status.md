# Implementation status

This repository contains the PR 1 and PR 2 slices plus partial PR 3 dashboard work for the `develop-alfa-agent` Safe Product Discovery Vertical Slice. The cumulative SDD task state is 20/27 complete; dashboard rendering/build acceptance, controlled smoke, and deployment work remain pending. Stable private overlay connectivity and deploy readiness remain unresolved, and this status does not claim application deployment or a production-data backup.

## Delivery status

| Work | Status | Evidence or blocker |
|---|---|---|
| Task 1.1: product contract test command and runner | Complete | Package script and lockfile are present; contract suite was recorded as passing. |
| Task 1.3: contract tests and guarded PostgreSQL integration harness | Complete | Tests are present; the real disposable-database race was exercised over an SSH tunnel in the authorized PostgreSQL instance. |
| Task 2.1: stable product identity and nullable observed-price parsing | Complete | Implementation and regression coverage are present. |
| Task 2.3: evidence-aware scoring and tenant-scoped product ownership | Complete | Implementation and contract coverage are present. |
| Task 1.5: deployed-schema preflight, backup, and duplicate resolution | Complete | Parent-observed authorized PostgreSQL 17.9 rehearsal: confirmed no prior `alfa*` DB/role; created isolated `alfa_db` and least-privilege `alfa_app`; pre-migration custom-format backup was catalog-validated and restored to a disposable restore DB; migration 001 was applied and duplicate preflight returned zero groups before uniqueness rollout. Post-migration backup was catalog-verified. No production ALFA data existed to back up; no secret is recorded. |
| Task 1.6: migration forward/reverse execution | Complete | On a disposable PostgreSQL 17.9 database: migration 002 applied and schema/index verified, rollback verified, then migration re-applied. The disposable DB and role were removed. |
| Task 2.2: HTTP auth boundary and PostgreSQL persistence behavior | Complete | Route contracts prove missing/wrong tokens, invalid trusted UUIDs and mismatched body tenants are rejected before injected search; valid token/context is forwarded. Existing database contracts cover the atomic identity upsert; tests use an injected fake and do not call live Dropi. |
| Task 2.4: PostgreSQL concurrency and tenant-isolation integration | Complete | Parent-reported contract run passed 8/8 including a real concurrent partial-unique-index race over an SSH tunnel; the latest local suite passed 13 with 1 DB test skipped. |
| Tasks 1.2 and 1.7: orchestration contracts and test runner | Complete | Tenant/protocol contract coverage and the orchestrator `node:test`/`tsx` package command are present. |
| Tasks 3.1–3.5: bounded orchestration and audit | Complete | Static two-tool routing, authenticated product transport, trusted context, transcript/budget validation, and fail-closed audit are covered; the corrective contract run verifies body-tenant mismatch auditing and bounded value/key sanitization. |
| Tasks 1.4, 1.8, 4.1–4.3: dashboard contracts, test runner, trusted proxy, and tenant-scoped query | Complete | Dashboard contract suite passed 13 tests with 1 explicit local-PostgreSQL skip; task checkboxes are recorded in OpenSpec. |
| Tasks 4.4–4.5: dashboard evidence rendering and final runtime/build checks | Pending | UI/detail edits are present, but dashboard build could not start because local dependencies are absent and npm registry access was denied; PostgreSQL harness skipped because `LOCAL_TEST_DATABASE_URL` is unset. |
| Phase 5 deployment/smoke work | Pending | Controlled smoke harness and deployment wiring tasks remain outside PR 3. |

See `openspec/changes/develop-alfa-agent/tasks.md` and `apply-progress.md` for the authoritative task ledger and detailed evidence. PR 1's eight tasks, PR 2's tasks 1.2, 1.7, and 3.1–3.5, and PR 3 tasks 1.4, 1.8, and 4.1–4.3 are complete; task 4.4, 4.5, and Phase 5 tasks remain pending.

## Recorded verification evidence

Fresh local PR 2 checks in the current environment are:

- `npm.cmd run test:contract --prefix orchestrator` with a temporary OS preload — exit 0; 32 tests passed, 0 failed or skipped. The suite includes the six-turn/eight-call guards, forbidden-batch zero-dispatch behavior, authenticated body-tenant mismatch auditing, URI credential redaction, bounded object keys, audit failure, and loopback HTTP contracts.
- `npm.cmd run build --prefix orchestrator` with the same temporary preload — exit 0 (`tsc -p tsconfig.json`).
- `npm.cmd run test:contract --prefix subagent-producto` with the same temporary preload — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL-only test skipped. A separate parent-reported authorized PostgreSQL tunnel run passed 8/8 including the concurrent race.
- `npm.cmd run build --prefix subagent-producto` with the same temporary preload — exit 0 (`tsc -p tsconfig.json`).
- Migration 002 forward/reverse/re-apply was verified on a disposable DB by the parent; this is not a production migration or backup claim.

The test runner required a temporary Node preload outside the repository because Node 26.8.2 `tsx` calling `node:os.userInfo()` failed with `uv_os_get_passwd returned ENOMEM`. The exact orchestrator test command was first run without the preload and exited before tests; the temporary preload was removed after the reruns and is not part of this repository. Do not interpret the skipped product PostgreSQL test as passing.

Fresh local PR 3 checks in the current environment are:

- The dashboard contract suite, `npm.cmd run test:contract --prefix dashboard`, exited 0 under Node 26.8.2: 14 tests, 13 passed, 0 failed, 1 local-PostgreSQL scenario skipped. Because dashboard dependencies are not installed in this workspace, the command used the existing sibling product package's `tsx` executable via `PATH`; a temporary `node:os.userInfo()` preload outside the repository avoided the observed `uv_os_get_passwd returned ENOMEM` failure. Neither workaround is committed.
- `npm.cmd run build --prefix dashboard` exited 1 before compilation because `next` is not installed (`"next" no se reconoce como un comando interno o externo`). `npm.cmd install --prefix dashboard --ignore-scripts` could not fetch `tsx` from `registry.npmjs.org` (EACCES in the network-restricted environment); no remote deployment, database, or live service was accessed.
- The guarded PostgreSQL integration scenario is present and rejects non-loopback URLs before connecting. It was skipped because `LOCAL_TEST_DATABASE_URL` is unset; `DATABASE_URL` is never used as a fallback. No production DB was touched.
- `git diff --check` passed on PR 3A before its commit. The PR 3B final-candidate whitespace result is recorded in the cumulative apply-progress after the final candidate check.

## Deployment and Git blockers

- No Dokploy application deployment or configured-token HTTP success is claimed. The dedicated database and its Dokploy environment variable names were prepared, but no backup of pre-existing production ALFA data or stable application connectivity is claimed.
- The dedicated database rehearsal is not a claim of deployed application readiness or a backup of pre-existing production ALFA data. PostgreSQL/PgBouncer are host-published and currently reachable only on the Compose bridge; stable private overlay connectivity remains unresolved.
- The existing n8n database is shared/mixed and must not receive ALFA migrations. ALFA uses the separate `alfa_db` database on the same PostgreSQL instance; stable private overlay connectivity remains unresolved.
- `docker-compose.yml` currently declares a public Traefik route for the orchestrator, while the OpenSpec deployment task requires removing that route. Do not deploy this snapshot as if that task were complete.
- The product endpoint requires internal authorization configuration that is not yet wired through Compose; PR 4 tracks deployment credentials and trusted tenant configuration.
- Feature-chain refs are published to `origin`: PR 1 is `feat/alfa-agent-pr1-db-verification`; PR 2 proceeds through `feat/alfa-agent-pr2-auth` at `641f687`, `feat/alfa-agent-pr2-tools` at `b1129ae`, `feat/alfa-agent-pr2-transcript` at `104b8e9`, and `feat/alfa-agent-pr2-audit` at `386fb57`. The maintainer explicitly approved `size:exception` after one slicing pass; the final cumulative PR2D authored line count is recorded in apply progress. No pull request or deployment was performed.
