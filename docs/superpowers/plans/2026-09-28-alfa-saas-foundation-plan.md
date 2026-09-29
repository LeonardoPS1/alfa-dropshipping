# ALFA SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally testable, organization/store-isolated foundation with persisted team/settings operations, encrypted connection storage and safe durable execution, without pretending external providers or the complete SaaS are ready.

**Architecture:** Keep Next.js and PostgreSQL. Place the shared application command/query services in `dashboard/src/lib/saas/`; Next handlers, worker and later chat/n8n adapters call this same authority layer. Existing orchestrator discovery contracts remain restrictive and isolated from new identities until a later scoped bridge is proved.

**Tech Stack:** Existing Next.js 14, React 18, NextAuth 4, TypeScript, pg, bcryptjs; built-in Node crypto/assert/test and installed tsx. PostgreSQL outbox/leases; no Redis, new queue package or third-party cryptography dependency required for this slice.

**Spec:** [Approved reconstruction design](../specs/2026-09-28-alfa-saas-reconstruction-design.md). Read in full, alongside the [complete roadmap](2026-09-28-alfa-reconstruction-roadmap.md). Later subsystem plans remain pending.

## Global Constraints

- Primary UI and marketing language is Latin American Spanish (`es-419`); technical identifiers and documentation remain English.
- Roles are owner, administrator, operator and reader.
- Shopify is the only sales channel in v1.
- No production request falls back to a global tenant.
- Strict TDD for reconstruction is **RED → GREEN → REFACTOR**.
- Database access alone must not reveal usable secrets.
- Delivery is at least once; do not claim exactly-once external effects.
- Existing discovery allowlist stays restrictive until additional actions are explicitly registered and tested.
- Every menu module must be functional at the full-product release; this foundation is only an explicitly named slice.
- Responsive acceptance covers 360px mobile, tablet and desktop; WCAG 2.2 AA contrast and `prefers-reduced-motion` apply.
- No remote execution, provider spend, production migration, DNS or deployment is authorized by this plan.
- Commercial defaults, paid entitlements, provider scopes/API versions and ROAS thresholds are not invented.

## Review Focus

1. Overlapping resource IDs and revoked memberships must never leak across organizations/stores — Tasks 1–2: composite ownership and immediate session/worker revocation tests.
2. Concurrent owner removals/invitation replay must not leave an organization ownerless or elevate authority — Task 3: transaction race and single-use invitation tests.
3. Tampered/rotated ciphertext and attacker-selected endpoints must not expose credentials or reach private networks — Task 6: associated-data, rotation, DNS rebinding and redirect tests.
4. Concurrent duplicate requests and timeout-after-effect must not double-create or report success — Tasks 7–8: payload conflict, unique effect and unknown-outcome tests.
5. Kill/revoke between queue claim and outbound dispatch must block unstarted effects, without pretending in-flight effects were undone — Task 8: fenced dispatch/revocation/kill race tests.

---

## Repository evidence and readiness

Inspected on 2026-09-28; no test/build executed during planning. There is **no root package.json**. Run package commands from the named package directory.

| Existing evidence | What it permits; what it does not prove |
|---|---|
| `dashboard/package.json`: `test:contract = tsx --test tests/*.test.ts`, `build = next build`, `dev = next dev` | Existing Node test convention; not browser E2E coverage. |
| `orchestrator/package.json`: same `test:contract`, `build = tsc -p tsconfig.json` | Existing contract/build commands for regression. |
| `subagent-producto/package.json`: same `test:contract`, `build = tsc -p tsconfig.json` | Existing discovery regression only. Other subagents lack a test script; later plans must authorize tooling rather than invent runners. |
| Dashboard/orchestrator `node_modules/.bin/tsx.cmd` and `tsc.cmd` exist | Filesystem readiness only; executor must verify executable operation and installed dependency/types before RED. |
| Dashboard tsconfig includes tests; orchestrator tsconfig includes only `src` | Dashboard `tsc --noEmit` also checks tests. Orchestrator build alone does not typecheck test files. |
| `db/migrations/001_init.sql`, `002_discovery_evidence.sql` | Legacy tenant tables lack organization/store relationships; no migration runner inspected or assumed. |
| `dashboard/tests/helpers/postgres-pipeline.integration.ts` | Loopback/named-disposable harness convention; currently optional/skipped without URL. New migration proof must fail clearly if its required local DB is absent. |
| `auth.ts`, `tenantContext.ts` | Current env-admin/JWT configured default tenant is not safe SaaS identity. Change intentionally, do not preserve that behavior as acceptance. |
| `orchestrator/src/mcp/{registry,client}.ts`, `routes/chat.ts` | Two-tool single-tenant boundary; do not remove protections or activate dormant Ads tools as part of foundation. |

**Execution readiness gate before first RED:** inspect clean candidate/worktree and exact installed Node/dependency versions; run from `dashboard`:
`node --version`, `npm.cmd ls --depth=0`, `.\node_modules\.bin\tsx.cmd --version`, `.\node_modules\.bin\tsc.cmd --version`. Then establish baseline `npm.cmd run test:contract` and `.\node_modules\.bin\tsc.cmd --noEmit`; record all failures. A missing import/compiler/dependency is a setup failure, not behavioral RED. Do not install without the later approved dependency task/permissions. Current package ranges are not supported-runtime evidence; verify Node/Next compatibility before implementation.

All task-specific RED/GREEN commands below run from `D:\Codex\alfa-dropshipping\dashboard`. New filenames are **planned**. Use `node:test` and `node:assert/strict`, with injected repositories/clock/transport for unit tests. DB scenarios use real local disposable PostgreSQL separately, not fake SQL assertions alone. Each task also runs `npm.cmd run test:contract` and `.\node_modules\.bin\tsc.cmd --noEmit` after GREEN/refactor. Build integration at Tasks 9–10. Observed outputs, not this plan's expected outputs, are the execution evidence.

