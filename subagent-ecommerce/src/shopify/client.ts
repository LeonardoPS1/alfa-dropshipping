import { GraphQLClient } from 'graphql-request';

const domain = process.env.SHOPIFY_SHOP_DOMAIN;
const version = process.env.SHOPIFY_API_VERSION ?? '2025-01';

export const shopifyClient = new GraphQLClient(`https://${domain}/admin/api/${version}/graphql.json`, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN ?? '',
    'Content-Type': 'application/json',
  },
});

/**
 * Envuelve requests GraphQL con reintento ante throttling (Shopify usa un
 * modelo de costo por query, devuelve THROTTLED en vez de un 429 clásico).
 */
export async function shopifyRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await shopifyClient.request<T>(query, variables);
    } catch (err: any) {
      lastErr = err;
      const isThrottled = JSON.stringify(err?.response ?? '').includes('THROTTLED');
      if (!isThrottled) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}
