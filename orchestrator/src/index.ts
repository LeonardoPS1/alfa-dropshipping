import 'dotenv/config';
import express from 'express';
import { loadOrchestratorConfig, OrchestratorConfig } from './config';
import { createChatRouter } from './routes/chat';

const PORT = Number(process.env.PORT ?? 3000);

export function createOrchestratorApp(config: OrchestratorConfig = loadOrchestratorConfig()) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/chat', createChatRouter({ config }));
  return app;
}

async function main() {
  const config = loadOrchestratorConfig();
  createOrchestratorApp(config).listen(PORT, () => console.log(`[alfa] orquestador listening on :${PORT}`));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[alfa] fatal startup configuration error', error instanceof Error ? error.message : 'unknown');
    process.exit(1);
  });
}
