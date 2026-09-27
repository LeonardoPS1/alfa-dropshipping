import { Worker } from 'bullmq';
import { publishPost } from '../tools/publishPost';

const connection = { url: process.env.REDIS_URL };

/**
 * Worker BullMQ que consume la cola de posts programados. Persiste en Redis,
 * así que sobrevive reinicios del contenedor (los jobs con delay no se pierden).
 */
export function startScheduledPostsWorker() {
  const worker = new Worker(
    'scheduled-posts',
    async (job) => {
      const { scheduled_post_id, tenant_id } = job.data;
      console.log(`[worker] publicando scheduled_post ${scheduled_post_id}`);
      await publishPost({ tenant_id, scheduled_post_id });
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id} falló:`, err.message);
  });

  return worker;
}
