/**
 * useImageColors - Extracción de colores optimizada con vImage (iOS)
 * 
 * Usa el framework Accelerate de Apple para extracción ultra-rápida.
 * Fallback a react-native-image-colors si vImage no está disponible.
 */

import { useState, useEffect } from 'react';
import { Platform, NativeModules } from 'react-native';
import { getColors } from 'react-native-image-colors';

const { VImageColorExtractor } = NativeModules;

interface ImageColorsResult {
  primaryColor: string;
  secondaryColor: string;
  isLoading: boolean;
  error: string | null;
}

// Colores por defecto
const DEFAULT_PRIMARY = '#1DB954';
const DEFAULT_SECONDARY = '#19A34A';

/**
 * Oscurece un color hex - estilo Mitsuha Six
 * El color secundario es muy similar al primario, solo ligeramente más oscuro
 * para crear un gradiente sutil, no un cambio drástico
 */
function darkenColor(hex: string, amount: number = 0.12): string {
  if (!hex || hex.length < 7) return DEFAULT_SECONDARY;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xFF) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xFF) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xFF) * (1 - amount)));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

/**
 * Verifica si un color es muy claro o muy oscuro
 */
function isExtreme(hex: string): boolean {
  if (!hex || hex.length < 7) return true;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 30 || brightness > 225;
}

/**
 * Verifica si vImage está disponible
 */
function isVImageAvailable(): boolean {
  return Platform.OS === 'ios' && VImageColorExtractor != null;
}

/**
 * Calcula la saturación de un color (0-1)
 */
function getSaturation(hex: string): number {
  if (!hex || hex.length < 7) return 0;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = ((num >> 16) & 0xFF) / 255;
  const g = ((num >> 8) & 0xFF) / 255;
  const b = (num & 0xFF) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Calcula el brillo de un color (0-255)
 */
function getBrightness(hex: string): number {
  if (!hex || hex.length < 7) return 0;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Calcula un score de "vibrancia" - colores saturados con brillo medio son mejores
 */
function getVibrancyScore(hex: string): number {
  const sat = getSaturation(hex);
  const bright = getBrightness(hex);
  
  // Penalizar colores muy oscuros (<40) o muy claros (>220)
  let brightnessFactor = 1;
  if (bright < 40) brightnessFactor = 0.2;
  else if (bright > 220) brightnessFactor = 0.3;
  else if (bright > 60 && bright < 200) brightnessFactor = 1.2; // Bonus para brillo medio
  
  return sat * brightnessFactor;
}

/**
 * Extrae colores usando vImage (iOS nativo)
 * Algoritmo estilo Mitsuha6: prefiere colores VIBRANTES sobre negro/blanco
 */
async function extractWithVImage(imageUri: string): Promise<string | null> {
  try {
    const palette = await VImageColorExtractor.extractColors(imageUri);
    console.log('[useImageColors] 📦 Paleta:', JSON.stringify(palette));
    
    // Recolectar todos los colores candidatos
    const candidates = [
      palette.vibrant,
      palette.muted,
      palette.light,
      palette.dark,
      palette.dominant,
      ...(palette.topColors || [])
    ].filter(Boolean);
    
    // Calcular vibrancia de cada color y elegir el mejor
    let bestColor = palette.vibrant || palette.dominant;
    let bestScore = 0;
    
    for (const color of candidates) {
      const score = getVibrancyScore(color);
      console.log(`[useImageColors] 🎨 ${color} -> score: ${score.toFixed(2)}`);
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    // Si ninguno tiene buena vibrancia, usar vibrant o muted
    if (bestScore < 0.1) {
      bestColor = palette.vibrant || palette.muted || palette.dominant;
    }
    
    console.log('[useImageColors] ✅ Mejor color:', bestColor, 'score:', bestScore.toFixed(2));
    return bestColor || null;
  } catch (error) {
    console.warn('[useImageColors] ❌ vImage error:', error);
    return null;
  }
}

/**
 * Extrae colores usando react-native-image-colors (fallback)
 */
async function extractWithFallback(imageUri: string): Promise<string | null> {
  try {
    const result = await getColors(imageUri, {
      fallback: DEFAULT_PRIMARY,
      cache: true,
      key: imageUri,
    });

    let color = DEFAULT_PRIMARY;

    if (result.platform === 'ios') {
      const candidates = [
        result.background,
        result.primary,
        result.secondary,
        result.detail,
      ].filter(c => c && !isExtreme(c));
      
      color = candidates[0] || result.background || DEFAULT_PRIMARY;
    } else if (result.platform === 'android') {
      color = result.vibrant || result.dominant || DEFAULT_PRIMARY;
    }

    return color;
  } catch (error) {
    console.warn('[useImageColors] Fallback error:', error);
    return null;
  }
}

/**
 * Hook principal para extraer colores de una imagen
 */
export function useImageColors(imageUri: string | undefined): ImageColorsResult {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUri) {
      setPrimaryColor(DEFAULT_PRIMARY);
      setSecondaryColor(DEFAULT_SECONDARY);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const extractColors = async () => {
      try {
        let color: string | null = null;

        console.log('[useImageColors] 🎯 Extrayendo para:', imageUri.substring(imageUri.length - 40));

        // 1. Intentar vImage primero (iOS nativo, más rápido)
        if (isVImageAvailable()) {
          console.log('[useImageColors] 📱 vImage disponible, intentando...');
          color = await extractWithVImage(imageUri);
          console.log('[useImageColors] 📱 vImage retornó:', color);
        } else {
          console.log('[useImageColors] ⚠️ vImage NO disponible');
        }

        // 2. Fallback a react-native-image-colors
        if (!color) {
          console.log('[useImageColors] 🔄 Usando fallback...');
          color = await extractWithFallback(imageUri);
          console.log('[useImageColors] 🔄 Fallback retornó:', color);
        }

        if (cancelled) return;

        console.log('[useImageColors] 🎨 Color a aplicar:', color);
        
        if (color && color !== DEFAULT_PRIMARY) {
          console.log('[useImageColors] ✅ Aplicando color:', color);
          setPrimaryColor(color);
          setSecondaryColor(darkenColor(color));
        } else {
          console.log('[useImageColors] ⚠️ Color es default o null, no se aplica');
        }
      } catch (err) {
        console.log('[useImageColors] ❌ Error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    extractColors();

    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  return { primaryColor, secondaryColor, isLoading, error };
}

// Funciones de compatibilidad (no-op por ahora)
export async function preloadImageColors(_uri: string): Promise<void> {}
export async function preloadMultipleImageColors(_uris: string[]): Promise<void> {}
