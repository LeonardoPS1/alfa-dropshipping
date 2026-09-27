# ALFA — Agente de dropshipping con subagentes

ALFA es un agente orquestador (LLM con function-calling) que coordina 6 subagentes especializados, cada uno un servidor MCP independiente, para llevar un producto de dropshipping desde su descubrimiento hasta la campaña paga activa, con auto-optimización continua.

Diseñado para correr sobre infraestructura self-hosted existente: Docker Swarm + Dokploy + Traefik + Postgres + Redis + n8n, bajo el dominio `aicorebots.com`.

## Arquitectura

```
                    ┌─────────────────────────┐
                    │   ALFA (orquestador)     │
                    │   LLM + function-calling │
                    └────────────┬─────────────┘
                                 │ MCP (HTTP)
        ┌───────────┬────────────┼────────────┬───────────┬───────────┐
        ▼           ▼            ▼            ▼           ▼           ▼
   ┌─────────┐ ┌───────────┐ ┌────────┐ ┌───────────┐ ┌───────┐ ┌─────────┐
   │Producto │ │Copywriting│ │ Imagen │ │ Ecommerce │ │ RRSS  │ │  Ads    │
   │ :4001   │ │  :4002    │ │ :4003  │ │ (Shopify) │ │ :4005 │ │ :4006   │
   │         │ │           │ │        │ │  :4004    │ │       │ │         │
   └─────────┘ └───────────┘ └────────┘ └───────────┘ └───────┘ └─────────┘
```

Cada subagente expone:
- `GET /tools` — schema de sus tools (function-calling), que ALFA descubre al arrancar.
- `POST /tools/:tool_name` — ejecución de cada tool.

El **dashboard** (Next.js, puerto 3000 interno) es solo lectura de Postgres + un proxy de chat hacia ALFA; ninguna escritura ocurre desde ahí, para que `agent_logs` quede como registro completo de todo lo que pasa en el sistema.

## Servicios

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| `alfa-orchestrator` | 3000 | Orquestador ALFA — recibe `/chat`, decide qué subagentes llamar |
| `alfa-subagent-producto` | 4001 | Scouting de tendencias (TikTok), catálogo Dropi, scoring, saturación, compliance |
| `alfa-subagent-copywriting` | 4002 | Copy de anuncios, descripciones de producto, captions RRSS |
| `alfa-subagent-imagen` | 4003 | Generación de imágenes de producto y creativos de ads |
| `alfa-subagent-ecommerce` | 4004 | Integración Shopify (Admin API GraphQL + webhooks de órdenes) |
| `alfa-subagent-rrss` | 4005 | Publicación orgánica en Instagram/TikTok, DMs, métricas de engagement |
| `alfa-subagent-ads` | 4006 | Campañas pagas Meta/TikTok, presupuesto, ROAS, auto-pausa |
| `alfa-dashboard` | 3000 | UI: pipeline, chat, campañas, detalle de producto |

## Deploy en Dokploy

1. Clonar este repo en el VPS o subirlo como app de Dokploy apuntando a este repositorio.
2. Copiar `.env.example` a `.env` y completar todas las credenciales (ver detalle abajo).
3. Verificar que la red `shared-network` externa exista y sea la misma donde corren tu Postgres/Redis compartidos.
4. `docker compose up -d --build`.
5. Confirmar en los logs de `alfa-orchestrator` que los 6 subagentes se registraron correctamente (`[registry] <key> registrado con N tools`).
6. Correr la migración `db/migrations/001_init.sql` contra la base `alfa_db` (podés crearla como base nueva en tu instancia Postgres compartida).
7. Importar los 3 workflows de `n8n-workflows/` en tu instancia de n8n existente.
8. Configurar el webhook de Shopify (`orders/create`, `orders/updated`) apuntando a `https://ecommerce.alfa.aicorebots.com/webhooks/shopify` (ver mutation `webhookSubscriptionCreate` en `subagent-ecommerce/src/shopify/mutations.ts`).

## Variables de entorno requeridas

Ver `.env.example` completo. Resumen por servicio:

- **Base y LLM**: `DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
- **Producto**: `DROPI_EMAIL`, `DROPI_PASSWORD`, `META_AD_LIBRARY_TOKEN`.
- **Imagen**: `IMAGE_PROVIDER_API_KEY`, `IMAGE_PROVIDER_BASE_URL`, `ASSET_PUBLIC_BASE_URL`.
- **Ecommerce**: `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`.
- **RRSS/Ads**: `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`, `META_MARKETING_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`.
- **Automatización**: `INTERNAL_AUTOMATION_TOKEN` (protege los endpoints `/internal/*` que consume n8n — nunca exponer vía Traefik).
- **Dashboard**: `NEXTAUTH_SECRET`, `DASHBOARD_ADMIN_EMAIL`, `DASHBOARD_ADMIN_PASSWORD_HASH` (generar el hash con `bcrypt`, nunca guardar la contraseña en texto plano).

## Flujo típico de uso (vía chat o dashboard)

1. `"buscame productos de belleza que estén sonando en tiktok"` → `search_trends`
2. `"evalúa el producto X"` → `score_product` (dispara `check_ad_saturation` automáticamente si no hay chequeo reciente)
3. `"generame copy e imágenes para el producto X"` → `generate_ad_copy` + `generate_product_image`
4. `"publicá el producto X en shopify"` → `create_product_listing`
5. `"lanzá una campaña de $X en meta para el producto X"` → `create_campaign`
6. El motor de auto-optimización (n8n, cada 4h) revisa ROAS y pausa/reemplaza automáticamente lo que no funciona.

## Multi-tenant

Todas las tablas llevan `tenant_id` desde el día 1, aunque hoy se opera con un único tenant por defecto (`00000000-0000-0000-0000-000000000001`). Si en algún momento se ofrece ALFA como servicio a otros dropshippers, no hace falta migrar el esquema.

## Auditoría

Toda llamada a cualquier tool de cualquier subagente queda registrada en `agent_logs` (subagente, tool, input, output, metadata), incluyendo si fue disparada por el chat o por automatización (`metadata.triggered_by`). Tokens y credenciales se sanitizan antes de loguearse.

## Estructura del repo

```
alfa-agent/
├── docker-compose.yml
├── .env.example
├── db/migrations/001_init.sql
├── orchestrator/           # ALFA
├── subagent-producto/
├── subagent-copywriting/
├── subagent-imagen/
├── subagent-ecommerce/
├── subagent-rrss/
├── subagent-ads/
├── dashboard/
└── n8n-workflows/          # importables directo en n8n
```

## Notas importantes antes de producción

- Los selectores de scraping de TikTok Creative Center (`scrapeTikTokTrends`) y Dropi (`scrapeDropiCatalog`) están escritos contra la estructura pública actual de esas páginas — si cambian su HTML, ajustar los selectores en `subagent-producto/src/scrapers/`.
- `updateStock` asume `shopify_variant_id` como `inventory_item_id` directo; en catálogos con variantes reales conviene resolver el `inventoryItem.id` explícitamente vía una query adicional a Shopify.
- Los `location_ids` de TikTok Ads y el `META_PAGE_ID` de Meta son valores que hay que completar con los reales de tu cuenta antes de lanzar campañas.
- El proveedor de imagen (`fluxClient.ts`) está escrito contra la API de BFL/Flux como referencia — si se usa otro proveedor, ajustar el cliente sin tocar las tools que lo consumen.
