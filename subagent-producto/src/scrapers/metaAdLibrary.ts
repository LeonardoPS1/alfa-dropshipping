import axios from 'axios';

/**
 * Cuenta anuncios activos en la Meta Ad Library que mencionan el término
 * dado, como proxy de saturación de mercado para un producto.
 * Requiere META_AD_LIBRARY_TOKEN (Meta App con acceso a Ad Library API).
 */
export async function countActiveAds(searchTerm: string, countryCode = 'CL'): Promise<number> {
  const token = process.env.META_AD_LIBRARY_TOKEN;
  if (!token) {
    console.warn('[meta-ad-library] META_AD_LIBRARY_TOKEN no configurado, devolviendo 0');
    return 0;
  }

  const { data } = await axios.get('https://graph.facebook.com/v20.0/ads_archive', {
    params: {
      access_token: token,
      search_terms: searchTerm,
      ad_reached_countries: JSON.stringify([countryCode]),
      ad_active_status: 'ACTIVE',
      limit: 100,
      fields: 'id',
    },
    timeout: 15000,
  });

  return Array.isArray(data?.data) ? data.data.length : 0;
}
