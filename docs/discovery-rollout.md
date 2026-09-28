# Safe Discovery Rollout and Rollback

Use this checklist to release the tenant-bound discovery path. Controlled smoke results do not prove live provider, account, network, or platform reliability.

## Rollout order

1. **Back up and preflight.** Take a verified backup of the actual ALFA database. Confirm the deployed schema/version and inspect for duplicate non-null `(tenant_id, source, external_id)` keys; record a tenant-safe resolution without deleting or merging rows.
2. **Apply schema first.** Apply migration `002_discovery_evidence.sql` only after the deployed schema and duplicate preflight are confirmed. Verify the nullable evidence column and partial unique index before deploying code.
3. **Configure server-owned trust.** Set distinct nonempty `DASHBOARD_ORCHESTRATOR_TOKEN` and `ORCHESTRATOR_PRODUCT_TOKEN` values, the matching orchestrator-side token configuration, and the server-owned `ALFA_TENANT_ID` in the deployment secret/configuration store. Do not commit real credentials. Compose interpolation and service startup must fail clearly if required values are absent or invalid.
4. **Deploy the trust boundary together.** Deploy the protected orchestrator and authenticated dashboard chat proxy in the same rollout. Keep the orchestrator on `alfa-network` only, with no Traefik route or published host port; the dashboard remains the public application entry point.
5. **Check legacy callers fail closed.** Confirm the legacy direct n8n product-tool request without the internal product credential receives an unauthorized response before discovery or persistence. Do not weaken the guard to preserve the old call path; migrating n8n is separate scope.
6. **Verify before live access.** Run all three focused contract suites, all three package builds, and the controlled smoke against an explicitly disposable loopback PostgreSQL database using `ALFA_SMOKE_DATABASE_URL`. A skipped/blocked database smoke is not a pass.
7. **Enable live read-only Dropi last.** Only after stable source IDs/selectors are verified against the real account should live read-only catalog access be enabled. Keep publishing, Shopify writes, Ads, social, and n8n mutations outside this journey.

## Rollback boundary

1. Disable the discovery entry point first, then revert the dashboard, orchestrator, and product service protections/integration together. Do not restore a public orchestrator route or unguarded product tools.
2. Retain the additive `evaluations.evidence` column and product identity index throughout the compatibility window while any running code or evidence consumer may use them.
3. Drop additive schema only after a verified backup and an explicit evidence-consumer check. Never delete product or evaluation rows as part of rollback.
4. Record which verification gates were actually run. Mark live credentials, Dropi selectors/account behavior, private networking, and platform reliability unverified unless each was directly demonstrated.

## Current evidence boundary

The repository contains the rollout/rollback procedure and deterministic fixture harness. The deployed schema, production backup, live secrets, n8n behavior in the deployed environment, tunnel/network path, Dropi selectors, and Dokploy reliability remain unverified until the authorized deployment operator records direct evidence.
