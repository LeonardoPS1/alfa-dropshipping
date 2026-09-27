# Deployment guide

This guide describes the intended deployment sequence and the current safety boundary. No deployment has been performed. Do not deploy this partial snapshot until the pending security and migration tasks below are complete.

## Service roles

| Role | Service | Exposure |
|---|---|---|
| Orchestration | `alfa-orchestrator` | Private service-to-service endpoint only; the current Compose file still has a public Traefik route that must be removed before deployment. |
| Product discovery | `alfa-subagent-producto` | Private to the application network; require a distinct orchestrator credential and trusted tenant. |
| Other subagents | Copywriting, image, ecommerce, social, and ads | Private service-to-service endpoints; expose only explicitly required public callbacks/assets. |
| Dashboard | `alfa-dashboard` | Public UI behind Traefik/TLS; authenticate users and proxy chat server-side. |
| Shared infrastructure | Postgres, Redis, n8n | Existing shared services on the external `shared-network`; verify actual service/network names before rollout. |

Never publish internal automation endpoints or subagent ports through Traefik. Keep provider and service credentials out of browser responses, provider messages, audit logs, and workflow exports.

## Configuration names

Populate secret values only in the authorized Dokploy secret/environment store. Do not commit values to Git. `.env.example` contains placeholders and the currently declared application settings.

| Purpose | Environment variable names |
|---|---|
| Database/cache | `DATABASE_URL`, `REDIS_URL` |
| LLM | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_MODEL_COPY` |
| Product discovery | `DROPI_EMAIL`, `DROPI_PASSWORD`, `META_AD_LIBRARY_TOKEN`, `ORCHESTRATOR_PRODUCT_TOKEN` (required by the product auth boundary; Compose wiring is pending) |
| Dashboard/orchestrator trust boundary | The dashboard-to-orchestrator credential and server-owned tenant UUID are required by the design, but their environment-variable names are not yet defined in code/spec. Keep placeholder values in the authorized secret store only after the implementation defines and validates the names. |
| Image assets | `IMAGE_PROVIDER_API_KEY`, `IMAGE_PROVIDER_BASE_URL`, `ASSET_STORAGE_PATH`, `ASSET_PUBLIC_BASE_URL` |
| Shopify | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_WEBHOOK_SECRET` |
| Meta/TikTok | `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`, `META_MARKETING_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` |
| Automation | `ROAS_PAUSE_THRESHOLD`, `INTERNAL_AUTOMATION_TOKEN` |
| Dashboard auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DASHBOARD_ADMIN_EMAIL`, `DASHBOARD_ADMIN_PASSWORD_HASH` |
| Local-only verification | `LOCAL_TEST_DATABASE_URL`; `ALFA_SMOKE_DATABASE_URL` for the future controlled smoke harness. Use disposable databases only; the smoke URL must never fall back to production `DATABASE_URL`. |

These names identify configuration slots only; they are not evidence that the values, deployed secrets, routes, or integrations have been provisioned.

## Rollout order

1. **Preflight:** authorize the exact deployment target and operation; inspect the deployed schema and existing product/evaluation duplicates; take and verify a backup. Do not proceed on assumptions.
2. **Rehearse migration:** apply and reverse `db/migrations/002_discovery_evidence.sql` against an explicitly disposable local PostgreSQL database. Confirm the unique key and tenant behavior; retain data and document recovery evidence.
3. **Configure secrets:** provision distinct nonempty service credentials and the server-owned tenant UUID in Dokploy. Verify startup validation without printing or logging values.
4. **Deploy the security boundary together:** remove the public orchestrator route and deploy product auth, bounded orchestrator transport, and authenticated dashboard proxy as one compatible rollout. Keep subagent/internal routes private.
5. **Apply schema before dependent code:** after backup and schema preflight, apply migration `002_discovery_evidence.sql` before deploying code that reads or writes its evidence column/index. Preserve additive schema during the compatibility window.
6. **Verify:** run the focused contract suites and builds; run the controlled discovery smoke only with an explicit disposable `ALFA_SMOKE_DATABASE_URL`; check service health, expected registry entries, tenant-scoped reads, and fail-closed auth. Treat missing PostgreSQL as blocked, not passed.
7. **Enable live discovery cautiously:** only after stable product identifiers and selectors are verified; keep external publishing/ads actions out of this read-only discovery rollout.

## Rollback

Disable the discovery entry point and revert the dashboard, orchestrator, and product-service changes together. Keep the additive column and index during the compatibility window; reverse them only after a backup and an explicit review of evidence consumers. Never delete product/evaluation rows, restore public orchestrator routing, or restore unguarded internal tools as a shortcut. If rollback is needed, preserve logs/evidence with secrets redacted and record the actual outcome.