Assertion snippets below belong inside the named tests. `db`, `scope`, `identity`, IDs, keyring and intents are explicitly seeded/injected fixtures of that task's declared types, not new helper APIs. Use `import assert from 'node:assert/strict'`. Error codes shown are proposed stable contract values to implement. All fixtures and route gates operate exclusively in the isolated local reconstruction workspace/database; the deployed application is untouched.

## Shared contracts and file boundaries

All signatures below are proposed contracts to create, not existing exports.

`dashboard/src/lib/saas/types.ts` defines:
- `Role = 'owner' | 'administrator' | 'operator' | 'reader'`.
- `Scope = { actorId: string; organizationId: string; storeId: string | null; membershipVersion: number; requestId: string }`. Role is loaded server-side, not a caller claim.
- `SessionIdentity = { userId: string; sessionVersion: number }`; `ScopeSelector = { organizationId: string; storeId?: string }`. Selector is an untrusted choice validated against membership.
- `Db = { query<Row>(sql: string, values: unknown[]): Promise<{ rows: Row[] }>; transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> }`. Transaction pins one pg client; never BEGIN and subsequent statements on independent pooled clients.
- `Result<T> = { ok: true; value: T } | { ok: false; code: string }`; `Clock = () => Date`.
- `FoundationCommand` uses `{ name: literal; args: owningInputType }`: `team.invite`, `team.changeRole`, `team.remove`, `store.create`, `store.update`, `store.disconnect`, `connection.save`, `connection.revoke`, `job.cancel`, `job.approve`, `policy.setMode`, `policy.setKillSwitch`. Arguments correspond to owning interfaces below; ID-based commands use `{ id: string }`, store.update uses `{ id: string; patch: StoreInput }`, and policy commands use their Task 8 inputs. Only `connection.save` accepts a write-only secret. Caller authority claims are rejected; a desired team target role is permitted only after checking the actor's actual authority.
- `CommandEnvelope = { command: FoundationCommand; idempotencyKey: string; expectedVersion: number }`; `CommandReceipt = { requestId: string; status: 'confirmed' | 'queued' | 'awaiting_approval'; resourceId: string; jobId?: string; invitationLink?: string }`. A fresh authorized invitation response can return its one-time link; query/audit/replayed receipts never disclose its token again. A retry that lost the original link requires an explicit replacement invitation, not recovering plaintext from storage.
- `JobState = 'queued' | 'awaiting_approval' | 'running' | 'succeeded' | 'partial' | 'failed' | 'canceled' | 'outcome_unknown'`.
- `EffectResult = { kind: 'confirmed'; providerId: string } | { kind: 'rejected'; code: string; retryable: boolean } | { kind: 'unknown' }`.
- `Keyring = { activeKeyId: string; keys: ReadonlyMap<string, Buffer> }`; keys remain server-only.
- `SettingsView = { organizationId: string; storeId: string|null; allowedActions: string[]; members: { id: string; email: string; role: Role; active: boolean; version: number }[]; stores: { id: string; name: string; currency: string; timezone: string; supplier: string; active: boolean; version: number }[]; connections: { id: string; provider: string; state: string; version: number; verifiedAt: string|null }[] }`. Task 5 produces this DTO; Task 6 fills vault metadata. It excludes password/token/ciphertext material.

Keep auth/scope, team, stores, commands, vault, jobs and worker modules cohesive. No new shared monorepo package. Later services receive narrow signed scoped execution identities rather than importing browser-facing auth or trusting internal bearer tokens alone.

## Slice strategy and common closing gate

Proposed tracker `feat/alfa-saas-reconstruction`; ten child boundaries `feat/alfa-foundation-01` … `10`. Execution creates an isolated workspace only after approval. `auto-chain` / `feature-branch-chain`: tracker draft/no-merge to main; child 01 to tracker, later child to immediate previous child; only tracker integrates to main. This document does not create any branch or PR.

Forecast 3,000–4,500 authored additions/deletions total; 250–550 per cohesive unit. 400-line budget risk: High. Make one honest slicing pass; retain tests/docs. User standing `size:exception` approval may cover inseparable unit overages, but report measured lines/rationale per affected PR. No code golf or fabricated under-budget count.

Every task closes with focused proof, full applicable checks, sanitized evidence in `docs/reconstruction/foundation.md`, a Conventional Commit, runtime scenario or explicit N/A, and an independently stated rollback boundary. Commit commands below run from repo root. Never add AI attribution. Native risk/review runs only under its user-owned applicable contract; this planning file does not issue review authority.

### Task 1: Add organization ownership and explicit legacy mapping

**Files:** Create `db/migrations/003_saas_identity.sql`, `dashboard/src/lib/saas/types.ts`, `dashboard/src/lib/saas/database.ts`, `dashboard/scripts/map-legacy.ts`, `dashboard/tests/helpers/foundation-database.ts`, `docs/reconstruction/foundation.md`. Test: `dashboard/tests/foundation.migration.test.ts`. Existing migrations remain unchanged.

**Interfaces:** `createDb(pool: Pool): Db`; `planLegacyMapping(db: Db, mapping: LegacyMapping[]): Promise<MappingReport>`; `LegacyMapping = { legacyTenantId: string; organizationId: string; storeId: string }`; `MappingReport = { mapped: string[]; orphaned: string[]; conflicts: string[] }`. CLI defaults dry-run; explicit `--apply` refuses any orphan/conflict, uses a transaction and records approved mapping provenance.

