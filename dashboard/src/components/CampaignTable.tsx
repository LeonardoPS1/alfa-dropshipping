'use client';

import { useState } from 'react';

interface Campaign {
  id: string;
  product_name: string;
  platform: string;
  budget: number;
  spend: number;
  roas: number | null;
  status: string;
  last_checked_at: string | null;
}

export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  const [pausing, setPausing] = useState<string | null>(null);

  async function pauseCampaign(id: string) {
    setPausing(id);
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `pausá la campaña ${id}` }),
    });
    setPausing(null);
    window.location.reload();
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
          <th>Producto</th>
          <th>Plataforma</th>
          <th>Budget</th>
          <th>Spend</th>
          <th>ROAS</th>
          <th>Estado</th>
          <th>Última actualización</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c) => (
          <tr key={c.id} style={{ borderBottom: '1px solid #222' }}>
            <td>{c.product_name}</td>
            <td>{c.platform}</td>
            <td>${c.budget}</td>
            <td>${c.spend}</td>
            <td>{c.roas != null ? c.roas.toFixed(2) : '—'}</td>
            <td>{c.status}</td>
            <td>{c.last_checked_at ? new Date(c.last_checked_at).toLocaleString('es-CL') : '—'}</td>
            <td>
              {c.status === 'active' && (
                <button onClick={() => pauseCampaign(c.id)} disabled={pausing === c.id}>
                  {pausing === c.id ? 'Pausando...' : 'Pausar'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
