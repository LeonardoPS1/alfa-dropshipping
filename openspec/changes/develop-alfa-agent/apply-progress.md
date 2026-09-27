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