- [ ] Write tests `additive migration preserves legacy rows and rejects cross-organization store assignment`, `unmapped legacy records remain quarantined`, `mapping conflicts roll back without assigning a default owner`; assert row counts unchanged and `report.orphaned.includes(legacyTenant)`.

  ```ts
  // unmapped legacy records remain quarantined: fixture contains legacyTenantId.
  const report = await planLegacyMapping(db, []);
  assert.equal(report.orphaned.includes(legacyTenantId), true);
  assert.deepEqual(report.mapped, []);
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.migration.test.ts`. Expected missing proposed mapping export/schema; after readiness and harness setup, ownership insertion must fail with FK/authorization violation, not connection failure.
- [ ] Implement schema: users (normalized email/password hash/session version/active), organizations (version/configuration including explicit invitation expiry), memberships (role/version/active), stores (organization, configuration version, active/verification state), assigned-store memberships, legacy organization/store mapping. Composite organization/resource unique keys and FKs reject mixed ownership. Do not bind a Shopify identity from a typed hostname alone. No destructive changes to legacy tables or automatic data reassignment.
- [ ] GREEN + refactor: same focused command and common checks. Required harness refuses non-loopback/non-test URLs before connecting; creates its own random schema, applies 001–003 and drops **only that verified schema** on cleanup. Without `LOCAL_TEST_DATABASE_URL`, DB-required tests report missing prerequisite, not PASS/skip disguised as migration proof.

  Harness readiness is a separate infrastructure check before behavioral RED: prove local PostgreSQL connectivity/version, schema creation/search_path isolation and cleanup using only existing migrations 001–002. The helper must not supply the planned 003 behavior. Then the new mapping/ownership assertions must fail for the absent behavior. If the helper, DB or dependency is unavailable, stop that DB-dependent unit as blocked; never count connection/import setup failure as the observed behavioral RED.
- [ ] Runtime: rehearse old-reader compatibility, dry-run/apply/reapply mappings and forward/backup/restore in a disposable DB; compare legacy counts/evidence. Restore rehearsal is a gate, not a production backup action. Rollback: stop new writers and revert new app paths, keep additive tables/history; no DROP after real writes without retention approval.
- [ ] Commit: `git add db/migrations/003_saas_identity.sql dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/database.ts dashboard/scripts/map-legacy.ts dashboard/tests/helpers/foundation-database.ts dashboard/tests/foundation.migration.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(saas): add isolated organization ownership and legacy mapping"`.

### Task 2: Resolve persisted identity and active scope without fallback

**Files:** Create `dashboard/src/lib/saas/identity.ts`, `dashboard/src/lib/saas/scope.ts`, `dashboard/scripts/bootstrap-owner.ts`. Test: `dashboard/tests/foundation.scope.test.ts`. Modify `dashboard/src/lib/auth.ts`, `dashboard/src/lib/tenantContext.ts`, `dashboard/src/lib/db.ts`, `dashboard/src/lib/chatProxy.ts`, `dashboard/src/lib/pipelineRead.ts`, `dashboard/src/app/api/chat/route.ts`, `dashboard/src/app/api/pipeline/route.ts`, `dashboard/src/app/campaigns/page.tsx`, `dashboard/src/app/products/[id]/page.tsx`, `dashboard/tests/pipeline.contract.test.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `authenticate(email: string, password: string, db: Db): Promise<Result<SessionIdentity>>`; `resolveScope(identity: SessionIdentity | null, selector: ScopeSelector, db: Db, requestId: string): Promise<Result<Scope>>`; `authorize(scope: Scope, capability: string, db: Db): Promise<Result<void>>`. Bootstrap CLI consumes password from non-echoed input/file descriptor, never command argv/logs; owner/mapping approval required.

- [ ] Write `selector cannot grant organization or assigned-store access`, `role and session revocation deny next request without waiting for JWT expiry`, `legacy URLs cannot expose default tenant records`; assert denied result and query/dispatch count zero for caller tenant injection.

  ```ts
  // selector cannot grant organization access: identity belongs only to orgA.
  assert.deepEqual(await resolveScope(identity, { organizationId: orgB }, db, requestId),
    { ok: false, code: 'scope_denied' });
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.scope.test.ts`; expected missing scoped resolver or current unsafe fallback assertion.
- [ ] Implement DB-backed credentials using existing bcryptjs; JWT carries stable user ID/session version, not authoritative roles. Every private read/mutation rechecks active user/membership/store assignment. Use membership-verified selector server-side; no env-admin universal owner. Require explicit local root-account bootstrap, no silent import of old ID `1`. Historical routes deny/gate until explicit legacy mapping and session scope exist; do not bridge organization IDs into single-tenant discovery automatically.

  These historical-route gates are changes to the isolated reconstruction candidate, not a production-disable operation. Do not change Dokploy configuration, production feature flags, deployed branches, sessions or database mappings. Keep the current deployed application running unchanged; activation/cutover requires a separate approved migration/rollback/release procedure. Test denial against local fixtures rather than sending probes to production.
- [ ] GREEN + refactor: focused command/common checks. Update obsolete single-admin assertions intentionally; preserve evidence/provenance/query ownership regression tests. Active-store change must reject another organization's store even when organization membership is valid.
- [ ] Runtime: two local accounts switch permitted contexts; removing membership immediately denies next request. N/A external providers. Rollback: disable new private access and restore old reader only under its separately retained restricted single-admin scope, never downgrade SaaS records to default tenancy.
- [ ] Commit: `git add dashboard/src/lib/auth.ts dashboard/src/lib/tenantContext.ts dashboard/src/lib/db.ts dashboard/src/lib/chatProxy.ts dashboard/src/lib/pipelineRead.ts dashboard/src/lib/saas/identity.ts dashboard/src/lib/saas/scope.ts dashboard/scripts/bootstrap-owner.ts dashboard/src/app/api/chat/route.ts dashboard/src/app/api/pipeline/route.ts dashboard/src/app/campaigns/page.tsx "dashboard/src/app/products/[id]/page.tsx" dashboard/tests/foundation.scope.test.ts dashboard/tests/pipeline.contract.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(auth): require persisted membership and verified store scope"`.

