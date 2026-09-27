import 'dotenv/config';
import express from 'express';
import { createCampaign } from './tools/createCampaign';
import { setBudget } from './tools/setBudget';
import { pauseUnderperformer, pauseCampaignService } from './tools/pauseUnderperformer';
import { getRoas } from './tools/getRoas';
import { pool } from './db/pool';
import { getMetaCampaignInsights } from './providers/metaMarketingClient';
import { getTikTokCampaignInsights } from './providers/tiktokAdsClient';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

const TOOL_SCHEMAS = [
  {
    name: 'create_campaign',
    description: 'Crea una campaña paga (Meta o TikTok) para un producto, con test A/B entre los creativos dados.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        platform: { type: 'string', enum: ['meta', 'tiktok'] },
        budget: { type: 'number' },
        creative_ids: { type: 'array', items: { type: 'string' } },
        objective: { type: 'string' },
      },
      required: ['product_id', 'platform', 'budget', 'creative_ids'],
    },
  },
  {
    name: 'set_budget',
    description: 'Actualiza el presupuesto diario de una campaña activa.',
    parameters: {
      type: 'object',
      properties: { campaign_id: { type: 'string' }, new_budget: { type: 'number' } },
      required: ['campaign_id', 'new_budget'],
    },
  },
  {
    name: 'pause_underperformer',
    description: 'Pausa una campaña. Debe llamarse después de revisar get_roas para justificar la decisión.',
    parameters: {
      type: 'object',
      properties: { campaign_id: { type: 'string' }, reason: { type: 'string' } },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_roas',
    description: 'Calcula el ROAS actual de una campaña (o de todas las activas) cruzando spend de la plataforma con revenue real de Shopify.',
    parameters: {
      type: 'object',
      properties: { campaign_id: { type: 'string' } },
    },
  },
];

app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

app.post('/tools/create_campaign', async (req, res) => {
  try {
    res.json(await createCampaign(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/set_budget', async (req, res) => {
  try {
    res.json(await setBudget(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/pause_underperformer', async (req, res) => {
  try {
    res.json(await pauseUnderperformer(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/get_roas', async (req, res) => {
  try {
    res.json(await getRoas(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Endpoints internos, solo para n8n (Fase 6.5 — motor de auto-optimización) =====
function requireInternalToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.header('X-Internal-Token') !== process.env.INTERNAL_AUTOMATION_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.get('/internal/campaigns/active', requireInternalToken, async (_req, res) => {
  const activeRes = await pool.query(`SELECT * FROM campaigns WHERE status = 'active'`);
  const results = [];

  for (const campaign of activeRes.rows) {
    const insights =
      campaign.platform === 'meta'
        ? await getMetaCampaignInsights(campaign.platform_campaign_id)
        : await getTikTokCampaignInsights(campaign.platform_campaign_id);

    const revenueRes = await pool.query(`SELECT COALESCE(SUM(revenue), 0) AS revenue FROM orders WHERE product_id = $1`, [
      campaign.product_id,
    ]);
    const revenue = Number(revenueRes.rows[0].revenue);
    const roas = insights.spend > 0 ? revenue / insights.spend : 0;

    results.push({
      id: campaign.id,
      tenant_id: campaign.tenant_id,
      product_id: campaign.product_id,
      platform: campaign.platform,
      spend: insights.spend,
      revenue,
      roas: Number(roas.toFixed(2)),
    });
  }

  res.json({ campaigns: results });
});

app.post('/internal/campaigns/:id/auto-pause', requireInternalToken, async (req, res) => {
  try {
    const reason = req.body?.reason ?? 'ROAS por debajo del umbral configurado';
    const result = await pauseCampaignService(req.params.id, reason, 'auto_pause_cron');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT ?? 4006);
app.listen(PORT, () => console.log(`[subagent-ads] escuchando en :${PORT}`));
