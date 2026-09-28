# Safe Discovery Rollout and Rollback

Use this checklist to release the tenant-bound discovery path. Controlled smoke results do not prove live provider, account, network, or platform reliability.

## Dokploy and network prerequisites

- Deploy this multi-service repository as a Dokploy Docker Compose service/project, not as a single-service Application. The verified target currently has an empty Application and no Compose services; neither is evidence that this Compose stack is deployed.
- Create or verify the external, attachable `alfa-private` network before applying this Compose file. Connect the required infrastructure services (including PostgreSQL/PgBouncer and Redis, plus any configured n8n endpoint) to that network in their owning infrastructure Compose configuration. The observed infrastructure services currently use only their own Compose bridge, so cross-stack DNS/connectivity is not yet proven.
- Keep `dokploy-network` as the external Dokploy routing network. Only services with public Traefik routes attach to it. `alfa-network` is a Compose-managed bridge for ALFA service-to-service calls; it is not a Swarm overlay dependency. No service name or `container_name` is pinned, so validate actual infra DNS aliases against the configured connection URLs before rollout.
- The ALFA Compose file requires both external networks to exist. Network creation, infrastructure attachment, name resolution, and deployment readiness remain operator preflight actions and must be directly verified; this repository change does not perform them.

## Rollout order

1. **Back up and preflight.** Take a verified backup of the actual ALFA database. Confirm the deployed schema/version and inspect for duplicate non-null `(tenant_id, source, external_id)` keys; record a tenant-safe resolution without deleting or merging rows.
2. **Apply schema first.** Apply migration `002_discovery_evidence.sql` only after the deployed schema and duplicate preflight are confirmed. Verify the nullable evidence column and partial unique index before deploying code.
3. **Configure server-owned trust.** Set distinct nonempty `DASHBOARD_ORCHESTRATOR_TOKEN` and `ORCHESTRATOR_PRODUCT_TOKEN` values, the matching orchestrator-side token configuration, and the server-owned `ALFA_TENANT_ID` in the deployment secret/configuration store. Do not commit real credentials. Compose interpolation and service startup must fail clearly if required values are absent or invalid.
4. **Deploy the trust boundary together.** Deploy the protected orchestrator and authenticated dashboard chat proxy in the same rollout. Keep the orchestrator on the Compose-managed `alfa-network` and private `alfa-private` dependency network, with no attachment to `dokploy-network`, Traefik route, or published host port. Publicly routed services alone attach to `dokploy-network`; the dashboard is the discovery entry point.
5. **Check legacy callers fail closed.** Confirm the legacy direct n8n product-tool request without the internal product credential receives an unauthorized response before discovery or persistence. Do not weaken the guard to preserve the old call path; migrating n8n is separate scope.
6. **Verify before live access.** Run all three focused contract suites, all three package builds, and the controlled smoke against an explicitly disposable loopback PostgreSQL database using `ALFA_SMOKE_DATABASE_URL`. A skipped/blocked database smoke is not a pass.
7. **Enable live read-only Dropi last.** Only after stable source IDs/selectors are verified against the real account should live read-only catalog access be enabled. Keep publishing, Shopify writes, Ads, social, and n8n mutations outside this journey.

## Rollback boundary

1. Disable the discovery entry point first, then revert the dashboard, orchestrator, and product service protections/integration together. Do not restore a public orchestrator route or unguarded product tools.
2. Retain the additive `evaluations.evidence` column and product identity index throughout the compatibility window while any running code or evidence consumer may use them.
3. Drop additive schema only after a verified backup and an explicit evidence-consumer check. Never delete product or evaluation rows as part of rollback.
4. Record which verification gates were actually run. Mark live credentials, Dropi selectors/account behavior, private networking, and platform reliability unverified unless each was directly demonstrated.

## Current evidence boundary

The repository contains the rollout/rollback procedure and deterministic fixture harness. A parent-run controlled smoke passed against a newly created, migrated disposable PostgreSQL 17.9 database through a verified local tunnel. It persisted one product and one incomplete evaluation, retained a null total score, linked two audit rows, and observed zero forbidden transports; live integrations were skipped. After the Dokploy compatibility correction, the parent parsed the exact Compose file through authorized VPS Docker stdin with fictitious required credential/tenant values: `docker compose -f - config -q` exited 0. The command created no file or service. Optional variables defaulted blank and the top-level Compose `version` field was reported obsolete; this proves syntax only, not deployment readiness or valid production configuration.

These checks verify the repository candidate and disposable journey only. They do not prove a production backup/schema state, populated deployment secrets, deployed n8n behavior, `alfa-private` infrastructure attachment/DNS/connectivity, live Dropi selectors or credentials, or Dokploy/platform reliability. Those remain unverified until the authorized deployment operator records direct evidence.

The smoke guard accepts only a plain loopback PostgreSQL URL with no query parameters. The installed `pg-connection-string` parser treats query parameters as configuration overrides, including `host`; the guard rejects them before constructing a database pool.
