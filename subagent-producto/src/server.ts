import 'dotenv/config';
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { searchTrends } from './tools/searchTrends';
import { searchDropiCatalog } from './tools/searchDropiCatalog';
import { scoreProduct } from './tools/scoreProduct';
import { checkAdSaturation } from './tools/checkAdSaturation';
import { checkImportCompliance } from './tools/checkImportCompliance';
import { pool } from './db/pool';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProductServerDependencies {
  discoveryToken?: string;
  searchDropiCatalog?: typeof searchDropiCatalog;
  scoreProduct?: typeof scoreProduct;
}

export interface ProductServiceConfig {
  discoveryToken: string;
}

export class ProductServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductServiceConfigurationError';
  }
}

export function loadProductServiceConfig(env: Record<string, string | undefined> = process.env): ProductServiceConfig {
  const discoveryToken = env.ORCHESTRATOR_PRODUCT_TOKEN?.trim() ?? '';
  if (!discoveryToken) throw new ProductServiceConfigurationError('ORCHESTRATOR_PRODUCT_TOKEN is required');
  if (/^REPLACE_WITH_/i.test(discoveryToken)) {
    throw new ProductServiceConfigurationError('ORCHESTRATOR_PRODUCT_TOKEN must not be an example placeholder');
  }
  return { discoveryToken };
}

export function createProductApp(dependencies: ProductServerDependencies = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const expectedToken = dependencies.discoveryToken ?? process.env.ORCHESTRATOR_PRODUCT_TOKEN ?? '';
  const searchCatalog = dependencies.searchDropiCatalog ?? searchDropiCatalog;
  const scoreCatalogProduct = dependencies.scoreProduct ?? scoreProduct;

  function requireDiscoveryContext(req: express.Request, res: express.Response, next: express.NextFunction) {
    const suppliedToken = req.header('X-Alfa-Internal-Token') ?? '';
    const trustedTenantId = req.header('X-Alfa-Tenant-Id') ?? '';
    const requestId = req.header('X-Alfa-Request-Id') ?? '';

    if (!expectedToken || !suppliedToken) return res.status(401).json({ error: 'unauthorized' });
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!UUID_PATTERN.test(trustedTenantId) || !UUID_PATTERN.test(requestId)) {
      return res.status(400).json({ error: 'invalid trusted request context' });
    }
    if (req.body?.tenant_id && req.body.tenant_id !== trustedTenantId) {
      return res.status(400).json({ error: 'tenant context mismatch' });
    }

    res.locals.discoveryContext = { tenant_id: trustedTenantId, request_id: requestId };
    next();
  }

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Schema JSON compatible con function-calling, consumido por el orquestador al arrancar.
  const TOOL_SCHEMAS = [
    {
      name: 'search_trends',
      description: 'Busca productos en tendencia en TikTok (Creative Center) para un nicho dado y los guarda en la base.',
      parameters: {
        type: 'object',
        properties: {
          niche: { type: 'string', description: 'Nicho o categoría a buscar, ej. "belleza"' },
          limit: { type: 'number', description: 'Cantidad máxima de resultados' },
        },
      },
    },
    {
      name: 'search_dropi_catalog',
      description: 'Busca productos en el catálogo de la cuenta de Dropi Chile del usuario y los guarda en la base.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto de búsqueda' },
          category: { type: 'string', description: 'Categoría de Dropi a filtrar' },
        },
      },
    },
    {
      name: 'score_product',
      description: 'Calcula el score de viabilidad (demanda, competencia, margen, envío) de un producto ya guardado.',
      parameters: {
        type: 'object',
        properties: { product_id: { type: 'string' } },
        required: ['product_id'],
      },
    },
    {
      name: 'check_ad_saturation',
      description: 'Cuenta anuncios activos de terceros para un producto en Meta Ad Library y marca si está saturado.',
      parameters: {
        type: 'object',
        properties: { product_id: { type: 'string' } },
        required: ['product_id'],
      },
    },
    {
      name: 'check_import_compliance',
      description: 'Verifica si la categoría de un producto está restringida para importación/venta en Chile.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['product_id', 'category'],
      },
    },
  ];

  app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

  app.post('/tools/search_trends', async (req, res) => {
    try {
      res.json(await searchTrends(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/search_dropi_catalog', requireDiscoveryContext, async (req, res) => {
    try {
      res.json(await searchCatalog({ ...req.body, ...res.locals.discoveryContext }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/score_product', requireDiscoveryContext, async (req, res) => {
    try {
      res.json(await scoreCatalogProduct({ ...req.body, tenant_id: res.locals.discoveryContext.tenant_id }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/check_ad_saturation', async (req, res) => {
    try {
      res.json(await checkAdSaturation(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/tools/check_import_compliance', async (req, res) => {
    try {
      res.json(await checkImportCompliance(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== Endpoints internos, solo para automatización vía n8n (Fase 6.5) =====
  function requireInternalToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.header('X-Internal-Token') !== process.env.INTERNAL_AUTOMATION_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  }

  app.get('/internal/products/pending-saturation-check', requireInternalToken, async (_req, res) => {
    const result = await pool.query(`
      SELECT p.id, p.tenant_id, p.name
      FROM products p
      JOIN evaluations e ON e.product_id = p.id
      WHERE e.created_at > now() - interval '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM saturation_checks sc
          WHERE sc.product_id = p.id AND sc.checked_at > now() - interval '24 hours'
        )
      GROUP BY p.id, p.tenant_id, p.name
    `);
    res.json({ products: result.rows });
  });

  app.get('/internal/products/pending-compliance-check', requireInternalToken, async (_req, res) => {
    const result = await pool.query(`
      SELECT p.id, p.tenant_id, p.name, p.category
      FROM products p
      WHERE p.created_at > now() - interval '7 days'
        AND NOT EXISTS (SELECT 1 FROM compliance_flags cf WHERE cf.product_id = p.id)
        AND p.category IS NOT NULL
    `);
    res.json({ products: result.rows });
  });

  return app;
}

const PORT = Number(process.env.PORT ?? 4001);
if (require.main === module) {
  try {
    loadProductServiceConfig();
    createProductApp().listen(PORT, () => console.log(`[subagent-producto] escuchando en :${PORT}`));
  } catch (error) {
    console.error('[subagent-producto] fatal startup configuration error', error instanceof Error ? error.message : 'unknown');
    process.exit(1);
  }
}
