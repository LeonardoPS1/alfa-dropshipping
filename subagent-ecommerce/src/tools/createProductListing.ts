import { pool } from '../db/pool';
import { shopifyRequest } from '../shopify/client';
import { PRODUCT_CREATE } from '../shopify/mutations';

export interface CreateListingInput {
  tenant_id: string;
  product_id: string;
  description_id?: string;
  image_ids?: string[];
}

export async function createProductListing(input: CreateListingInput) {
  const { tenant_id, product_id, description_id, image_ids } = input;

  const productRes = await pool.query(`SELECT * FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const product = productRes.rows[0];

  const descriptionRow = description_id
    ? await pool.query(`SELECT content FROM creatives WHERE id = $1`, [description_id])
    : await pool.query(
        `SELECT content FROM creatives WHERE product_id = $1 AND type = 'copy' AND metadata->>'subtype' = 'product_description'
         ORDER BY created_at DESC LIMIT 1`,
        [product_id]
      );
  const descriptionHtml = descriptionRow.rows[0]?.content ?? `<p>${product.name}</p>`;

  const imagesRes = image_ids && image_ids.length
    ? await pool.query(`SELECT content FROM creatives WHERE id = ANY($1)`, [image_ids])
    : await pool.query(
        `SELECT content FROM creatives WHERE product_id = $1 AND type = 'image' ORDER BY created_at DESC LIMIT 5`,
        [product_id]
      );
  const images = imagesRes.rows.map((r) => ({ originalSource: r.content as string }));

  const salePrice = Number(product.suggested_sale_price ?? Number(product.supplier_price ?? 0) * 2.2);

  const result = await shopifyRequest<any>(PRODUCT_CREATE, {
    input: {
      title: product.name,
      descriptionHtml,
      status: 'DRAFT',
      images,
      variants: [{ price: salePrice.toFixed(2) }],
    },
  });

  const errors = result.productCreate.userErrors;
  if (errors?.length) {
    throw new Error(`Shopify productCreate error: ${JSON.stringify(errors)}`);
  }

  const shopifyProduct = result.productCreate.product;
  const variantId = shopifyProduct.variants.edges[0]?.node?.id ?? null;

  await pool.query(
    `UPDATE products SET shopify_product_id = $1, shopify_variant_id = $2, shopify_status = 'draft' WHERE id = $3`,
    [shopifyProduct.id, variantId, product_id]
  );

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const numericId = shopifyProduct.id.split('/').pop();

  return {
    product_id,
    shopify_product_id: shopifyProduct.id,
    shopify_admin_url: `https://${shopDomain}/admin/products/${numericId}`,
    status: 'draft',
  };
}
