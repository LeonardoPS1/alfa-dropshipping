import { pool } from '../db/pool';
import { generateImage } from '../providers/fluxClient';
import { saveAsset } from '../storage/uploadAsset';

export interface GenerateAdCreativeInput {
  tenant_id: string;
  product_id: string;
  platform: 'meta' | 'tiktok';
  copy_id?: string;
}

const ASPECT_RATIOS: Record<string, { width: number; height: number; label: string }> = {
  meta: { width: 1080, height: 1350, label: '4:5' }, // feed
  tiktok: { width: 1080, height: 1920, label: '9:16' },
};

export async function generateAdCreative(input: GenerateAdCreativeInput) {
  const { tenant_id, product_id, platform, copy_id } = input;

  const productRes = await pool.query(`SELECT name, category FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const { name, category } = productRes.rows[0];

  let copyContext = '';
  if (copy_id) {
    const copyRes = await pool.query(`SELECT content FROM creatives WHERE id = $1 AND tenant_id = $2`, [
      copy_id,
      tenant_id,
    ]);
    if (copyRes.rows.length === 0) {
      throw new Error(`creative de copy ${copy_id} no encontrado`);
    }
    copyContext = ` Ángulo del anuncio: "${copyRes.rows[0].content}".`;
  }

  const { width, height, label } = ASPECT_RATIOS[platform];
  const prompt =
    `Creativo publicitario de e-commerce para ${platform === 'meta' ? 'Meta Ads (feed)' : 'TikTok Ads'}: ` +
    `producto ${name}${category ? `, categoría ${category}` : ''}.${copyContext} ` +
    `Composición dinámica, estilo lifestyle/uso real, apto para anuncio pago.`;

  const buffer = await generateImage({ prompt, width, height });
  const url = saveAsset(tenant_id, buffer);

  const row = await pool.query(
    `INSERT INTO creatives (tenant_id, product_id, type, content, metadata)
     VALUES ($1, $2, 'image', $3, $4)
     RETURNING id`,
    [tenant_id, product_id, url, JSON.stringify({ platform, aspect_ratio: label, copy_id })]
  );

  return { product_id, creative_id: row.rows[0].id, url, aspect_ratio: label };
}
