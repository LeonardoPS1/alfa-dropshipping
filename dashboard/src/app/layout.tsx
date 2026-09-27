import type { ReactNode } from 'react';

export const metadata = {
  title: 'ALFA — Dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ background: '#0a0a0a', color: '#eaeaea', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <nav style={{ display: 'flex', gap: 16, padding: 16, borderBottom: '1px solid #222' }}>
          <a href="/" style={{ color: 'inherit' }}>Pipeline</a>
          <a href="/chat" style={{ color: 'inherit' }}>Chat con ALFA</a>
          <a href="/campaigns" style={{ color: 'inherit' }}>Campañas</a>
        </nav>
        <main style={{ padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
