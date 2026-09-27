import { pool } from '../db/pool';
import { generateText } from '../llm/client';
import { buildProductDescriptionPrompt } from '../prompts/productDescription';

export interface GenerateDescriptionInput {
  tenant_id: string;
  product_id: string;
  length?: 'short' | 'long';
}

export async function generateProductDescription(input: GenerateDescriptionInput) {
  const { tenant_id, product_id, length = 'long' } = input;

  const productRes = await pool.query(`SELECT name, category FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const { name, category } = productRes.rows[0];

  const { system, user } = buildProductDescriptionPrompt({
    productName: name,
    category: category ?? 'sin categoría',
    length,
  });
  const content = await generateText(system, user);

  const row = await pool.query(
    `INSERT INTO creatives (tenant_id, product_id, type, content, metadata)
     VALUES ($1, $2, 'copy', $3, $4)
     RETURNING id`,
    [tenant_id, product_id, content.trim(), JSON.stringify({ subtype: 'product_description', length })]
  );

  return { product_id, description_id: row.rows[0].id, content: content.trim() };
}
