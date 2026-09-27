import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

export interface DropiProduct {
  external_id: string;
  source_url: string;
  name: string;
  supplier_price: number | null;
  category: string;
  shipping_days_estimate: number | null;
}

export interface DropiProductCandidate {
  id?: string | null;
  href?: string | null;
  name?: string | null;
  priceText?: string | null;
  category?: string | null;
}

const DROPI_ORIGIN = 'https://app.dropi.cl';

/** Accept only a stable Dropi identifier also present in its product-detail URL. */
export function parseDropiProduct(candidate: DropiProductCandidate): DropiProduct | null {
  const name = candidate.name?.trim();
  if (!name) return null;

  let productUrl: URL;
  try {
    productUrl = new URL(candidate.href ?? '', DROPI_ORIGIN);
  } catch {
    return null;
  }
  if (productUrl.origin !== DROPI_ORIGIN) return null;

  const pathId = productUrl.pathname.match(/^\/dashboard\/products\/([A-Za-z0-9_-]{1,128})\/?$/)?.[1];
  const rowId = candidate.id?.trim();
  if (!pathId || (rowId && rowId !== pathId)) return null;

  productUrl.search = '';
  productUrl.hash = '';
  return {
    external_id: pathId,
    source_url: productUrl.toString(),
    name,
    supplier_price: parseObservedPrice(candidate.priceText),
    category: candidate.category?.trim() || 'uncategorized',
    shipping_days_estimate: null,
  };
}

function parseObservedPrice(text?: string | null): number | null {
  const normalized = text?.trim().replace(/^(?:CLP\s*)?\$?\s*/i, '');
  if (!normalized || !/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const SESSION_PATH = path.join('/app/.sessions', 'dropi-storage-state.json');

/**
 * Login autenticado contra app.dropi.cl reutilizando la sesión guardada en
 * disco (Playwright storageState) para no reloguear en cada llamada y evitar
 * bloqueos por logins repetidos.
 */
async function getAuthenticatedContext(): Promise<{ context: BrowserContext; browser: import('playwright').Browser }> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  if (fs.existsSync(SESSION_PATH)) {
    const context = await browser.newContext({ storageState: SESSION_PATH });
    return { context, browser };
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://app.dropi.cl/login', { waitUntil: 'networkidle', timeout: 30000 });

  await page.fill('input[type="email"], input[name="email"]', process.env.DROPI_EMAIL ?? '');
  await page.fill('input[type="password"], input[name="password"]', process.env.DROPI_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  await context.storageState({ path: SESSION_PATH });
  return { context, browser };
}

export async function scrapeDropiCatalog(query?: string, category?: string): Promise<DropiProduct[]> {
  const { context, browser } = await getAuthenticatedContext();
  try {
    const page = await context.newPage();
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (category) params.set('category', category);

    await page.goto(`https://app.dropi.cl/dashboard/products?${params.toString()}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Si la sesión guardada expiró, Dropi redirige a /login: re-loguear una vez.
    if (page.url().includes('/login')) {
      fs.rmSync(SESSION_PATH, { force: true });
      await browser.close();
      return scrapeDropiCatalog(query, category);
    }

    const rows = await page.$$('[data-testid="product-row"], table tbody tr');
    const products: DropiProduct[] = [];

    for (const row of rows) {
      const text = (await row.textContent())?.trim() ?? '';
      if (!text) continue;

      const priceMatch = text.match(/\$\s?([\d.,]+)/);
      const productId = await row.getAttribute('data-product-id');
      const detailLink = await row.$('a[href*="/dashboard/products/"]');
      const href = detailLink ? await detailLink.getAttribute('href') : null;
      const name = (await row.getAttribute('data-product-name'))?.trim() || text.slice(0, 150);
      const product = parseDropiProduct({
        id: productId,
        href,
        name,
        priceText: priceMatch?.[1] ?? null,
        category,
      });
      if (product) products.push(product);
    }

    return products;
  } finally {
    await context.close();
    await browser.close();
  }
}
