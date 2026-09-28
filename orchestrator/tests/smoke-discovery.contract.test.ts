import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedSmokeTenant } from '../scripts/smoke-discovery';

const tenantId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';

test('controlled smoke creates its run-scoped tenant in the explicit disposable database', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  await seedSmokeTenant(async <Row>(sql: string, values: unknown[]) => {
    calls.push({ sql, values });
    return { rows: [{ id: tenantId }] as Row[] };
  }, tenantId, runId);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO tenants\s*\(id, name\)/i);
  assert.match(calls[0].sql, /RETURNING id/i);
  assert.deepEqual(calls[0].values, [tenantId, `controlled-smoke-${runId}`]);
});

test('controlled smoke fails with a safe category if its tenant was not created', async () => {
  await assert.rejects(
    () => seedSmokeTenant(async <Row>() => ({ rows: [] as Row[] }), tenantId, runId),
    { message: 'Smoke tenant seed did not return the requested tenant' },
  );
});
