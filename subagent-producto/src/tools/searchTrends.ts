import { pool } from '../db/pool';
import { scrapeTikTokTrends } from '../scrapers/tiktokTrends';

export interface SearchTrendsInput {
  tenant_id: string;
  niche?: string;
  limit?: number;
}

export async function searchTrends(input: SearchTrendsInput) {
  const { tenant_id, niche, limit = 20 } = input;
  const trends = await scrapeTikTokTrends(niche, limit);

  const saved = [];
  for (const t of trends) {
    // Upsert simple por (tenant_id, name, source) para no duplicar en cada corrida.
    const existing = await pool.query(
      `SELECT id FROM products WHERE tenant_id = $1 AND name = $2 AND source = 'tiktok' LIMIT 1`,
      [tenant_id, t.name]
    );

    if (existing.rows.length > 0) {
      saved.push({ id: existing.rows[0].id, name: t.name, is_new: false });
      continue;
    }

    const result = await pool.query(
      `INSERT INTO products (tenant_id, name, source, raw_data)
       VALUES ($1, $2, 'tiktok', $3)
       RETURNING id`,
      [tenant_id, t.name, JSON.stringify({ ...t.raw_data, estimated_demand: t.estimated_demand })]
    );
    saved.push({ id: result.rows[0].id, name: t.name, is_new: true });
  }

  return { count: saved.length, products: saved };
}
