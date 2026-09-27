export function buildCaptionsPrompt(params: {
  productName: string;
  platform: 'instagram' | 'tiktok';
  count: number;
}): { system: string; user: string } {
  const { productName, platform, count } = params;

  return {
    system:
      'Sos community manager especializado en RRSS de ecommerce, mercado chileno, español de Chile. ' +
      'Los hashtags que uses deben ser relevantes al nicho del producto, evitá genéricos vacíos tipo #viral #fyp salvo que aporten alcance real.',
    user:
      `Producto: ${productName}\n` +
      `Plataforma: ${platform}\n` +
      `Cantidad de variantes: ${count}\n\n` +
      `Generá ${count} captions distintos (ángulos distintos entre sí), cada uno con 3-5 hashtags relevantes al final. ` +
      `Devolvé un array JSON de strings, sin texto adicional. Ejemplo: ["caption 1 #hashtag", "caption 2 #hashtag"]`,
  };
}
