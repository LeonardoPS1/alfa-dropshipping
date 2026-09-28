import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(__dirname, '../..');
const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8');
const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
const dashboardDockerfile = readFileSync(resolve(root, 'dashboard/Dockerfile'), 'utf8');
const smokeModule = (() => {
  try { return require('../scripts/smoke-discovery') as Record<string, any>; }
  catch { return {}; }
})();
const parsePgConnectionString = require('pg-connection-string') as (connectionString: string) => Record<string, unknown>;
const productServerModule = (() => {
  try { return require('../../subagent-producto/src/server') as Record<string, any>; }
  catch { return {}; }
})();
const orchestratorConfigModule = require('../src/config') as Record<string, any>;
const dashboardClientModule = require('../../dashboard/src/lib/orchestratorClient') as Record<string, any>;

test('deployment wiring requires three distinct service credentials and the server-owned tenant', () => {
  assert.match(compose, /ORCHESTRATOR_INTERNAL_TOKEN=\$\{DASHBOARD_ORCHESTRATOR_TOKEN:\?/);
  assert.match(compose, /DASHBOARD_ORCHESTRATOR_TOKEN=\$\{DASHBOARD_ORCHESTRATOR_TOKEN:\?/);
  assert.match(compose, /ORCHESTRATOR_PRODUCT_TOKEN=\$\{ORCHESTRATOR_PRODUCT_TOKEN:\?/);
  assert.match(compose, /ALFA_TENANT_ID=\$\{ALFA_TENANT_ID:\?/);
  assert.match(envExample, /^DASHBOARD_ORCHESTRATOR_TOKEN=REPLACE_WITH_DASHBOARD_TO_ORCHESTRATOR_CREDENTIAL/m);
  assert.match(envExample, /^ORCHESTRATOR_PRODUCT_TOKEN=REPLACE_WITH_ORCHESTRATOR_TO_PRODUCT_CREDENTIAL/m);
  assert.match(envExample, /^ALFA_TENANT_ID=[0-9a-f-]{36}$/m);
  assert.notEqual(
    envExample.match(/^DASHBOARD_ORCHESTRATOR_TOKEN=(.*)$/m)?.[1],
    envExample.match(/^ORCHESTRATOR_PRODUCT_TOKEN=(.*)$/m)?.[1],
  );
});

test('deployment keeps orchestrator private while dashboard remains the public route', () => {
  const orchestrator = compose.match(/  alfa-orchestrator:[\s\S]*?(?=\n  alfa-subagent-producto:)/)?.[0] ?? '';
  const dashboard = compose.match(/  alfa-dashboard:[\s\S]*?(?=\nnetworks:)/)?.[0] ?? '';
  assert.doesNotMatch(orchestrator, /traefik\.http\.routers|shared-network/);
  assert.doesNotMatch(orchestrator, /\n\s+ports:/);
  assert.match(orchestrator, /alfa-network/);
  assert.match(dashboard, /traefik\.http\.routers\.alfa-dashboard/);
  assert.match(dashboard, /ALFA_ORCHESTRATOR_URL=http:\/\/alfa-orchestrator:3000/);
});

test('Dokploy Compose networks stay attachable and scoped to dependency or routed services', () => {
  assert.doesNotMatch(compose, /^\s+container_name:/m);

  const networkDefinitions = compose.match(/^networks:[\s\S]*?(?=^volumes:)/m)?.[0] ?? '';
  assert.match(networkDefinitions, /alfa-network:\n\s+driver: bridge/);
  assert.match(networkDefinitions, /alfa-private:\n\s+external: true/);
  assert.match(networkDefinitions, /dokploy-network:\n\s+external: true/);
  assert.doesNotMatch(networkDefinitions, /driver: overlay/);

  const service = (name: string) => compose.match(new RegExp(`^  ${name}:[\\s\\S]*?(?=^  [\\w-]+:|^networks:)`, 'm'))?.[0] ?? '';
  for (const name of [
    'alfa-orchestrator',
    'alfa-subagent-producto',
    'alfa-subagent-copywriting',
    'alfa-subagent-imagen',
    'alfa-subagent-ecommerce',
    'alfa-subagent-rrss',
    'alfa-subagent-ads',
    'alfa-dashboard',
  ]) {
    assert.match(service(name), /alfa-private/, `${name} requires shared infrastructure dependencies`);
    assert.match(service(name), /alfa-network/, `${name} participates in the private ALFA service network`);
  }

  const routedServices = ['alfa-subagent-imagen', 'alfa-subagent-ecommerce', 'alfa-dashboard'];
  for (const name of routedServices) {
    assert.match(service(name), /dokploy-network/, `${name} has a public Traefik route`);
  }
  for (const name of [
    'alfa-orchestrator',
    'alfa-subagent-producto',
    'alfa-subagent-copywriting',
    'alfa-subagent-rrss',
    'alfa-subagent-ads',
  ]) {
    assert.doesNotMatch(service(name), /dokploy-network|traefik\.http\.routers/, `${name} must remain unrouted`);
  }
  assert.doesNotMatch(service('alfa-orchestrator'), /ports:/);
});

test('dashboard runtime image does not copy a missing public assets directory', () => {
  if (!existsSync(resolve(root, 'dashboard/public'))) {
    assert.doesNotMatch(dashboardDockerfile, /COPY\s+--from=build\s+\/app\/public\b/);
  }
});

test('product service rejects missing startup credential configuration', () => {
  assert.equal(typeof productServerModule.loadProductServiceConfig, 'function');
  assert.throws(() => productServerModule.loadProductServiceConfig({ ORCHESTRATOR_PRODUCT_TOKEN: '' }), /ORCHESTRATOR_PRODUCT_TOKEN/);
  assert.throws(() => productServerModule.loadProductServiceConfig({ ORCHESTRATOR_PRODUCT_TOKEN: 'REPLACE_WITH_PRODUCT_TOKEN' }), /placeholder/);
  assert.equal(
    productServerModule.loadProductServiceConfig({ ORCHESTRATOR_PRODUCT_TOKEN: 'test-product-token' }).discoveryToken,
    'test-product-token',
  );
});

test('service startup and dashboard transport reject copied example credentials', async () => {
  assert.throws(() => orchestratorConfigModule.loadOrchestratorConfig({
    ORCHESTRATOR_INTERNAL_TOKEN: 'REPLACE_WITH_INTERNAL_TOKEN',
    ORCHESTRATOR_TENANT_ID: '00000000-0000-4000-8000-000000000001',
    ORCHESTRATOR_PRODUCT_TOKEN: 'REPLACE_WITH_PRODUCT_TOKEN',
    MCP_PRODUCTO_URL: 'http://producto.internal',
  }), /placeholder/);
  await assert.rejects(() => dashboardClientModule.sendChatMessage('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'hello', {
    internalToken: 'REPLACE_WITH_DASHBOARD_TOKEN',
    post: async () => ({ status: 200, data: {} }),
  }), /placeholder/);
});

test('smoke database configuration is explicit, disposable, and loopback-only', () => {
  assert.equal(typeof smokeModule.loadSmokeDatabaseConfig, 'function');
  assert.throws(() => smokeModule.loadSmokeDatabaseConfig({ DATABASE_URL: 'postgres://localhost/alfa_smoke' }), /ALFA_SMOKE_DATABASE_URL/);
  assert.throws(() => smokeModule.loadSmokeDatabaseConfig({ ALFA_SMOKE_DATABASE_URL: 'postgres://db.internal/alfa_smoke' }), /loopback/);
  assert.throws(() => smokeModule.loadSmokeDatabaseConfig({ ALFA_SMOKE_DATABASE_URL: 'postgres://localhost/alfa_db' }), /disposable/);
  assert.equal(
    smokeModule.loadSmokeDatabaseConfig({ ALFA_SMOKE_DATABASE_URL: 'postgres://localhost/alfa_smoke' }).databaseName,
    'alfa_smoke',
  );
});

test('smoke rejects PostgreSQL connection-string query parameters before opening a connection', () => {
  const bypass = 'postgres://localhost/alfa_smoke?host=remote.example';
  assert.equal(parsePgConnectionString(bypass).host, 'remote.example', 'installed pg parser must demonstrate the host override');

  const destinationOverrides = [
    'host=remote.example',
    '%68ost=remote.example',
    'host=%2Fvar%2Frun%2Fpostgresql',
    'hostaddr=remote.example',
    'port=5432',
    'service=remote-service',
    'servicefile=%2Ftmp%2Fpg_service.conf',
  ];
  for (const query of destinationOverrides) {
    assert.throws(
      () => smokeModule.loadSmokeDatabaseConfig({ ALFA_SMOKE_DATABASE_URL: `postgres://localhost/alfa_smoke?${query}` }),
      /query parameters are not accepted/i,
      `smoke must reject connection-string parameters: ${query}`,
    );
  }

  assert.equal(
    smokeModule.loadSmokeDatabaseConfig({ ALFA_SMOKE_DATABASE_URL: 'postgres://localhost/alfa_smoke' }).databaseName,
    'alfa_smoke',
    'ordinary loopback URLs without query parameters remain accepted',
  );
});
