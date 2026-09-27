import { pool } from '../db/pool';
import { generateText } from '../llm/client';
import { buildAdCopyPrompt, AD_COPY_ANGLES } from '../prompts/adCopy';

export interface GenerateAdCopyInput {
  tenant_id: string;
  product_id: string;
  platform: 'meta' | 'tiktok';
  variants?: number;
}

export async function generateAdCopy(input: GenerateAdCopyInput) {
  const { tenant_id, product_id, platform, variants = 3 } = input;

  const productRes = await pool.query(`SELECT name FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const productName = productRes.rows[0].name;

  const evalRes = await pool.query(
    `SELECT justification FROM evaluations WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [product_id]
  );
  const justification = evalRes.rows[0]?.justification ?? 'Sin evaluación previa registrada.';

  const angles = AD_COPY_ANGLES.slice(0, Math.min(variants, AD_COPY_ANGLES.length));
  const results = [];

  for (const angle of angles) {
    const { system, user } = buildAdCopyPrompt({ productName, justification, platform, angle });
    const content = await generateText(system, user);

    const row = await pool.query(
      `INSERT INTO creatives (tenant_id, product_id, type, content, metadata)
       VALUES ($1, $2, 'copy', $3, $4)
       RETURNING id`,
      [tenant_id, product_id, content.trim(), JSON.stringify({ subtype: 'ad_copy', platform, angle })]
    );

    results.push({ id: row.rows[0].id, angle, content: content.trim() });
  }

  return { product_id, variants: results };
}
