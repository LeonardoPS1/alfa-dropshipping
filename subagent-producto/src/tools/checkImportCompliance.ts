import { pool } from '../db/pool';
import restrictedData from '../../data/restricted_categories_chile.json';

export interface CheckComplianceInput {
  tenant_id: string;
  product_id: string;
  category: string;
}

export async function checkImportCompliance(input: CheckComplianceInput) {
  const { tenant_id, product_id, category } = input;

  const normalizedCategory = category.toLowerCase().trim().replace(/\s+/g, '_');
  const match = (restrictedData.restricted_categories as Array<{ category: string; reason: string }>).find(
    (r) => r.category === normalizedCategory
  );

  const isCompliant = !match;

  await pool.query(
    `INSERT INTO compliance_flags (tenant_id, product_id, is_compliant, restricted_reason)
     VALUES ($1, $2, $3, $4)`,
    [tenant_id, product_id, isCompliant, match?.reason ?? null]
  );

  await pool.query(`UPDATE products SET is_flagged_noncompliant = $1 WHERE id = $2`, [!isCompliant, product_id]);

  return { product_id, is_compliant: isCompliant, restricted_reason: match?.reason ?? null };
}
