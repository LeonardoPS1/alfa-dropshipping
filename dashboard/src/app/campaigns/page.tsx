import { pool, DEFAULT_TENANT_ID } from '@/lib/db';
import { CampaignTable } from '@/components/CampaignTable';

// Página de datos en vivo — nunca prerenderizar estáticamente en build time.
export const dynamic = 'force-dynamic';

async function getCampaigns() {
  const result = await pool.query(
    `SELECT c.id, p.name AS product_name, c.platform, c.budget, c.spend, c.roas, c.status, c.last_checked_at
     FROM campaigns c
     JOIN products p ON p.id = c.product_id
     WHERE c.tenant_id = $1
     ORDER BY c.created_at DESC`,
    [DEFAULT_TENANT_ID]
  );
  return result.rows;
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();
  return (
    <div>
      <h1>Campañas</h1>
      <CampaignTable campaigns={campaigns} />
    </div>
  );
}
