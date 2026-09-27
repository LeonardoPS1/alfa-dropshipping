import { pool } from '../db/pool';
import { generateText } from '../llm/client';
import { buildCaptionsPrompt } from '../prompts/captionsRRSS';

export interface GenerateCaptionsInput {
  tenant_id: string;
  product_id: string;
  platform: 'instagram' | 'tiktok';
  count?: number;
}

export async function generateCaptionsRRSS(input: GenerateCaptionsInput) {
  const { tenant_id, product_id, platform, count = 5 } = input;

  const productRes = await pool.query(`SELECT name FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const productName = productRes.rows[0].name;

  const { system, user } = buildCaptionsPrompt({ productName, platform, count });
  const raw = await generateText(system, user);

  let captions: string[];
  try {
    captions = JSON.parse(raw);
  } catch {
    // fallback: si el LLM no devolvió JSON puro, partir por líneas
    captions = raw.split('\n').filter((l) => l.trim().length > 0).slice(0, count);
  }

  const saved = [];
  for (const caption of captions) {
    const row = await pool.query(
      `INSERT INTO creatives (tenant_id, product_id, type, content, metadata)
       VALUES ($1, $2, 'copy', $3, $4)
       RETURNING id`,
      [tenant_id, product_id, caption, JSON.stringify({ subtype: 'caption', platform })]
    );
    saved.push({ id: row.rows[0].id, content: caption });
  }

  return { product_id, captions: saved };
}