### Task 3: Make invitations and role changes transactional

**Files:** Create `db/migrations/004_team_invitations.sql`, `dashboard/src/lib/saas/team.ts`. Test: `dashboard/tests/foundation.team.test.ts`. Modify `dashboard/src/lib/saas/types.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `inviteMember(scope: Scope, input: { email: string; role: Exclude<Role,'owner'>; storeIds: string[] }, db: Db, clock: Clock): Promise<Result<{ invitationId: string; token: string }>>`; `acceptInvitation(identity: SessionIdentity, token: string, db: Db, clock: Clock): Promise<Result<void>>`; `changeMemberRole(scope: Scope, input: { memberId: string; role: Role; expectedVersion: number }, db: Db): Promise<Result<void>>`; `removeMember(scope: Scope, memberId: string, expectedVersion: number, db: Db): Promise<Result<void>>`.

- [ ] Write `invitation is expiry-bound email-bound and single-use`, `administrator cannot grant ownership`, `concurrent owner removal preserves one owner`; assert second token use denied, invalid assigned store denied, at least one active owner after concurrent transactions.

  ```ts
  // invitation is single-use: token/email/expiry match this seeded identity.
  assert.deepEqual(await acceptInvitation(identity, token, db, clock), { ok: true, value: undefined });
  assert.deepEqual(await acceptInvitation(identity, token, db, clock),
    { ok: false, code: 'invitation_consumed' });
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.team.test.ts`; expected absent behavior, not SMTP failure.
- [ ] Implement hashed random invitation tokens, audited acceptance/role changes and a serialized organization owner-change lock. Owner may grant/revoke ownership while preserving last owner; administrators may manage nonowners, operators/readers cannot. Expiry duration is explicit organization configuration, with no silent commercial policy. Reject missing/invalid expiry config. Increment membership version on changes. No email send or delivery claim; safe one-time invitation link display is local acceptance flow until later mail plan.
- [ ] GREEN + refactor: focused/common checks and real DB concurrent transaction assertion.
- [ ] Runtime: invite account B to A, revoke B, prove session denial; verify link never appears in logs. Rollback: close invitation entry, retain token hashes/audit and memberships; disabling UI does not restore revoked members.
- [ ] Commit: `git add db/migrations/004_team_invitations.sql dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/team.ts dashboard/tests/foundation.team.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(team): enforce invitation and ownership authority"`.

### Task 4: Persist store configuration without fake connection readiness

**Files:** Create `dashboard/src/lib/saas/stores.ts`. Test: `dashboard/tests/foundation.stores.test.ts`. Modify `dashboard/src/lib/saas/types.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `StoreInput = { name: string; currency: string; timezone: string; supplier: 'dropi' | 'csv' | 'api' }`; `createStore(scope: Scope, input: StoreInput, db: Db): Promise<Result<{ id: string; connectionState: 'not_configured' }>>`; `updateStore(scope: Scope, id: string, patch: StoreInput, expectedVersion: number, db: Db): Promise<Result<void>>`; `disconnectStore(scope: Scope, id: string, expectedVersion: number, db: Db): Promise<Result<void>>`.

- [ ] Write `store metadata creation never proves Shopify ownership`, `currency and timezone are explicit and versioned`, `disconnect preserves history and blocks future work`; assert `connectionState === 'not_configured'`, stale version conflict and cross-organization mutation denial.

  ```ts
  // store metadata creation never proves Shopify ownership.
  const created = await createStore(scope, { name: 'Fixture store', currency: 'USD',
    timezone: 'America/Santiago', supplier: 'dropi' }, db);
  assert.ok(created.ok);
  assert.equal(created.value.connectionState, 'not_configured');
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.stores.test.ts`; expected missing functions/state.
- [ ] Implement local store configuration/ownership checks. Validate timezone via installed Intl runtime; validate chosen currency against explicit maintained supported-currency metadata, not merely three letters. Provider selection config does not rewrite existing orders/listings; actual provider identity binding waits for verified adapter. Disconnect marks inactive and revokes future eligibility transactionally without erasing history.
- [ ] GREEN + refactor: focused/common checks.
- [ ] Runtime: persist/reload configuration for two stores with different currency/timezone; disconnect one and preserve audit. N/A provider connection. Rollback: disable new store writes, retain immutable ownership/history.
- [ ] Commit: `git add dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/stores.ts dashboard/tests/foundation.stores.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(stores): persist scoped configuration and safe disconnect"`.

### Task 5: Expose authenticated typed commands and scoped queries

