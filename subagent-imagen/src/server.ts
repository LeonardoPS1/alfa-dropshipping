import 'dotenv/config';
import express from 'express';
import path from 'path';
import { generateProductImage } from './tools/generateProductImage';
import { generateAdCreative } from './tools/generateAdCreative';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Sirve los assets generados como estático — el volumen alfa-assets se
// expone también públicamente vía Traefik en assets.aicorebots.com.
app.use('/assets', express.static(process.env.ASSET_STORAGE_PATH ?? '/data/assets'));

const TOOL_SCHEMAS = [
  {
    name: 'generate_product_image',
    description: 'Genera imágenes de producto (fondo estudio o lifestyle) para un producto ya guardado.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        style: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'generate_ad_creative',
    description: 'Genera un creativo de imagen para anuncio pago, en el aspect ratio correcto por plataforma, opcionalmente alineado a un copy ya generado.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        platform: { type: 'string', enum: ['meta', 'tiktok'] },
        copy_id: { type: 'string' },
      },
      required: ['product_id', 'platform'],
    },
  },
];

app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

app.post('/tools/generate_product_image', async (req, res) => {
  try {
    res.json(await generateProductImage(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/generate_ad_creative', async (req, res) => {
  try {
    res.json(await generateAdCreative(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT ?? 4003);
app.listen(PORT, () => console.log(`[subagent-imagen] escuchando en :${PORT}`));
