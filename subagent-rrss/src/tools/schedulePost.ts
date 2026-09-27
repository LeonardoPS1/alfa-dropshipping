import { Queue } from 'bullmq';
import { pool } from '../db/pool';

const connection = { url: process.env.REDIS_URL };
const postQueue = new Queue('scheduled-posts', { connection });

export interface SchedulePostInput {
  tenant_id: string;
  product_id: string;
  creative_id: string;
  platform: 'instagram' | 'tiktok';
  scheduled_at: string; // ISO date
}

export async function schedulePost(input: SchedulePostInput) {
  const { tenant_id, product_id, creative_id, platform, scheduled_at } = input;

  const creativeCheck = await pool.query(`SELECT type FROM creatives WHERE id = $1`, [creative_id]);
  if (creativeCheck.rows.length === 0) throw new Error(`creative ${creative_id} no encontrado`);
  if (!['image', 'video'].includes(creativeCheck.rows[0].type)) {
    throw new Error('creative_id debe ser de tipo image o video, no copy');
  }

  const inserted = await pool.query(
    `INSERT INTO scheduled_posts (tenant_id, product_id, creative_id, platform, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
    [tenant_id, product_id, creative_id, platform, scheduled_at]
  );
  const scheduledPostId = inserted.rows[0].id;

  const delay = Math.max(0, new Date(scheduled_at).getTime() - Date.now());
  await postQueue.add(
    'publish',
    { scheduled_post_id: scheduledPostId, tenant_id },
    { delay, jobId: scheduledPostId }
  );

  return { scheduled_post_id: scheduledPostId, scheduled_at, status: 'pending' };
}
