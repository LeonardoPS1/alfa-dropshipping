import { NextResponse } from 'next/server';
import { pool, DEFAULT_TENANT_ID } from '@/lib/db';

// Este endpoint siempre lee el estado actual de la base — nunca debe
// prerenderizarse ni cachearse estáticamente en build time.
export const dynamic = 'force-dynamic';

// Un único query agregado que arma el board completo de pipeline en una
// sola llamada: cada producto cae en la columna que corresponde según su
// estado real en la base (no hay drag-and-drop manual).
export async function GET() {
  const result = await pool.query(
    `
    SELECT
      p.id, p.name, p.category, p.total_score, p.shopify_status,
      p.is_flagged_saturated, p.is_flagged_noncompliant,
      e.total_score AS evaluation_score,
      (SELECT content FROM creatives WHERE product_id = p.id AND type = 'image' ORDER BY created_at ASC LIMIT 1) AS thumbnail,
      EXISTS(SELECT 1 FROM creatives WHERE product_id = p.id AND type = 'copy') AS has_copy,
      EXISTS(SELECT 1 FROM creatives WHERE product_id = p.id AND type = 'image') AS has_image,
      c.id AS campaign_id, c.status AS campaign_status, c.roas
    FROM products p
    LEFT JOIN LATERAL (
      SELECT total_score FROM evaluations WHERE product_id = p.id ORDER BY created_at DESC LIMIT 1
    ) e ON true
    LEFT JOIN LATERAL (
      SELECT id, status, roas FROM campaigns WHERE product_id = p.id ORDER BY created_at DESC LIMIT 1
    ) c ON true
    WHERE p.tenant_id = $1
    ORDER BY p.created_at DESC
    LIMIT 200
    `,
    [DEFAULT_TENANT_ID]
  );

  const columns: Record<string, any[]> = {
    evaluado: [],
    creativos_listos: [],
    publicado: [],
    en_campana: [],
    pausado: [],
  };

  for (const row of result.rows) {
    if (row.campaign_status === 'paused' || row.is_flagged_saturated) {
      columns.pausado.push(row);
    } else if (row.campaign_status === 'active') {
      columns.en_campana.push(row);
    } else if (row.shopify_status === 'draft' || row.shopify_status === 'active') {
      columns.publicado.push(row);
    } else if (row.has_copy && row.has_image) {
      columns.creativos_listos.push(row);
    } else if (row.evaluation_score !== null) {
      columns.evaluado.push(row);
    }
  }

  return NextResponse.json({ columns });
}
