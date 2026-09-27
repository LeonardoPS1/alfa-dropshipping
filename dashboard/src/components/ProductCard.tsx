'use client';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    thumbnail?: string | null;
    evaluation_score?: number | null;
    is_flagged_saturated?: boolean;
    is_flagged_noncompliant?: boolean;
    roas?: number | null;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <a
      href={`/products/${product.id}`}
      style={{
        display: 'block',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        background: '#151515',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {product.thumbnail && (
        <img
          src={product.thumbnail}
          alt={product.name}
          style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
        />
      )}
      <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {product.evaluation_score != null && (
          <span style={badgeStyle('#1d4ed8')}>Score {Number(product.evaluation_score).toFixed(0)}</span>
        )}
        {product.roas != null && <span style={badgeStyle('#15803d')}>ROAS {Number(product.roas).toFixed(2)}</span>}
        {product.is_flagged_saturated && <span style={badgeStyle('#b91c1c')}>Saturado</span>}
        {product.is_flagged_noncompliant && <span style={badgeStyle('#b45309')}>No compliant</span>}
      </div>
    </a>
  );
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    background: color,
    color: 'white',
  };
}
