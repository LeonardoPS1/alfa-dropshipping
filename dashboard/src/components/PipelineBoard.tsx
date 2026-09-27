'use client';

import { useEffect, useState } from 'react';
import { ProductCard } from './ProductCard';

const COLUMN_LABELS: Record<string, string> = {
  evaluado: 'Evaluado',
  creativos_listos: 'Creativos listos',
  publicado: 'Publicado',
  en_campana: 'En campaña',
  pausado: 'Pausado / Finalizado',
};

export function PipelineBoard() {
  const [columns, setColumns] = useState<Record<string, any[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => r.json())
      .then((data) => setColumns(data.columns))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando pipeline...</p>;
  if (!columns) return <p>No se pudo cargar el pipeline.</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
      {Object.entries(COLUMN_LABELS).map(([key, label]) => (
        <div key={key}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>
            {label} <span style={{ opacity: 0.5 }}>({columns[key]?.length ?? 0})</span>
          </h3>
          {(columns[key] ?? []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ))}
    </div>
  );
}
