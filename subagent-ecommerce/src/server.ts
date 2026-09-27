import 'dotenv/config';
import express from 'express';
import { createProductListing } from './tools/createProductListing';
import { updateStock } from './tools/updateStock';
import { syncOrder } from './tools/syncOrder';
import { getSalesMetrics } from './tools/getSalesMetrics';
import { webhooksRouter } from './webhooks/router';

const app = express();

// El router de webhooks necesita el body crudo (para el HMAC), por eso se
// monta ANTES del express.json() global, que solo aplica a /tools/*.
app.use('/webhooks', webhooksRouter);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

const TOOL_SCHEMAS = [
  {
    name: 'create_product_listing',
    description: 'Publica un producto ya evaluado en Shopify como borrador (draft), con su descripción e imágenes.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        description_id: { type: 'string' },
        image_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'update_stock',
    description: 'Actualiza el stock disponible de un producto ya publicado en Shopify.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        quantity: { type: 'number' },
        location_id: { type: 'string' },
      },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'sync_order',
    description: 'Reconcilia manualmente una orden puntual de Shopify contra la base interna.',
    parameters: {
      type: 'object',
      properties: { shopify_order_id: { type: 'string' } },
      required: ['shopify_order_id'],
    },
  },
  {
    name: 'get_sales_metrics',
    description: 'Devuelve métricas de ventas (unidades, revenue, ticket promedio) para un producto o para toda la tienda.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        date_from: { type: 'string' },
        date_to: { type: 'string' },
      },
    },
  },
];

app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

app.post('/tools/create_product_listing', async (req, res) => {
  try {
    res.json(await createProductListing(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/update_stock', async (req, res) => {
  try {
    res.json(await updateStock(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/sync_order', async (req, res) => {
  try {
    res.json(await syncOrder(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/get_sales_metrics', async (req, res) => {
  try {
    res.json(await getSalesMetrics(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT ?? 4004);
app.listen(PORT, () => console.log(`[subagent-ecommerce] escuchando en :${PORT}`));
