export const APP_ID = '798273057';
export const BASE_URL = 'https://www.qobuz.com/api.json/0.2';
export const BUNDLE_BASE_URL = 'https://play.qobuz.com';

export const CACHE_TTL_DOWNLOAD_URL = 30 * 60 * 1000; // 30 minutos
export const CACHE_TTL_APP_SECRET = 120 * 60 * 1000; // 120 minutos
export const CACHE_TTL_BUNDLE = 120 * 60 * 1000; // 120 minutos
export const CACHE_TTL_METADATA = 60 * 60 * 1000; // 60 minutos

export const MAX_RETRIES = 3;
export const RETRY_DELAY_BASE = 1000; // 1s, 2s, 4s exponencial
export const MAX_CONCURRENT_REQUESTS = 3;

export const FORMATS = {
  MP3_320: '5',
  FLAC_CD: '6',
  FLAC_HIRES: '7',
  FLAC_HIRES_PLUS: '27' // Default
};

export const USER_AGENT = 'Mozilla/5.0 (compatible; QobuzDownloader/2.0)';

export const PREVIEW_DURATION = 30; // segundos

export const KNOWN_SECRETS = [
  'abb21364945c0583309667d13ca3d93a', // Ejemplo Sept 2025 (PUEDE ESTAR OBSOLETO)
  'f686f063cb0841079d48495d4dea7cf2', // Historico
  '05a4851e74ee47fda346f50cfdfc4f09', // Historico
  'c7c75df0fdd951e98fc22971e4acf8d2', // Historico
  '3b42129256f35f75923663b69a1f52b2'  // Historico
];