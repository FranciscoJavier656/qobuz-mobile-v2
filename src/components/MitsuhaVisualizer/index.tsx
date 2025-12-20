/**
 * MitsuhaVisualizer - Audio Visualizer basado en libmitsuha6
 * 
 * En iOS: Usa código NATIVO de libmitsuha6 (MSHFJelloView, MSHFJelloLayer)
 * - CABasicAnimation de 0.15s
 * - Curvas Bezier originales
 * - Rendimiento nativo a 60fps
 * 
 * NUEVO: Soporte Metal GPU Rendering
 * - MitsuhaMetalVisualizer para renderizado en GPU
 * - Shaders optimizados para curvas Bézier
 * - 60fps con bajo consumo de CPU
 * 
 * En Android: Fallback al visualizador JavaScript
 */

import { Platform } from 'react-native';

// Exportar el visualizador principal según la plataforma
export { default as MitsuhaVisualizerNative } from './MitsuhaVisualizerNative';
export { default as MitsuhaVisualizer } from './MitsuhaVisualizer';

// NUEVO: Visualizador con Metal GPU Rendering
export { default as MitsuhaMetalVisualizer, VisualizerStyle } from './MitsuhaMetalVisualizer';

// Componente preferido: Nativo en iOS, JS en Android
export { default as MitsuhaVisualizerAuto } from './MitsuhaVisualizerNative';

// Vistas individuales (JS)
export { default as MitsuhaWaveView } from './views/MitsuhaWaveView';
export { default as MitsuhaBarView } from './views/MitsuhaBarView';
export { default as MitsuhaDotView } from './views/MitsuhaDotView';
export { default as MitsuhaSiriView } from './views/MitsuhaSiriView';
export * from './types';
export * from './hooks/useAudioMeter';