**Files:** Create `dashboard/src/lib/saas/commands.ts`, `dashboard/src/lib/saas/transport.ts`, `dashboard/src/lib/saas/audit.ts`, `dashboard/src/lib/saas/settingsQuery.ts`, `db/migrations/005_execution_records.sql`, `dashboard/src/app/api/app/commands/route.ts`, `dashboard/src/app/api/app/context/route.ts`, `dashboard/src/app/api/app/settings/route.ts`, `dashboard/src/app/api/app/invitations/accept/route.ts`. Test: `dashboard/tests/foundation.commands.test.ts`. Modify `dashboard/src/lib/saas/types.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `executeCommand(scope: Scope, envelope: CommandEnvelope, dependencies: { db: Db; keyring: Keyring|null }): Promise<Result<CommandReceipt>>`; `handleCommandRequest(request: Request, dependencies: { resolveIdentity(): Promise<SessionIdentity|null>; db: Db; keyring: Keyring|null; allowedOrigin: string }): Promise<Response>`; `appendAudit(tx: Db, event: { scope: Scope; action: string; resourceId: string; outcome: string }): Promise<void>`; `readSettings(scope: Scope, db: Db): Promise<Result<SettingsView>>` in settingsQuery.ts. Define SettingsView as sanitized member/store rows plus connection metadata rows (Task 6 adds actual connections), actor allowedActions and organization/store IDs. Reads never dispatch; passwords, invitation tokens and ciphertext excluded.

- [ ] Write `foreign body tenant or role cannot grant authority`, `cross-origin mutation and unknown command fail before dispatch`, `audit failure rolls back local mutation`; assert 401/403/400 as applicable and no outbound/local effect. Browser secret save is write-only and omitted from audit.

  ```ts
  // unauthenticated command fails before dispatch.
  const response = await handleCommandRequest(new Request('http://localhost/api/app/commands',
    { method: 'POST' }), { resolveIdentity: async () => null, db, keyring: null,
    allowedOrigin: 'http://localhost' });
  assert.equal(response.status, 401);
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.commands.test.ts`; expected no handler/validator or missing denial.
- [ ] Implement explicit discriminated command validation, size-bounded JSON, session + scope + capability checks, expected versions, same-origin/CSRF controls for cookie auth. Parse `X-Alfa-Organization`/`X-Alfa-Store` as untrusted UUID selectors and resolve membership server-side; they never confer authority. Reject unknown fields (including tenant/role claims), create request IDs server-side and sanitize errors. Invitation acceptance separately validates authenticated identity + email-bound token before membership exists, with the same origin controls. Registry initially enables Task 3–4 operations only; vault/policy/job commands stay unavailable until their tasks pass. Reads return scoped state, not fixture metrics. Audit shares mutation transaction, excludes raw arguments/secrets, and uses allowlisted identifiers. Add DB jobs/outbox/idempotency/policy/effect tables for next units with composite FKs; implement synchronous receipt deduplication/digest conflicts now, before any repeatable mutation is exposed. Task 7 extends the same receipt mechanism to durable jobs; no running worker yet.
- [ ] GREEN + refactor: focused/common checks; HTTP Request/Response test hits actual exported handler with injected identity, not string search of source.
- [ ] Runtime: local same-origin command persists a store and returns confirmed receipt; unauthenticated/cross-origin requests denied. Rollback: gate typed route and registry; keep audit/history. No external integrations enabled.
- [ ] Commit: `git add db/migrations/005_execution_records.sql dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/commands.ts dashboard/src/lib/saas/transport.ts dashboard/src/lib/saas/audit.ts dashboard/src/lib/saas/settingsQuery.ts dashboard/src/app/api/app/commands/route.ts dashboard/src/app/api/app/context/route.ts dashboard/src/app/api/app/settings/route.ts dashboard/src/app/api/app/invitations/accept/route.ts dashboard/tests/foundation.commands.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(commands): centralize authenticated mutations and audit"`.

### Task 6: Store encrypted connection secrets and enforce safe endpoint contracts

**Files:** Create `db/migrations/006_connection_vault.sql`, `dashboard/src/lib/saas/vault.ts`, `dashboard/src/lib/saas/vaultCrypto.ts`, `dashboard/src/lib/saas/safeEndpoint.ts`, `dashboard/scripts/rotate-vault.ts`. Test: `dashboard/tests/foundation.vault.test.ts`, `dashboard/tests/foundation.egress.test.ts`. Modify `dashboard/src/lib/saas/commands.ts`, `dashboard/src/lib/saas/types.ts`, `dashboard/src/lib/saas/settingsQuery.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `EncryptedSecret = { keyId: string; wrappedKey: string; ciphertext: string; nonce: string; tag: string }`; wrapping envelope includes its own nonce/tag, encoded and versioned in wrappedKey. `SecretBinding = { organizationId: string; connectionId: string; version: number }`; `sealSecret(secret: Buffer, binding: SecretBinding, keys: Keyring): EncryptedSecret`; `openSecret(payload: EncryptedSecret, binding: SecretBinding, keys: Keyring): Buffer`; `saveConnection(scope: Scope, input: { provider: string; endpoint?: string; secret: string }, db: Db, keys: Keyring): Promise<Result<{ id: string; state: 'not_configured'; version: number }>>`; `revokeConnection(scope: Scope, id: string, expectedVersion: number, db: Db): Promise<Result<void>>`; `validatePublicEndpoint(url: string, resolve: (host: string)=>Promise<string[]>): Promise<Result<{ url: URL; addresses: string[] }>>`; `rejectRedirect(status: number, location: string|undefined): Result<void>`. These egress contracts validate destinations/redirects, not enable an HTTP integration.

- [ ] Write `database ciphertext cannot reveal secret without deployment key`, `AAD denies cross-connection ciphertext swap`, `rotation preserves active reads while old key removal is blocked until migration`, `metadata never returns raw secret`; assert decrypt roundtrip only correct binding/key, no secret substring in query/API/audit.

  ```ts
  // AAD denies cross-connection ciphertext swap: test keyring only.
  const encrypted = sealSecret(Buffer.from('fixture-secret'), binding, keys);
  assert.equal(openSecret(encrypted, binding, keys).toString(), 'fixture-secret');
  assert.throws(() => openSecret(encrypted, { ...binding, connectionId: otherConnectionId }, keys));
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.vault.test.ts tests/foundation.egress.test.ts`; expected absent primitives/endpoint validation.
- [ ] Implement envelope AES-256-GCM using random per-secret data key and separate key-wrapping nonce, authenticated organization/connection/version binding, key IDs and strict key length/version validation. Persist metadata/scopes as unverified; no browser key material. Rotation CLI dry-run first, transactional batches/compare version, old keys retained until zero references and recovery rehearsal. Register save/revoke only after key readiness; revoke changes credential version/holds queued work. No “test connection succeeded” endpoint until real adapter exists.
- [ ] Implement safe endpoint contract: HTTPS/no userinfo, reject private/loopback/link-local/multicast/unspecified/reserved addresses including IPv4-mapped IPv6, mixed public/private DNS answers and internal metadata. Reject redirects. Connection must pin validated address and revalidate DNS per attempt; URL precheck alone is not a safe fetch. Test a resolver changing public→private and public URL redirecting to metadata. This slice has no arbitrary-endpoint fetch enabled; later adapter must use this contract and its own outbound test.
- [ ] GREEN + refactor: focused/common checks. Use local fake DNS/transport; never probe supplied production URLs.
- [ ] Runtime: save dummy secret, inspect sanitized API state/ciphertext, rotate local test keys and recover with retained keyring. N/A real OAuth/API check; explicitly pending provider plans. Rollback: disable save/decrypt dispatch, preserve envelopes/old keys/versions; never revert by storing plaintext.
- [ ] Commit: `git add db/migrations/006_connection_vault.sql dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/commands.ts dashboard/src/lib/saas/settingsQuery.ts dashboard/src/lib/saas/vault.ts dashboard/src/lib/saas/vaultCrypto.ts dashboard/src/lib/saas/safeEndpoint.ts dashboard/scripts/rotate-vault.ts dashboard/tests/foundation.vault.test.ts dashboard/tests/foundation.egress.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(vault): encrypt scoped connections and constrain egress"`.

