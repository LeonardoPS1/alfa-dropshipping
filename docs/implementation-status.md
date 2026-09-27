# Implementation status

This repository contains the PR 1 slice of the `develop-alfa-agent` Safe Product Discovery Vertical Slice. PR 1 remains partial because stable private overlay connectivity and deploy readiness remain unresolved. Task 1.5's authorized dedicated-database preflight and backup are complete; this does not claim application deployment or a production-data backup.

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
| PR 2–4 work | Pending | Orchestration, dashboard, smoke harness, and deployment wiring tasks remain unchecked in OpenSpec. |

See `openspec/changes/develop-alfa-agent/tasks.md` and `apply-progress.md` for the authoritative task ledger and detailed evidence. Tasks 1.1, 1.3, 1.5, 1.6, and 2.1–2.4 are marked complete; other PR 1 tasks remain pending or outside the slice.

## Recorded verification evidence

Fresh local product-only checks in the current environment are:

- `npm.cmd run test:contract --prefix subagent-producto` with a temporary OS preload — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL-only test skipped. This includes route-level auth/context contracts with an injected search fake. A separate parent-reported authorized PostgreSQL tunnel run passed 8/8 including the concurrent race.
- `npm.cmd run build --prefix subagent-producto` with the same temporary preload — exit 0 (`tsc -p tsconfig.json`).
- Migration 002 forward/reverse/re-apply was verified on a disposable DB by the parent; this is not a production migration or backup claim.

The test runner required a temporary Node preload in the original sandbox because `tsx` calling `node:os.userInfo()` failed there with `uv_os_get_passwd returned ENOMEM`. That preload was outside the project and is not part of this repository. These are recorded source-workspace results; rerun checks in the destination before relying on them. Do not interpret skipped database tests as passing.

## Deployment and Git blockers

- No Dokploy application deployment or configured-token HTTP success is claimed. The dedicated database and its Dokploy environment variable names were prepared, but no backup of pre-existing production ALFA data or stable application connectivity is claimed.
- The dedicated database rehearsal is not a claim of deployed application readiness or a backup of pre-existing production ALFA data. PostgreSQL/PgBouncer are host-published and currently reachable only on the Compose bridge; stable private overlay connectivity remains unresolved.
- The existing n8n database is shared/mixed and must not receive ALFA migrations. ALFA uses the separate `alfa_db` database on the same PostgreSQL instance; stable private overlay connectivity remains unresolved.
- `docker-compose.yml` currently declares a public Traefik route for the orchestrator, while the OpenSpec deployment task requires removing that route. Do not deploy this snapshot as if that task were complete.
- The product endpoint requires internal authorization configuration that is not yet wired through Compose; PR 4 tracks deployment credentials and trusted tenant configuration.
- Feature-chain refs are local: `feat/alfa-agent` is the tracker branch and `feat/alfa-agent-pr1-db-verification` is the PR 1 work branch. Remote pushes are not claimed; no pull request has been opened.
