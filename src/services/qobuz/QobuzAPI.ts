import type { Track, Album, Artist } from './types';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

interface AppSecretCache {
  secret: string;
  expiry: number;
}

export class QobuzAPI {
  private APP_ID: string;
  private BASE_URL: string;
  private userAuthToken: string | null;
  private appSecretCache: AppSecretCache | null = null;
  private CACHE_TTL = 30 * 60 * 1000; // 30 minutos en milisegundos

  constructor() {
    this.APP_ID = '798273057';
    this.BASE_URL = 'https://www.qobuz.com/api.json/0.2';
    this.userAuthToken = null;
  }

  private getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (compatible; QobuzDownloader/2.0)',
      'X-App-Id': this.APP_ID,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };
  }

  public async login(email: string, password: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', password);
      params.append('app_id', this.APP_ID);

      const response = await axios.post(
        `${this.BASE_URL}/user/login`,
        params.toString(),
        {
          headers: this.getHeaders(),
        }
      );

      if (response.data && response.data.user_auth_token) {
        this.userAuthToken = response.data.user_auth_token;
        return response.data;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('QobuzAPI login error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  public async searchTracks(query: string, limit: number = 50): Promise<Track[]> {
    try {
      if (!this.userAuthToken) {
        throw new Error('Not authenticated');
      }

      const response = await axios.get(`${this.BASE_URL}/track/search`, {
        params: {
          query,
          limit,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
        },
        headers: this.getHeaders(),
      });

      const tracks = response.data.tracks?.items || [];
      
      // Log para ver la estructura de los tracks
      if (tracks.length > 0) {
        console.log('[QobuzAPI] Sample track data:', JSON.stringify(tracks[0], null, 2));
      }

      return tracks;
    } catch (error: any) {
      console.error('Search tracks error:', error);
      return [];
    }
  }

  public async getTrackStreamUrl(trackId: string, formatId: string = '27'): Promise<string> {
    try {
      if (!this.userAuthToken) {
        throw new Error('Not authenticated');
      }

      const response = await axios.get(`${this.BASE_URL}/track/getFileUrl`, {
        params: {
          track_id: trackId,
          format_id: formatId,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
        },
        headers: this.getHeaders(),
      });

      return response.data.url || '';
    } catch (error: any) {
      console.error('Get track stream URL error:', error);
      throw error;
    }
  }

  public getPreviewUrl(trackId: number): string {
    // Qobuz preview URL pattern - intentar formato alternativo
    // Formato 1: Samples con padding
    return `https://samples.qobuz.com/${String(trackId).padStart(19, '0')}_sample.mp3`;
  }

  // Extrae el app_secret dinámico de Qobuz (algoritmo QobuzApiSharp)
  private async extractDynamicAppSecret(): Promise<string | null> {
    try {
      console.log('[QobuzAPI] 🔐 Extracting dynamic app_secret...');
      
      // Paso 1: Obtener la página de login para encontrar el bundle.js
      console.log('[QobuzAPI] 📥 Step 1/4: Downloading login page...');
      const loginResponse = await axios.get('https://play.qobuz.com/login', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const html = loginResponse.data;
      
      // Paso 2: Buscar el enlace al bundle.js
      console.log('[QobuzAPI] 🔍 Step 2/4: Finding bundle.js URL...');
      const bundleMatch = html.match(/<script src="(\/resources\/[\d\.]+-[a-z]\d+\/bundle\.js)/);
      
      if (!bundleMatch) {
        console.log('[QobuzAPI] ❌ Bundle.js not found in HTML');
        return null;
      }
      
      const bundleUrl = `https://play.qobuz.com${bundleMatch[1]}`;
      console.log('[QobuzAPI] ✅ Bundle URL:', bundleUrl);
      
      // Paso 3: Descargar el bundle.js (puede ser grande, ~5MB)
      console.log('[QobuzAPI] 📦 Step 3/4: Downloading bundle.js (this may take a moment)...');
      const bundleResponse = await axios.get(bundleUrl, {
        timeout: 30000,
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const bundleContent = bundleResponse.data;
      console.log('[QobuzAPI] ✅ Bundle downloaded:', (bundleContent.length / 1024 / 1024).toFixed(2), 'MB');
      
      // Paso 4: Extraer seed, info y extras usando regex (algoritmo QobuzApiSharp)
      console.log('[QobuzAPI] 🔎 Step 4/4: Extracting seed, info, and extras...');
      
      // 4.1: Buscar seed y timezone
      const seedPatterns = [
        /\):[a-z]\.initialSeed\("([^"]*)",window\.utimezone\.([a-z]+)\)/,
        /initialSeed\("([^"]*)",window\.utimezone\.([a-z]+)\)/,
      ];
      
      let seedMatch = null;
      for (const pattern of seedPatterns) {
        seedMatch = bundleContent.match(pattern);
        if (seedMatch) break;
      }
      
      if (!seedMatch) {
        console.log('[QobuzAPI] ❌ Seed not found');
        return null;
      }
      
      const seed = seedMatch[1];
      const timezone = seedMatch[2].charAt(0).toUpperCase() + seedMatch[2].slice(1);
      console.log('[QobuzAPI] 🌱 Seed:', seed.substring(0, 10) + '...');
      console.log('[QobuzAPI] 🌍 Timezone:', timezone);
      
      // 4.2: Buscar info y extras para el timezone
      const infoPattern = new RegExp(`${timezone}"[^"]*info:"([^"]*)"`, 'i');
      const infoMatch = bundleContent.match(infoPattern);
      
      if (!infoMatch) {
        console.log('[QobuzAPI] ❌ Info not found for timezone:', timezone);
        return null;
      }
      
      const info = infoMatch[1];
      console.log('[QobuzAPI] ℹ️ Info:', info.substring(0, 10) + '...');
      
      // 4.3: Buscar extras
      const extrasPattern = new RegExp(`${timezone}"[^"]*info:"[^"]*",extras:"([^"]*)"`, 'i');
      const extrasMatch = bundleContent.match(extrasPattern);
      
      if (!extrasMatch) {
        console.log('[QobuzAPI] ❌ Extras not found');
        return null;
      }
      
      const extras = extrasMatch[1];
      console.log('[QobuzAPI] ✨ Extras:', extras.substring(0, 10) + '...');
      
      // 4.4: Generar app_secret usando el algoritmo EXACTO de QobuzApiSharp
      // Algoritmo correcto: concatenar seed+info+extras, quitar últimos 44 chars, decodificar base64
      let base64EncodedAppSecret = seed + info + extras;
      base64EncodedAppSecret = base64EncodedAppSecret.slice(0, -44); // ELIMINA los últimos 44 caracteres
      
      console.log('[QobuzAPI] 🔧 Base64 string length after trim:', base64EncodedAppSecret.length);
      console.log('[QobuzAPI] 🔧 Base64 preview:', base64EncodedAppSecret.substring(0, 30) + '...');
      
      // Decodificar de Base64 a bytes y convertir a UTF-8
      const decodedBytes = Buffer.from(base64EncodedAppSecret, 'base64'); // Decodifica de Base64
      const appSecret = decodedBytes.toString('utf-8'); // Convierte a UTF-8
      
      console.log('[QobuzAPI] 🔑 ✅ Dynamic app_secret extracted successfully!');
      console.log('[QobuzAPI] 🔑 App secret length:', appSecret.length, 'chars');
      console.log('[QobuzAPI] 🔑 App secret preview:', appSecret.substring(0, 10) + '...' + appSecret.substring(appSecret.length - 10));
      
      // Guardar en caché
      this.appSecretCache = {
        secret: appSecret,
        expiry: Date.now() + this.CACHE_TTL
      };
      
      return appSecret;
      
    } catch (error: any) {
      console.error('[QobuzAPI] ❌ Error extracting dynamic secret:', error.message);
      return null;
    }
  }

  // Obtiene el app_secret (desde caché o extracción dinámica)
  private async getAppSecret(): Promise<string> {
    // Verificar caché primero
    if (this.appSecretCache && this.appSecretCache.expiry > Date.now()) {
      console.log('[QobuzAPI] ⚡ Using cached app_secret (valid for', 
        Math.floor((this.appSecretCache.expiry - Date.now()) / 1000 / 60), 'more minutes)');
      return this.appSecretCache.secret;
    }
    
    // Si no hay caché válido, extraer dinámicamente
    console.log('[QobuzAPI] 🔄 Cache expired or empty, extracting new app_secret...');
    const dynamicSecret = await this.extractDynamicAppSecret();
    
    if (dynamicSecret) {
      return dynamicSecret;
    }
    
    // Si la extracción dinámica falla, lanzar error
    throw new Error('Failed to extract app_secret. Cannot generate valid request signatures.');
  }

  // Genera la firma MD5 requerida por Qobuz API (basado en el código de la app Electron)
  // ALGORITMO EXACTO: trackgetFileUrl + format_id{value} + intent{value} + track_id{value} + timestamp + app_secret
  private generateRequestSignature(trackId: number, formatId: number, intent: string, timestamp: number, appSecret: string): string {
    const endpoint = 'trackgetFileUrl';
    // IMPORTANTE: Los parámetros deben ir en orden alfabético sin espacios ni separadores
    const stringToHash = `${endpoint}format_id${formatId}intent${intent}track_id${trackId}${timestamp}${appSecret}`;
    
    const signature = CryptoJS.MD5(stringToHash).toString();
    
    return signature;
  }

  public async getTrackFileUrl(trackId: number, intent: 'stream' | 'sample' = 'stream'): Promise<string> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const formatId = 5; // Formato para preview (MP3 320)
      
      console.log('[QobuzAPI] 🎵 Getting file URL for track:', trackId);
      
      // Obtener app_secret (caché o extracción dinámica)
      const appSecret = await this.getAppSecret();
      
      // Generar la firma MD5
      const signature = this.generateRequestSignature(trackId, formatId, intent, timestamp, appSecret);
      
      console.log('[QobuzAPI] 🔐 Request signature generated');
      
      const response = await axios.get(`${this.BASE_URL}/track/getFileUrl`, {
        params: {
          track_id: trackId,
          format_id: formatId,
          intent: intent,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
          request_ts: timestamp,
          request_sig: signature,
        },
        headers: this.getHeaders(),
      });

      if (response.data && response.data.url) {
        console.log('[QobuzAPI] ✅ File URL obtained successfully');
        return response.data.url;
      }
      
      throw new Error('No URL in response');
      
    } catch (error: any) {
      console.error('[QobuzAPI] ❌ getFileUrl error:', error.response?.data || error.message);
      throw error;
    }
  }

  public async getTrackInfo(trackId: number): Promise<any> {
    try {
      const response = await axios.get(`${this.BASE_URL}/track/get`, {
        params: {
          track_id: trackId,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
        },
        headers: this.getHeaders(),
      });

      console.log('[QobuzAPI] Track info:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[QobuzAPI] getTrackInfo error:', error.response?.data || error.message);
      throw error;
    }
  }

  public async fetchAlbum(albumId: string): Promise<Album> {
    try {
      const response = await axios.get(`${this.BASE_URL}/album/get`, {
        params: {
          album_id: albumId,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
        },
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error: any) {
      console.error('Fetch album error:', error);
      throw error;
    }
  }

  public async fetchArtist(artistId: string): Promise<Artist> {
    try {
      const response = await axios.get(`${this.BASE_URL}/artist/get`, {
        params: {
          artist_id: artistId,
          app_id: this.APP_ID,
          user_auth_token: this.userAuthToken,
        },
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error: any) {
      console.error('Fetch artist error:', error);
      throw error;
    }
  }

  public setAuthToken(token: string) {
    this.userAuthToken = token;
  }

  public getAuthToken(): string | null {
    return this.userAuthToken;
  }
}
