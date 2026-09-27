import { Router } from 'express';
import express from 'express';
import { verifyShopifyHmac } from './verifyHmac';
import { syncOrder } from '../tools/syncOrder';
import { pool } from '../db/pool';

export const webhooksRouter = Router();

// Body crudo requerido para poder validar el HMAC contra los bytes exactos enviados.
webhooksRouter.post('/shopify', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.header('X-Shopify-Hmac-SHA256');
  const topic = req.header('X-Shopify-Topic');
  const rawBody = req.body as Buffer;

  if (!verifyShopifyHmac(rawBody, hmac)) {
    return res.status(401).json({ error: 'firma HMAC inválida' });
  }

  const payload = JSON.parse(rawBody.toString('utf-8'));
  const shopifyOrderId = `gid://shopify/Order/${payload.id}`;

  // El tenant se resuelve por el dominio de la tienda configurada — este
  // subagente asume una tienda Shopify por tenant por ahora.
  const tenantRes = await pool.query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`);
  const tenantId = tenantRes.rows[0]?.id;

  try {
    if (topic === 'orders/create' || topic === 'orders/updated') {
      await syncOrder({ tenant_id: tenantId, shopify_order_id: shopifyOrderId });
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook] error procesando', topic, err.message);
    // Devolver 200 igual para que Shopify no reintente infinitamente un error
    // de nuestro lado; el error queda logueado para revisión manual.
    res.status(200).json({ received: true, processed: false });
  }
});
