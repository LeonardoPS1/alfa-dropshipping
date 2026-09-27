# Implementation status

This repository contains the PR 1 slice of the `develop-alfa-agent` Safe Product Discovery Vertical Slice. PR 1 remains partial because deployed ALFA schema/backup preflight (task 1.5) is pending. Disposable PostgreSQL migration/concurrency evidence does not establish a deployed system.

## Delivery status

| Work | Status | Evidence or blocker |
|---|---|---|
| Task 1.1: product contract test command and runner | Complete | Package script and lockfile are present; contract suite was recorded as passing. |
| Task 1.3: contract tests and guarded PostgreSQL integration harness | Complete | Tests are present; the real disposable-database race was exercised over an SSH tunnel in the authorized PostgreSQL instance. |
| Task 2.1: stable product identity and nullable observed-price parsing | Complete | Implementation and regression coverage are present. |
| Task 2.3: evidence-aware scoring and tenant-scoped product ownership | Complete | Implementation and contract coverage are present. |
| Task 1.5: deployed-schema preflight, backup, and duplicate resolution | Pending | No production ALFA schema/version inspection or production ALFA backup is claimed. Disposable duplicate preflight returned zero groups but does not satisfy the production/backup portions. |
| Task 1.6: migration forward/reverse execution | Complete | On a disposable PostgreSQL 17.9 database: migration 002 applied and schema/index verified, rollback verified, then migration re-applied. The disposable DB and role were removed. |
| Task 2.2: HTTP auth boundary and PostgreSQL persistence behavior | Complete | Route contracts prove missing/wrong tokens, invalid trusted UUIDs and mismatched body tenants are rejected before injected search; valid token/context is forwarded. Existing database contracts cover the atomic identity upsert; tests use an injected fake and do not call live Dropi. |
| Task 2.4: PostgreSQL concurrency and tenant-isolation integration | Complete | Parent-reported contract run passed 8/8 including a real concurrent partial-unique-index race over an SSH tunnel; the latest local suite passed 13 with 1 DB test skipped. |
| PR 2–4 work | Pending | Orchestration, dashboard, smoke harness, and deployment wiring tasks remain unchecked in OpenSpec. |

See `openspec/changes/develop-alfa-agent/tasks.md` and `apply-progress.md` for the authoritative task ledger and detailed evidence. Tasks 1.1, 1.3, 1.6, 2.1–2.4 are marked complete; 1.5 remains pending in this PR 1 slice.

## Recorded verification evidence

Fresh local product-only checks in the current environment are:

- `npm.cmd run test:contract --prefix subagent-producto` with a temporary OS preload — exit 0; 14 tests, 13 passed, 0 failed, 1 local PostgreSQL-only test skipped. This includes route-level auth/context contracts with an injected search fake. A separate parent-reported authorized PostgreSQL tunnel run passed 8/8 including the concurrent race.
- `npm.cmd run build --prefix subagent-producto` with the same temporary preload — exit 0 (`tsc -p tsconfig.json`).
- Migration 002 forward/reverse/re-apply was verified on a disposable DB by the parent; this is not a production migration or backup claim.

The test runner required a temporary Node preload in the original sandbox because `tsx` calling `node:os.userInfo()` failed there with `uv_os_get_passwd returned ENOMEM`. That preload was outside the project and is not part of this repository. These are recorded source-workspace results; rerun checks in the destination before relying on them. Do not interpret skipped database tests as passing.

## Deployment and Git blockers

- No Dokploy deployment or configured-token HTTP success is claimed. A parent-authorized PostgreSQL disposable rehearsal occurred; no production ALFA database backup or production schema verification is claimed.
- The deployed ALFA schema, backup, and duplicate state remain unverified. Keep task 1.5 pending until those exact checks and backup are performed under approved access.
- The existing n8n database is shared/mixed and must not receive ALFA migrations. Use a separate ALFA database on the same PostgreSQL instance; no actual ALFA production database is claimed created/configured here.
- `docker-compose.yml` currently declares a public Traefik route for the orchestrator, while the OpenSpec deployment task requires removing that route. Do not deploy this snapshot as if that task were complete.
- The product endpoint requires internal authorization configuration that is not yet wired through Compose; PR 4 tracks deployment credentials and trusted tenant configuration.
- Feature-chain refs were created from `main` and pushed to GitHub: `feat/alfa-agent` is the tracker branch and `feat/alfa-agent-pr1-db-verification` is the PR 1 work branch. Commit `dd2d1ca` is published on the child branch. No pull request has been opened.
