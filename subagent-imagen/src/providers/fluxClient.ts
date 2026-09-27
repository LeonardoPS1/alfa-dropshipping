import axios from 'axios';

const client = axios.create({
  baseURL: process.env.IMAGE_PROVIDER_BASE_URL,
  headers: { 'x-key': process.env.IMAGE_PROVIDER_API_KEY ?? '' },
  timeout: 30000,
});

export interface GenerateImageParams {
  prompt: string;
  width?: number;
  height?: number;
}

/**
 * Cliente directo contra la API del proveedor de imagen (ej. Flux vía BFL).
 * Maneja el patrón asíncrono común de estos proveedores: se pide la
 * generación, se hace polling del resultado, y se descarga el binario final.
 */
export async function generateImage(params: GenerateImageParams): Promise<Buffer> {
  const { prompt, width = 1024, height = 1024 } = params;

  const submitResp = await withRetry(() =>
    client.post('/flux-pro-1.1', { prompt, width, height })
  );
  const requestId = submitResp.data.id;

  const resultUrl = await pollForResult(requestId);
  const imageResp = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(imageResp.data);
}

async function pollForResult(requestId: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await client.get('/get_result', { params: { id: requestId } });
    if (data.status === 'Ready') return data.result.sample as string;
    if (data.status === 'Error' || data.status === 'Failed') {
      throw new Error(`generación de imagen falló: ${JSON.stringify(data)}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('timeout esperando resultado de generación de imagen');
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err.response?.status;
      if (status !== 429 && (status < 500 || status >= 600)) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}
