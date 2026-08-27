/**
 * Tipos para MitsuhaVisualizer
 * 
 * Basados en la configuración original de MSHFConfig
 */

export type MitsuhaStyle = 'wave' | 'jello' | 'bar' | 'line' | 'dot' | 'siri';

export type MitsuhaColorMode = 'dynamic' | 'siri' | 'custom';

export interface MitsuhaConfig {
  // Estilo de visualización
  style: MitsuhaStyle;
  
  // Número de puntos/barras (8 es el default original)
  numberOfPoints: number;
  
  // Modo de color
  colorMode: MitsuhaColorMode;
  
  // Color personalizado (cuando colorMode es 'custom')
  waveColor: string;
  
  // Color secundario para efectos
  subwaveColor?: string;
  
  // Tercer color para modo Siri
  subSubwaveColor?: string;
  
  // Transparencia del color dinámico (0-1)
  dynamicColorAlpha: number;
  
  // Amplificación de la señal (default: 50)
  gain: number;
  
  // Sensibilidad (default: 1)
  sensitivity: number;
  
  // Límite máximo de altura
  limiter: number;
  
  // Desplazamiento vertical base
  waveOffset: number;
  
  // FPS de actualización (60 para Mitsuha original)
  fps: number;
  
  // Espaciado entre barras (para estilo bar/dot)
  barSpacing: number;
  
  // Radio de esquinas de las barras
  barCornerRadius: number;
  
  // Grosor de línea (para estilo line)
  lineThickness: number;
  
  // Habilitar FFT (análisis de frecuencia)
  enableFFT: boolean;
  
  // Deshabilitar ahorro de batería (auto-hide)
  disableBatterySaver: boolean;
}

/**
 * Configuración por defecto basada en MSHFView
 * 
 * Del código original:
 * - _numberOfPoints = 8
 * - self.gain = 50
 * - self.sensitivity = 1
 */
export const DEFAULT_CONFIG: MitsuhaConfig = {
  style: 'bar',
  numberOfPoints: 8,
  colorMode: 'dynamic',
  waveColor: '#1DB954',
  subwaveColor: '#1DB954',
  dynamicColorAlpha: 0.8,
  gain: 50,
  sensitivity: 1,
  limiter: 0,
  waveOffset: 0,
  fps: 60, // CADisplayLink corre a 60fps
  barSpacing: 4,
  barCornerRadius: 2,
  lineThickness: 3,
  enableFFT: false,
  disableBatterySaver: false,
};

export interface AudioSample {
  // Array de valores de amplitud normalizados (0-1)
  samples: number[];
  // Timestamp de la muestra
  timestamp: number;
  // Si hay audio activo
  isActive: boolean;
}

export interface MitsuhaVisualizerProps {
  // Configuración del visualizador
  config?: Partial<MitsuhaConfig>;
  
  // URI de la imagen del álbum (para color dinámico)
  albumArtUri?: string;
  
  // Si el audio está reproduciéndose
  isPlaying: boolean;
  
  // Datos de audio externos (opcional, si no se usa el hook interno)
  audioData?: number[];
  
  // Dimensiones
  width?: number;
  height?: number;
  
  // Callback cuando cambia la visibilidad
  onVisibilityChange?: (visible: boolean) => void;
}

// Punto para el path del visualizador
export interface WavePoint {
  x: number;
  y: number;
}
