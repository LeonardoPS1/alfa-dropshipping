import crypto from 'crypto';

/**
 * Valida la firma HMAC-SHA256 que Shopify envía en el header
 * X-Shopify-Hmac-SHA256, calculada sobre el body crudo (sin parsear) con
 * SHOPIFY_WEBHOOK_SECRET. Requiere que el body llegue como Buffer crudo,
 * por eso el router usa express.raw() en vez de express.json() para esta ruta.
 */
export function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string | undefined): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
