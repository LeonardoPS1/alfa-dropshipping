import { pool } from '../db/pool';
import { publishInstagramPost } from '../providers/metaGraphClient';
import { publishTikTokPost } from '../providers/tiktokClient';

export interface PublishPostInput {
  tenant_id: string;
  scheduled_post_id?: string;
  product_id?: string;
  creative_id?: string;
  platform?: 'instagram' | 'tiktok';
}

export async function publishPost(input: PublishPostInput) {
  const { tenant_id } = input;
  let { product_id, creative_id, platform } = input;
  let scheduledPostId = input.scheduled_post_id ?? null;

  if (scheduledPostId) {
    const row = await pool.query(`SELECT * FROM scheduled_posts WHERE id = $1 AND tenant_id = $2`, [
      scheduledPostId,
      tenant_id,
    ]);
    if (row.rows.length === 0) throw new Error(`scheduled_post ${scheduledPostId} no encontrado`);
    product_id = row.rows[0].product_id;
    creative_id = row.rows[0].creative_id;
    platform = row.rows[0].platform;
  }

  if (!product_id || !creative_id || !platform) {
    throw new Error('product_id, creative_id y platform son requeridos si no se pasa scheduled_post_id');
  }

  const creativeRes = await pool.query(`SELECT content FROM creatives WHERE id = $1`, [creative_id]);
  const mediaUrl = creativeRes.rows[0]?.content;
  if (!mediaUrl) throw new Error(`creative ${creative_id} no encontrado`);

  const captionRes = await pool.query(
    `SELECT content FROM creatives WHERE product_id = $1 AND metadata->>'subtype' = 'caption' AND metadata->>'platform' = $2
     ORDER BY created_at DESC LIMIT 1`,
    [product_id, platform]
  );
  const caption = captionRes.rows[0]?.content ?? '';

  try {
    const platformPostId =
      platform === 'instagram'
        ? await publishInstagramPost({ imageUrl: mediaUrl, caption })
        : await publishTikTokPost({ mediaUrl, caption });

    if (scheduledPostId) {
      await pool.query(`UPDATE scheduled_posts SET status = 'published', platform_post_id = $1 WHERE id = $2`, [
        platformPostId,
        scheduledPostId,
      ]);
    } else {
      const inserted = await pool.query(
        `INSERT INTO scheduled_posts (tenant_id, product_id, creative_id, platform, scheduled_at, status, platform_post_id)
         VALUES ($1, $2, $3, $4, now(), 'published', $5) RETURNING id`,
        [tenant_id, product_id, creative_id, platform, platformPostId]
      );
      scheduledPostId = inserted.rows[0].id;
    }

    return { scheduled_post_id: scheduledPostId, platform_post_id: platformPostId, status: 'published' };
  } catch (err: any) {
    if (scheduledPostId) {
      await pool.query(`UPDATE scheduled_posts SET status = 'failed', error = $1 WHERE id = $2`, [
        err.message,
        scheduledPostId,
      ]);
    }
    throw err;
  }
}
