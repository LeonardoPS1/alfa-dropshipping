import { pool } from '../db/pool';

export interface GetSalesMetricsInput {
  tenant_id: string;
  product_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function getSalesMetrics(input: GetSalesMetricsInput) {
  const { tenant_id, product_id, date_from, date_to } = input;

  const conditions = ['tenant_id = $1'];
  const params: unknown[] = [tenant_id];

  if (product_id) {
    params.push(product_id);
    conditions.push(`product_id = $${params.length}`);
  }
  if (date_from) {
    params.push(date_from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS orders_count,
       COALESCE(SUM(revenue), 0)::numeric AS revenue,
       COALESCE(AVG(revenue), 0)::numeric AS avg_order_value
     FROM orders
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  const row = result.rows[0];
  return {
    orders_count: row.orders_count,
    revenue: Number(row.revenue),
    avg_order_value: Number(row.avg_order_value),
    units_sold: row.orders_count, // simplificación: 1 orden = 1 unidad si no hay desglose de line items guardado
  };
}
