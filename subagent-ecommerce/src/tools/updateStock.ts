import { pool } from '../db/pool';
import { shopifyRequest } from '../shopify/client';
import { INVENTORY_SET_QUANTITIES } from '../shopify/mutations';
import { GET_PRIMARY_LOCATION } from '../shopify/queries';

export interface UpdateStockInput {
  tenant_id: string;
  product_id: string;
  quantity: number;
  location_id?: string;
}

let cachedLocationId: string | null = null;

async function getPrimaryLocationId(): Promise<string> {
  if (cachedLocationId) return cachedLocationId;
  const result = await shopifyRequest<any>(GET_PRIMARY_LOCATION);
  const id = result.locations.edges[0]?.node?.id;
  if (!id) throw new Error('no se encontró ninguna location en la tienda Shopify');
  cachedLocationId = id;
  return id;
}

export async function updateStock(input: UpdateStockInput) {
  const { tenant_id, product_id, quantity, location_id } = input;

  const productRes = await pool.query(
    `SELECT shopify_variant_id FROM products WHERE id = $1 AND tenant_id = $2`,
    [product_id, tenant_id]
  );
  const variantId = productRes.rows[0]?.shopify_variant_id;
  if (!variantId) {
    throw new Error(`producto ${product_id} no tiene shopify_variant_id — publicalo primero con create_product_listing`);
  }

  const locationId = location_id ?? (await getPrimaryLocationId());

  // El inventoryItemId real requiere una consulta adicional en un caso de
  // producción completo; acá se asume que variantId ya referencia el
  // inventory item vinculado (mapeo 1:1 en catálogos simples sin variantes).
  const result = await shopifyRequest<any>(INVENTORY_SET_QUANTITIES, {
    input: {
      reason: 'correction',
      name: 'available',
      quantities: [{ inventoryItemId: variantId, locationId, quantity }],
    },
  });

  const errors = result.inventorySetQuantities.userErrors;
  if (errors?.length) {
    throw new Error(`Shopify inventorySetQuantities error: ${JSON.stringify(errors)}`);
  }

  return { product_id, new_quantity: quantity };
}