### Task 7: Accept durable intent with idempotency and transactional outbox

**Files:** Create `dashboard/src/lib/saas/jobs.ts`, `dashboard/src/lib/saas/idempotency.ts`, `dashboard/src/app/api/app/jobs/route.ts`, `dashboard/src/app/api/app/activity/route.ts`. Test: `dashboard/tests/foundation.jobs.test.ts`. Modify `dashboard/src/lib/saas/commands.ts`, `dashboard/src/lib/saas/types.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `JobIntent = { scope: Scope; action: string; resourceId: string; connectionId: string | null; connectionVersion: number | null; arguments: Record<string,unknown>; expectedVersion: number }`; `enqueueJob(intent: JobIntent, idempotencyKey: string, db: Db): Promise<Result<CommandReceipt>>`; `getJob(scope: Scope, jobId: string, db: Db): Promise<Result<{ id: string; state: JobState; requestId: string }>>`; `cancelJob(scope: Scope, jobId: string, expectedVersion: number, db: Db): Promise<Result<void>>`.

- [ ] Write `concurrent same key and payload yields one intent audit and outbox record`, `same key different payload conflicts`, `cross-organization job reads and cancellation are denied`; real DB asserts one job/effect key and stable receipt, distinct namespaces do not collide.

  ```ts
  // concurrent same key and payload yields one durable intent.
  const [first, second] = await Promise.all([
    enqueueJob(intent, 'fixture-request-1', db), enqueueJob(intent, 'fixture-request-1', db)]);
  assert.ok(first.ok && second.ok);
  assert.equal(typeof first.value.jobId, 'string');
  assert.equal(first.value.jobId, second.value.jobId);
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.jobs.test.ts`; expected no durable enqueue/conflict behavior.
- [ ] Implement transactionally unique organization/store/action/resource/**logical operation** effect key plus idempotency key/request digest, intent, audit and outbox. The logical operation is the accepted intent ID: retries reuse its effect key; a later legitimate operation can obtain a new intent/key. Do not create one lifetime key that permanently forbids subsequent actions on a resource. Canonicalize validated arguments, never include raw secret in jobs. Require nonempty bounded idempotency keys; scoped compare-and-set versions; jobs store actor and policy/credential version, not reusable plaintext secrets. Cancellation holds unstarted work; running effect is not marked externally undone. Register job.cancel only after ownership tests pass.
- [ ] GREEN + refactor: focused/common checks plus concurrent local DB proof; transaction failure leaves zero partial intent/outbox.
- [ ] Runtime: restart app after queued dummy intent; scoped job/activity read survives. N/A outbound provider. Rollback: stop acceptance and workers, retain pending intents/idempotency keys; reactivation requires explicit queue choice.
- [ ] Commit: `git add dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/commands.ts dashboard/src/lib/saas/jobs.ts dashboard/src/lib/saas/idempotency.ts dashboard/src/app/api/app/jobs/route.ts dashboard/src/app/api/app/activity/route.ts dashboard/tests/foundation.jobs.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(jobs): persist scoped idempotent intent and outbox"`.

### Task 8: Execute with fenced leases, policy rechecks and unknown outcomes

**Files:** Create `dashboard/src/lib/saas/policy.ts`, `dashboard/src/lib/saas/worker.ts`, `dashboard/src/lib/saas/effects.ts`, `dashboard/scripts/foundation-worker.ts`. Test: `dashboard/tests/foundation.worker.test.ts`. Modify `dashboard/src/lib/saas/types.ts`, `dashboard/src/lib/saas/commands.ts`, `docs/reconstruction/foundation.md`.

