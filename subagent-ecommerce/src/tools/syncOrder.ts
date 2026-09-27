import { pool } from '../db/pool';
import { shopifyRequest } from '../shopify/client';
import { GET_ORDER_BY_ID } from '../shopify/queries';

export interface SyncOrderInput {
  tenant_id: string;
  shopify_order_id: string;
}

export async function syncOrder(input: SyncOrderInput) {
  const { tenant_id, shopify_order_id } = input;

  const result = await shopifyRequest<any>(GET_ORDER_BY_ID, { id: shopify_order_id });
  const order = result.order;
  if (!order) throw new Error(`orden ${shopify_order_id} no encontrada en Shopify`);

  const revenue = Number(order.totalPriceSet.shopMoney.amount);
  const firstLineItem = order.lineItems.edges[0]?.node;
  const shopifyProductId = firstLineItem?.variant?.product?.id;

  let productId: string | null = null;
  if (shopifyProductId) {
    const productRes = await pool.query(
      `SELECT id FROM products WHERE shopify_product_id = $1 AND tenant_id = $2`,
      [shopifyProductId, tenant_id]
    );
    productId = productRes.rows[0]?.id ?? null;
  }

  const existing = await pool.query(`SELECT id FROM orders WHERE shopify_order_id = $1`, [shopify_order_id]);

  if (existing.rows.length > 0) {
    await pool.query(`UPDATE orders SET status = $1, revenue = $2 WHERE id = $3`, [
      order.displayFinancialStatus,
      revenue,
      existing.rows[0].id,
    ]);
    return { order_id: existing.rows[0].id, updated: true };
  }

  const inserted = await pool.query(
    `INSERT INTO orders (tenant_id, shopify_order_id, product_id, status, revenue)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenant_id, shopify_order_id, productId, order.displayFinancialStatus, revenue]
  );

  return { order_id: inserted.rows[0].id, updated: false };
}
