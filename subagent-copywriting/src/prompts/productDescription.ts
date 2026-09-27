export function buildProductDescriptionPrompt(params: {
  productName: string;
  category: string;
  length: 'short' | 'long';
}): { system: string; user: string } {
  const { productName, category, length } = params;

  return {
    system:
      'Sos copywriter de ecommerce especializado en fichas de producto para Shopify, mercado chileno, español de Chile.',
    user:
      `Producto: ${productName}\n` +
      `Categoría: ${category}\n` +
      `Longitud: ${length === 'short' ? '2-3 líneas' : '4-6 bullets de beneficios + 1 párrafo de cierre'}\n\n` +
      `Escribí una descripción de producto lista para publicar en una ficha de Shopify. ` +
      `Formato HTML simple (usá <p> y <ul><li> si corresponde). No inventes especificaciones técnicas que no te di.`,
  };
}