**Interfaces:** `ExecutionPolicy = { mode: 'manual'|'assisted'|'autopilot'; killed: boolean; version: number; allowedActions: string[]; approved: boolean }`; `WorkerConfig = { leaseMs: number; maxAttempts: number; backoffMs: number; jitter: () => number }`; `evaluatePolicy(intent: JobIntent, policy: ExecutionPolicy): Result<'execute'|'awaiting_approval'>`; `EffectAdapter = { execute(intent: JobIntent, effectKey: string): Promise<EffectResult>; reconcile(intent: JobIntent, effectKey: string): Promise<EffectResult> }`; `runWorkerOnce(db: Db, adapters: ReadonlyMap<string,EffectAdapter>, clock: Clock, config: WorkerConfig): Promise<{ claimed: number; completed: number; unknown: number }>`; `setKillSwitch(scope: Scope, killed: boolean, expectedVersion: number, db: Db): Promise<Result<void>>`; `setMode(scope: Scope, mode: ExecutionPolicy['mode'], expectedVersion: number, db: Db): Promise<Result<void>>`; `approveJob(scope: Scope, jobId: string, expectedVersion: number, db: Db): Promise<Result<void>>`. Approval checks current role and policy; approval never adds provider capability or paid entitlement.

- [ ] Write `revoked actor or credential cannot execute delayed work`, `two workers cannot both dispatch the same fenced lease`, `timeout after provider acceptance becomes outcome_unknown without blind create retry`, `kill switch holds unstarted work and reconciles in-flight outcome`; assert execute count one, reconcile count increases, unknown never labeled succeeded.

  ```ts
  // timeout after acceptance: seeded job's injected adapter returns { kind: 'unknown' }.
  await runWorkerOnce(db, adapters, clock, config);
  const outcome = await getJob(scope, jobId, db);
  assert.ok(outcome.ok);
  assert.equal(outcome.value.state, 'outcome_unknown');
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.worker.test.ts`; expected missing policy/lease/unknown handling.
- [ ] Implement bounded leased claim with PostgreSQL row locks, unique attempt/effect records and fencing version. Reload current membership/assigned store/credential version/policy immediately at dispatch admission. Serialize dispatch admission against kill/revoke; record dispatching intent before call. Kill committed before admission blocks call; admitted in-flight operation remains visible. Persist external acknowledgment before success. A crash after admission is unknown and reconciled, never blindly replayed.
- [ ] Implement manual/assisted/approved-autopilot decisions without granting operator authority. Cost-bearing actions remain disabled until approved entitlements/funding/limits and adapter plans exist. Retry config (attempt cap/backoff/jitter/lease TTL) explicit required runtime config, not commercial thresholds; tests use a deterministic injected clock/config. Retry only adapter-confirmed transient no-effect failures; unknown/reconcile stays separate. Enabling after kill does not drain held jobs automatically.
- [ ] GREEN + refactor: focused/common checks plus local DB two-worker/restart scenario with a **test-only injected fake adapter**. No fake adapter registered in production registry. Run smoke CLI later supplied by Task 10; no default continuous worker activation.
- [ ] Runtime: worker dies after fake acknowledgment, restart reconciles existing effect; kill between claim/admission prevents dispatch. Rollback: disable worker claims, preserve leases/effects and reconcile uncertain work; reverting code cannot undo spend/publication.
- [ ] Commit: `git add dashboard/src/lib/saas/types.ts dashboard/src/lib/saas/commands.ts dashboard/src/lib/saas/policy.ts dashboard/src/lib/saas/worker.ts dashboard/src/lib/saas/effects.ts dashboard/scripts/foundation-worker.ts dashboard/tests/foundation.worker.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(execution): fence effects and recheck policy before dispatch"`.

### Task 9: Deliver the foundation settings surface with honest readiness

**Files:** Create `dashboard/src/app/app/layout.tsx`, `dashboard/src/app/app/settings/page.tsx`, `dashboard/src/app/app/settings/team/page.tsx`, `dashboard/src/app/app/settings/stores/page.tsx`, `dashboard/src/app/app/settings/integrations/page.tsx`, `dashboard/src/app/app/activity/page.tsx`, `dashboard/src/components/saas/FoundationShell.tsx`, `dashboard/src/components/saas/TeamSettings.tsx`, `dashboard/src/components/saas/StoreSettings.tsx`, `dashboard/src/components/saas/IntegrationSettings.tsx`, `dashboard/src/components/saas/StatusMessage.tsx`, `dashboard/src/components/saas/foundation.css`. Test: `dashboard/tests/foundation.surface.test.ts`. Modify `dashboard/src/middleware.ts`, `dashboard/src/app/layout.tsx`, `docs/reconstruction/foundation.md`.

**Interfaces:** `FoundationShell(props: { scope: Scope; children: React.ReactNode }): React.JSX.Element`; settings components consume sanitized query DTOs and dispatch validated `CommandEnvelope`; `StatusMessage(props: { state: 'loading'|'empty'|'error'|'confirmed'|'pending'; message: string }): React.JSX.Element`. No component receives secrets after save, keyring or trusted role from URL.

