import 'dotenv/config';
import express from 'express';
import { schedulePost } from './tools/schedulePost';
import { publishPost } from './tools/publishPost';
import { replyDm } from './tools/replyDm';
import { getEngagementMetrics } from './tools/getEngagementMetrics';
import { startScheduledPostsWorker } from './scheduler/worker';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

const TOOL_SCHEMAS = [
  {
    name: 'schedule_post',
    description: 'Programa la publicación de un creativo (imagen/video) en Instagram o TikTok para una fecha futura.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        creative_id: { type: 'string' },
        platform: { type: 'string', enum: ['instagram', 'tiktok'] },
        scheduled_at: { type: 'string', description: 'Fecha/hora ISO 8601' },
      },
      required: ['product_id', 'creative_id', 'platform', 'scheduled_at'],
    },
  },
  {
    name: 'publish_post',
    description: 'Publica inmediatamente un post (o dispara uno ya programado por su scheduled_post_id).',
    parameters: {
      type: 'object',
      properties: {
        scheduled_post_id: { type: 'string' },
        product_id: { type: 'string' },
        creative_id: { type: 'string' },
        platform: { type: 'string', enum: ['instagram', 'tiktok'] },
      },
    },
  },
  {
    name: 'reply_dm',
    description: 'Envía un mensaje directo ya redactado a una conversación de Instagram o TikTok.',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['instagram', 'tiktok'] },
        conversation_id: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['platform', 'conversation_id', 'message'],
    },
  },
  {
    name: 'get_engagement_metrics',
    description: 'Obtiene likes, comentarios, shares y alcance de un post ya publicado.',
    parameters: {
      type: 'object',
      properties: { scheduled_post_id: { type: 'string' } },
      required: ['scheduled_post_id'],
    },
  },
];

app.get('/tools', (_req, res) => res.json({ tools: TOOL_SCHEMAS }));

app.post('/tools/schedule_post', async (req, res) => {
  try {
    res.json(await schedulePost(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/publish_post', async (req, res) => {
  try {
    res.json(await publishPost(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/reply_dm', async (req, res) => {
  try {
    res.json(await replyDm(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/get_engagement_metrics', async (req, res) => {
  try {
    res.json(await getEngagementMetrics(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

startScheduledPostsWorker();

const PORT = Number(process.env.PORT ?? 4005);
app.listen(PORT, () => console.log(`[subagent-rrss] escuchando en :${PORT}`));
