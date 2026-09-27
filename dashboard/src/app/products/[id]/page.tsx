import { pool } from '@/lib/db';

// Página de datos en vivo — nunca prerenderizar estáticamente en build time.
export const dynamic = 'force-dynamic';

async function getProductDetail(id: string) {
  const productRes = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
  const evaluationsRes = await pool.query(
    `SELECT * FROM evaluations WHERE product_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  const creativesRes = await pool.query(
    `SELECT * FROM creatives WHERE product_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  const saturationRes = await pool.query(
    `SELECT * FROM saturation_checks WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 1`,
    [id]
  );
  const complianceRes = await pool.query(
    `SELECT * FROM compliance_flags WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 1`,
    [id]
  );
  const campaignRes = await pool.query(
    `SELECT * FROM campaigns WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );

  return {
    product: productRes.rows[0],
    evaluations: evaluationsRes.rows,
    creatives: creativesRes.rows,
    saturation: saturationRes.rows[0] ?? null,
    compliance: complianceRes.rows[0] ?? null,
    campaign: campaignRes.rows[0] ?? null,
  };
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const data = await getProductDetail(params.id);
  if (!data.product) return <p>Producto no encontrado.</p>;

  return (
    <div>
      <h1>{data.product.name}</h1>
      <p>Categoría: {data.product.category ?? '—'} · Fuente: {data.product.source}</p>

      <h2>Evaluaciones</h2>
      {data.evaluations.map((e) => (
        <div key={e.id} style={{ marginBottom: 8, padding: 8, border: '1px solid #222', borderRadius: 6 }}>
          <strong>Score total: {Number(e.total_score).toFixed(1)}</strong>
          <p style={{ opacity: 0.8 }}>{e.justification}</p>
        </div>
      ))}

      <h2>Estado de saturación / compliance</h2>
      <p>
        Saturación: {data.saturation ? (data.saturation.is_saturated ? 'Saturado' : 'OK') : 'Sin chequear'} ·
        Compliance: {data.compliance ? (data.compliance.is_compliant ? 'OK' : data.compliance.restricted_reason) : 'Sin chequear'}
      </p>

      <h2>Creativos generados</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {data.creatives.map((c) => (
          <div key={c.id} style={{ width: 220, border: '1px solid #222', borderRadius: 6, padding: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{c.type}</span>
            {c.type === 'image' ? (
              <img src={c.content} alt="" style={{ width: '100%', borderRadius: 4, marginTop: 4 }} />
            ) : (
              <p style={{ fontSize: 13 }}>{c.content}</p>
            )}
          </div>
        ))}
      </div>

      {data.campaign && (
        <>
          <h2>Campaña</h2>
          <p>
            {data.campaign.platform} · Estado: {data.campaign.status} · ROAS: {data.campaign.roas ?? '—'} · Spend: $
            {data.campaign.spend}
          </p>
        </>
      )}
    </div>
  );
}
