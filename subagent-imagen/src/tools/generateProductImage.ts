import { pool } from '../db/pool';
import { generateImage } from '../providers/fluxClient';
import { saveAsset } from '../storage/uploadAsset';

export interface GenerateProductImageInput {
  tenant_id: string;
  product_id: string;
  style?: string;
  count?: number;
}

export async function generateProductImage(input: GenerateProductImageInput) {
  const { tenant_id, product_id, style = 'fondo blanco estudio, fotografía de producto', count = 3 } = input;

  const productRes = await pool.query(`SELECT name, category FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const { name, category } = productRes.rows[0];

  const prompt = `Fotografía de producto de e-commerce: ${name}${category ? `, categoría ${category}` : ''}. Estilo: ${style}. Alta calidad, iluminación profesional.`;

  const results = [];
  for (let i = 0; i < count; i++) {
    const buffer = await generateImage({ prompt, width: 1024, height: 1024 });
    const url = saveAsset(tenant_id, buffer);

    const row = await pool.query(
      `INSERT INTO creatives (tenant_id, product_id, type, content, metadata)
       VALUES ($1, $2, 'image', $3, $4)
       RETURNING id`,
      [tenant_id, product_id, url, JSON.stringify({ style })]
    );

    results.push({ id: row.rows[0].id, url });
  }

  return { product_id, images: results };
}
