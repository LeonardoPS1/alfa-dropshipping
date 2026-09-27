import { chromium } from 'playwright';

export interface TrendResult {
  name: string;
  estimated_demand: number; // 0-100, heurística relativa
  raw_data: Record<string, unknown>;
}

/**
 * Scraping del TikTok Creative Center (Top Ads / Trending Products), que es
 * público y no requiere login. Si TikTok cambia el marcado de la página,
 * ajustar los selectores acá es el único punto de mantenimiento necesario.
 */
export async function scrapeTikTokTrends(niche?: string, limit = 20): Promise<TrendResult[]> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const url = niche
      ? `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=7&keyword=${encodeURIComponent(niche)}`
      : `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=7`;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Selector genérico sobre las cards de producto/anuncio; TikTok Creative
    // Center usa contenedores con data-testid, se ajusta si cambia el DOM.
    const cards = await page.$$('[data-testid="cc_card"], .CardPc_container__ZTAqB');

    const results: TrendResult[] = [];
    for (const card of cards.slice(0, limit)) {
      const name = (await card.textContent())?.trim().slice(0, 120) ?? 'producto sin nombre';
      results.push({
        name,
        estimated_demand: Math.max(40, 100 - results.length * 3), // orden de aparición como proxy de ranking
        raw_data: { source_url: url },
      });
    }

    return results;
  } finally {
    await browser.close();
  }
}
