import 'dotenv/config';
import express from 'express';
import { chatRouter } from './routes/chat';
import { discoverSubagents } from './mcp/registry';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/chat', chatRouter);

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  console.log('[alfa] descubriendo subagentes...');
  await discoverSubagents();
  app.listen(PORT, () => console.log(`[alfa] orquestador escuchando en :${PORT}`));
}

main().catch((err) => {
  console.error('[alfa] error fatal al arrancar', err);
  process.exit(1);
});
