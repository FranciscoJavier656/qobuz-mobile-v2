/**
 * VImageColorExtractor - Extracción de colores ULTRA-RÁPIDA
 * 
 * Métodos disponibles:
 * 1. extractColorsFromAudio(audioUrl) - Extrae artwork del stream de audio (SIN descarga extra)
 * 2. extractColors(imageUri) - Extrae de imagen URL (con caché agresivo)
 * 
 * El artwork está embebido en el archivo de audio que ya se está descargando,
 * así que extraerlo de ahí es MUCHO más rápido que descargar la imagen por separado.
 */

import { NativeModules, Platform } from 'react-native';

interface ColorResult {
  hex: string;
  r: number;
  g: number;
  b: number;
}

interface ColorPalette {
  dominant: string;
  vibrant: string;
  muted: string;
  light: string;
  dark: string;
  topColors: string[];
}

interface VImageColorExtractorInterface {
  /**
   * Extrae colores del artwork embebido en el stream de audio
   * ⚡ MÉTODO MÁS RÁPIDO - usa el audio que ya se está reproduciendo
   */
  extractColorsFromAudio(audioUri: string): Promise<ColorPalette>;
  
  /**
   * Extrae la paleta completa de colores de una imagen URL
   */
  extractColors(imageUri: string): Promise<ColorPalette>;
  
  /**
   * Extrae solo el color dominante (más rápido)
   */
  getDominantColor(imageUri: string): Promise<ColorResult>;
  
  /**
   * Extrae el color promedio (más rápido aún)
   */
  getAverageColor(imageUri: string): Promise<ColorResult>;
  
  /**
   * Extrae los N colores principales
   */
  getTopColors(imageUri: string, count: number): Promise<ColorResult[]>;
}

const { VImageColorExtractor } = NativeModules;

// Verificar disponibilidad del módulo nativo - incluir métodos como indicador
const moduleExists = Platform.OS === 'ios' && VImageColorExtractor != null;
const moduleMethods = moduleExists ? Object.keys(VImageColorExtractor) : [];
const hasExtractColors = moduleMethods.includes('extractColors') || 
                         typeof VImageColorExtractor?.extractColors === 'function';

// El módulo está disponible si existe Y tiene métodos O si podemos llamar extractColors
const isAvailable = moduleExists && (moduleMethods.length > 0 || hasExtractColors);

// Log detallado para debug
if (Platform.OS === 'ios') {
  console.log('[VImageColorExtractor] 📱 iOS Platform detected');
  console.log('[VImageColorExtractor] Module exists:', moduleExists);
  console.log('[VImageColorExtractor] Module methods:', moduleMethods);
  console.log('[VImageColorExtractor] Has extractColors:', hasExtractColors);
  console.log('[VImageColorExtractor] Is available:', isAvailable);
  
  // Intentar llamar ping para verificar
  if (VImageColorExtractor && typeof VImageColorExtractor.ping === 'function') {
    try {
      VImageColorExtractor.ping();
      console.log('[VImageColorExtractor] ✅ ping() called successfully');
    } catch (e) {
      console.log('[VImageColorExtractor] ❌ ping() failed:', e);
    }
  }
} else {
  console.log('[VImageColorExtractor] ⚠️ Not iOS, module disabled');
}

/**
 * Wrapper con fallback para cuando el módulo no está disponible
 */
class VImageColorExtractorWrapper implements VImageColorExtractorInterface {
  private native: any;
  
  constructor() {
    this.native = isAvailable ? VImageColorExtractor : null;
  }
  
  /**
   * Verifica si el módulo nativo está disponible
   */
  isAvailable(): boolean {
    return this.native != null;
  }
  
  /**
   * ⚡ MÉTODO PREFERIDO - Extrae colores del artwork embebido en el audio
   * No necesita descargar imagen por separado
   */
  async extractColorsFromAudio(audioUri: string): Promise<ColorPalette> {
    if (!this.native) {
      console.log('[VImageColorExtractor] Module not available, using fallback');
      return this.getFallbackPalette();
    }
    
    try {
      console.log('[VImageColorExtractor] 🎵 Extracting from audio stream...');
      return await this.native.extractColorsFromAudio(audioUri);
    } catch (error) {
      console.warn('[VImageColorExtractor] extractColorsFromAudio failed:', error);
      return this.getFallbackPalette();
    }
  }
  
  async extractColors(imageUri: string): Promise<ColorPalette> {
    if (!this.native) {
      return this.getFallbackPalette();
    }
    
    try {
      return await this.native.extractColors(imageUri);
    } catch (error) {
      console.warn('[VImageColorExtractor] extractColors failed:', error);
      return this.getFallbackPalette();
    }
  }
  
  async getDominantColor(imageUri: string): Promise<ColorResult> {
    if (!this.native) {
      return this.getFallbackColor();
    }
    
    try {
      return await this.native.getDominantColor(imageUri);
    } catch (error) {
      console.warn('[VImageColorExtractor] getDominantColor failed:', error);
      return this.getFallbackColor();
    }
  }
  
  async getAverageColor(imageUri: string): Promise<ColorResult> {
    if (!this.native) {
      return this.getFallbackColor();
    }
    
    try {
      return await this.native.getAverageColor(imageUri);
    } catch (error) {
      console.warn('[VImageColorExtractor] getAverageColor failed:', error);
      return this.getFallbackColor();
    }
  }
  
  async getTopColors(imageUri: string, count: number = 5): Promise<ColorResult[]> {
    if (!this.native) {
      return [this.getFallbackColor()];
    }
    
    try {
      return await this.native.getTopColors(imageUri, count);
    } catch (error) {
      console.warn('[VImageColorExtractor] getTopColors failed:', error);
      return [this.getFallbackColor()];
    }
  }
  
  private getFallbackColor(): ColorResult {
    return { hex: '#1DB954', r: 29, g: 185, b: 84 };
  }
  
  private getFallbackPalette(): ColorPalette {
    return {
      dominant: '#1DB954',
      vibrant: '#1DB954',
      muted: '#14853E',
      light: '#4AE87F',
      dark: '#0A5C2A',
      topColors: ['#1DB954', '#14853E', '#4AE87F']
    };
  }
}

// Exportar instancia singleton
export const vImageColorExtractor = new VImageColorExtractorWrapper();

// Exportar tipos
export type { ColorResult, ColorPalette, VImageColorExtractorInterface };

// Exportar función de verificación
export const isVImageAvailable = (): boolean => isAvailable;
