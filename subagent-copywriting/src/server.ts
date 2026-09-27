import 'dotenv/config';
import express from 'express';
import { generateAdCopy } from './tools/generateAdCopy';
import { generateProductDescription } from './tools/generateProductDescription';
import { generateCaptionsRRSS } from './tools/generateCaptionsRRSS';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

const TOOL_SCHEMAS = [
  {
    name: 'generate_ad_copy',
    description: 'Genera variantes de copy publicitario para un producto, por ángulo (problema, beneficio, prueba social).',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        platform: { type: 'string', enum: ['meta', 'tiktok'] },
        variants: { type: 'number' },
      },
      required: ['product_id', 'platform'],
    },
  },
  {
    name: 'generate_product_description',
    description: 'Genera la descripción de ficha de producto lista para Shopify.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        length: { type: 'string', enum: ['short', 'long'] },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'generate_captions_rrss',
    description: 'Genera captions con hashtags para Instagram o TikTok de un producto.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        platform: { type: 'string', enum: ['instagram', 'tiktok'] },
        count: { type: 'number' },
      },
      required: ['product_id', 'platform'],
    },
  },
];

app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

app.post('/tools/generate_ad_copy', async (req, res) => {
  try {
    res.json(await generateAdCopy(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/generate_product_description', async (req, res) => {
  try {
    res.json(await generateProductDescription(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/generate_captions_rrss', async (req, res) => {
  try {
    res.json(await generateCaptionsRRSS(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT ?? 4002);
app.listen(PORT, () => console.log(`[subagent-copywriting] escuchando en :${PORT}`));
