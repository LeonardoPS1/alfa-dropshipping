import { pool } from '../db/pool';
import { getInstagramMediaInsights } from '../providers/metaGraphClient';
import { getTikTokPostInsights } from '../providers/tiktokClient';

export interface GetEngagementInput {
  tenant_id: string;
  scheduled_post_id: string;
}

export async function getEngagementMetrics(input: GetEngagementInput) {
  const { tenant_id, scheduled_post_id } = input;

  const postRes = await pool.query(`SELECT * FROM scheduled_posts WHERE id = $1 AND tenant_id = $2`, [
    scheduled_post_id,
    tenant_id,
  ]);
  if (postRes.rows.length === 0) throw new Error(`scheduled_post ${scheduled_post_id} no encontrado`);
  const post = postRes.rows[0];

  if (!post.platform_post_id) throw new Error('el post aún no fue publicado, no tiene platform_post_id');

  const metrics =
    post.platform === 'instagram'
      ? await getInstagramMediaInsights(post.platform_post_id)
      : await getTikTokPostInsights(post.platform_post_id);

  await pool.query(
    `INSERT INTO engagement_metrics (tenant_id, scheduled_post_id, likes, comments, shares, reach)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenant_id, scheduled_post_id, metrics.likes ?? 0, metrics.comments ?? 0, metrics.shares ?? 0, metrics.reach ?? 0]
  );

  const previous = await pool.query(
    `SELECT * FROM engagement_metrics WHERE scheduled_post_id = $1 ORDER BY fetched_at DESC OFFSET 1 LIMIT 1`,
    [scheduled_post_id]
  );

  return { scheduled_post_id, current: metrics, previous: previous.rows[0] ?? null };
}
