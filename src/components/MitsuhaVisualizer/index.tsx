/**
 * MitsuhaVisualizer - Audio Visualizer basado en libmitsuha6
 * 
 * En iOS: Usa código NATIVO de libmitsuha6 (MSHFJelloView, MSHFJelloLayer)
 * - CABasicAnimation de 0.15s
 * - Curvas Bezier originales
 * - Rendimiento nativo a 60fps
 * 
 * En Android: Fallback al visualizador JavaScript
 */

import { Platform } from 'react-native';

// Exportar el visualizador principal según la plataforma
export { default as MitsuhaVisualizerNative } from './MitsuhaVisualizerNative';
export { default as MitsuhaVisualizer } from './MitsuhaVisualizer';

// Componente preferido: Nativo en iOS, JS en Android
export { default as MitsuhaVisualizerAuto } from './MitsuhaVisualizerNative';

// Vistas individuales (JS)
export { default as MitsuhaWaveView } from './views/MitsuhaWaveView';
export { default as MitsuhaBarView } from './views/MitsuhaBarView';
export { default as MitsuhaDotView } from './views/MitsuhaDotView';
export { default as MitsuhaSiriView } from './views/MitsuhaSiriView';
export * from './types';
export * from './hooks/useAudioMeter';
