import { getServerSession } from 'next-auth';
import { authOptions, resolveTenantId } from '@/lib/auth';
import { queryProductDetail } from '@/lib/productDetail';
import { describeEvidence, selectCatalogPriceEvidence } from '@/lib/evidenceDisplay';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !UUID_PATTERN.test(params.id)) return <p>Producto no encontrado.</p>;

  let data: Awaited<ReturnType<typeof queryProductDetail>>;
  try {
    data = await queryProductDetail(params.id, resolveTenantId(session));
  } catch {
    return <p>No se pudo cargar el producto.</p>;
  }
  if (!data.product) return <p>Producto no encontrado.</p>;

  const product = data.product;
  const discoveryEvidence = (product.raw_data as { discovery_evidence?: { catalog_price?: Parameters<typeof describeEvidence>[0] } } | null)?.discovery_evidence?.catalog_price;

  return (
    <div>
      <h1>{String(product.name)}</h1>
      <p>Categoría: {String(product.category ?? '—')} · Fuente: {String(product.source ?? '—')} · ID de origen: {String(product.external_id ?? 'Unavailable')}</p>
      <p>Estado de publicación persistido: {String(product.shopify_status ?? 'Unknown')}</p>

      <h2>Estado de evaluación</h2>
      {data.evaluations.length === 0 ? (() => {
        const price = describeEvidence(selectCatalogPriceEvidence(null, discoveryEvidence));
        return <p>Descubierto; todavía no evaluado. Catalog price: {price.label} · {price.status} · {price.provenance}</p>;
      })() : data.evaluations.map((evaluation) => {
        const evidence = selectCatalogPriceEvidence(
          (evaluation.evidence as { catalog_price?: Parameters<typeof describeEvidence>[0] } | null)?.catalog_price,
          discoveryEvidence
        );
        const price = describeEvidence(evidence);
        const score = evaluation.total_score == null ? 'Incomplete' : Number(evaluation.total_score).toFixed(1);
        return (
          <section key={String(evaluation.id)} style={{ marginBottom: 8, padding: 8, border: '1px solid #222', borderRadius: 6 }}>
            <strong>{score === 'Incomplete' ? 'Evaluación incompleta' : `Evaluated · Score total: ${score}`}</strong>
            <p>Evaluation ID: {String(evaluation.id)} · Status: {score === 'Incomplete' ? 'incomplete' : 'evaluated'}</p>
            <p>Catalog price: {price.label} · {price.status} · {price.provenance}</p>
            <p style={{ opacity: 0.8 }}>{String(evaluation.justification ?? 'No evaluation notes recorded.')}</p>
          </section>
        );
      })}

      <h2>Estado de saturación / compliance</h2>
      <p>
        Saturación: {data.saturation ? (data.saturation.is_saturated ? 'Saturado' : 'OK') : 'Sin chequear'} ·
        Compliance: {data.compliance ? (data.compliance.is_compliant ? 'OK' : String(data.compliance.restricted_reason ?? 'Restricted')) : 'Sin chequear'}
      </p>

      <h2>Creativos generados</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {data.creatives.map((creative) => (
          <div key={String(creative.id)} style={{ width: 220, border: '1px solid #222', borderRadius: 6, padding: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{String(creative.type)}</span>
            {creative.type === 'image' ? (
              <img src={String(creative.content ?? '')} alt="" style={{ width: '100%', borderRadius: 4, marginTop: 4 }} />
            ) : (
              <p style={{ fontSize: 13 }}>{String(creative.content ?? '')}</p>
            )}
          </div>
        ))}
      </div>

      {data.campaign && (
        <>
          <h2>Campaña persistida</h2>
          <p>
            {String(data.campaign.platform ?? 'Unknown')} · Estado: {String(data.campaign.status ?? 'Unknown')} · ROAS: {String(data.campaign.roas ?? '—')} · Spend: ${String(data.campaign.spend ?? '—')}
          </p>
        </>
      )}
    </div>
  );
}
