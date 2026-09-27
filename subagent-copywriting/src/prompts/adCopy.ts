export function buildAdCopyPrompt(params: {
  productName: string;
  justification: string;
  platform: 'meta' | 'tiktok';
  angle: string;
}): { system: string; user: string } {
  const { productName, justification, platform, angle } = params;

  const platformRules =
    platform === 'meta'
      ? 'Formato Meta Ads: headline de máximo 40 caracteres, texto primario de máximo 125 caracteres. Tono directo, orientado a beneficio y urgencia.'
      : 'Formato TikTok Ads: tono conversacional, nativo de la plataforma, como si fuera un creador hablando a cámara, no un anuncio tradicional. Máximo 100 caracteres.';

  return {
    system:
      'Sos copywriter especializado en anuncios de ecommerce/dropshipping para el mercado chileno. ' +
      'Escribís en español de Chile, directo, sin relleno. Nunca inventás datos del producto que no te dieron.',
    user:
      `Producto: ${productName}\n` +
      `Contexto de evaluación: ${justification}\n` +
      `Plataforma: ${platform}\n` +
      `Ángulo pedido: ${angle}\n\n` +
      `${platformRules}\n\n` +
      `Devolvé SOLO el texto del anuncio, sin explicaciones ni comillas.`,
  };
}

export const AD_COPY_ANGLES = ['problema/dolor', 'beneficio directo', 'prueba social'] as const;