- [ ] Write `reader sees data but cannot issue mutations`, `integration shows unconfigured until provider proof exists`, `request failure preserves input and never shows confirmed`, `team/store forms use typed API not chat`. Node tests exercise pure presenter/command controller functions and React server rendering using installed react-dom/server; assert disabled action, secret omission, es-419 state labels and command arguments. These tests do not establish browser accessibility alone.

  ```ts
  // error feedback never renders success; installed react-dom/server supplies rendering.
  import { createElement } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  const html = renderToStaticMarkup(createElement(StatusMessage,
    { state: 'error', message: 'No se pudo guardar. Intenta nuevamente.' }));
  assert.match(html, /No se pudo guardar/);
  assert.doesNotMatch(html, /Guardado confirmado/);
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.surface.test.ts`; expected missing components/controller or untruthful state.
- [ ] Implement approved graphite/light/lime foundation styling and semantic layouts with accessible labeled forms, focus/errors/announced async state, context selector and actual persisted team/store/integration save/revoke operations. Team page accepts a one-time invitation after authenticated email-bound validation; public registration/delivery belongs to later X, so use provisioned test accounts and disclose that limit. Scope verified in server layout/API. Metadata “stored” is not “connected”; explain provider checks pending. No fake “Test connection” success. Unimplemented product routes must not be marketed as completed modules; show foundation scope explicitly until later plans land.
- [ ] GREEN + refactor: focused/common checks plus `npm.cmd run build`. Baseline root/public separation supports future landing: middleware does not treat visitor public shell as authenticated SaaS or let protected data render there. Full landing/signup/recovery remains X, not claimed delivered.
- [ ] Runtime: `npm.cmd run dev`, inspect actual localhost screens at 360px/tablet/desktop, keyboard form/selector/feedback, contrast and reduced-motion; perform team invite/role revoke/store update/vault save-revoke with two accounts and refresh persistence. Record browser/manual results; no invented Playwright runner. If browser tooling absent, report frontend acceptance pending. Rollback: disable foundation navigation/routes, retain schema/state; visual revert must not downgrade API authorization.
- [ ] Commit: `git add dashboard/src/app/app dashboard/src/components/saas dashboard/src/middleware.ts dashboard/src/app/layout.tsx dashboard/tests/foundation.surface.test.ts docs/reconstruction/foundation.md`; `git commit -m "feat(settings): expose persisted foundation operations and readiness"`.

### Task 10: Prove restart, migration restore and isolation before foundation acceptance

**Files:** Create `dashboard/scripts/smoke-foundation.ts`, `docs/reconstruction/foundation-rollout.md`. Test: `dashboard/tests/foundation.acceptance.test.ts`. Modify `docs/reconstruction/foundation.md`. No deployment files or production credentials modified.

**Interfaces:** `runFoundationScenario(databaseUrl: string): Promise<{ isolation: boolean; revocation: boolean; idempotency: boolean; unknownOutcome: boolean; killSwitch: boolean }>` in smoke script; CLI refuses remote/non-test DBs and nonlocal base URLs before connecting. Uses Task 1 harness and Task 8 injected fake adapter, not live providers.

- [ ] Write `foundation scenario rejects remote destination before network access`, `two-organization journey remains isolated across job restart and revoked session`; assert all scenario booleans true only after observed DB/HTTP/worker checks; missing required DB fails prerequisite, not passes.

  ```ts
  // scenario rejects a remote destination before opening any DB/network channel.
  await assert.rejects(() => runFoundationScenario('postgres://fixture:fixture@remote.invalid/alfa_test'),
    /loopback-only/i);
  ```

- [ ] RED: `.\node_modules\.bin\tsx.cmd --test tests/foundation.acceptance.test.ts`; expected missing scenario export, not infrastructure failure.
- [ ] Implement guarded runtime harness: provision disposable users/stores, authenticated commands, masked vault metadata, duplicate job submissions, restart/reconciliation, kill/revoke denial, scoped activity; correlated request/job/action IDs. Write forward migration, backup/restore and application rollback instructions with queue/key handling, local-only rehearsal evidence and explicitly unavailable external proofs. Do not read real deployment secrets.
- [ ] GREEN + refactor: focused command, `.\node_modules\.bin\tsx.cmd scripts/smoke-foundation.ts` with explicitly supplied local test DB/config, `npm.cmd run test:contract`, `.\node_modules\.bin\tsc.cmd --noEmit`, `npm.cmd run build`; from `orchestrator` and `subagent-producto`, run `npm.cmd run test:contract` then `npm.cmd run build`. Record skips/failures separately. No root npm command.
- [ ] Runtime: local disposable forward migration + explicit mapping + restore verification and two-organization full foundation scenario. Gate acceptance on actual replay/restore outputs; report UI review separately. Real OAuth/provider check, checkout, n8n, WhatsApp, Ads and production deployment remain NOT TESTED and gated; provider fixture success is not live acceptance.
- [ ] Commit: `git add dashboard/scripts/smoke-foundation.ts dashboard/tests/foundation.acceptance.test.ts docs/reconstruction/foundation.md docs/reconstruction/foundation-rollout.md`; `git commit -m "test(saas): prove isolated foundation recovery and rollback"`.

## Approval and handoff

No task is checked off by writing this plan. Foundation complete means its own checks passed, **not** all menu modules or the complete SaaS shipped. Continue to X/D/C/H/A/S/W/B subsystem planning only with prerequisite evidence and the user's next-stage decision.

Outstanding gates: execution-method approval; supported runtime/dependency readiness; local disposable PostgreSQL; explicit legacy mapping/root account; key custody/rotation configuration; retry/invite expiry configuration; browser inspection. Later owner/provider/commercial/remote gates are in the roadmap and remain unresolved.

If the selected execution route is SDD, reconcile a **new** reconstruction change using native read-only status and required planning/authority before any apply; the old discovery dispatcher is not reconstruction authorization. No native SDD phase/mutation was executed here. This plan does not authorize remote operations or spend.

**Recommended execution:** bounded subagent-driven units with independent checking of sensitive boundaries, preserving the runtime's native review contract and its user-owned consent. Ask the user to review the plan and choose execution method before any implementation. Respect the requested pause/continue checkpoint before the next implementation stage.

## Self-review record

- Coverage: F detailed here; every nonfoundation requirement is assigned in roadmap, not silently dropped or claimed fully specified.
- Granularity: each unit has behavioral RED, implementation contract, GREEN/refactor, runtime/rollback and code+test+doc commit.
- Types: Scope, Result, CommandEnvelope, JobIntent, Keyring and EffectResult are defined before consumption. FoundationCommand arguments use owning task inputs; role/scope/credential authority comes from server state.
- Review Focus: all five risks have named owning tests, with DB race proof separate from pure unit assertions.
- Proportion: no algorithm bodies or provider-specific guessed APIs; detailed contracts only for first foundation slice.
