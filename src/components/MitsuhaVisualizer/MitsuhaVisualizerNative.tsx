/**
 * NativeMitsuhaView - Componente React Native que usa el visualizador nativo
 * 
 * Este componente usa el código ORIGINAL de libmitsuha (MSHJelloView/MSHJelloLayer)
 * compilado nativamente en iOS, lo que proporciona:
 * 
 * - CABasicAnimation de 150ms (imposible de replicar en JS)
 * - Curvas Bezier con midPointForPoints/controlPointForPoints originales
 * - CADisplayLink a 60fps
 * - Rendimiento nativo sin bridge overhead
 * - Animación gelatinosa: emerge elásticamente y se derrite al desaparecer
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  requireNativeComponent,
  StyleSheet,
  View,
  Platform,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useImageColors } from './hooks/useImageColors';

// Tipo del componente nativo
interface NativeMitsuhaViewProps {
  style?: ViewStyle;
  isPlaying: boolean;
  primaryColor: string;
  secondaryColor: string;
  numberOfPoints?: number;
  gain?: number;
  sensitivity?: number;
  waveOffset?: number;
}

// Requerir el componente nativo de iOS - solo una vez
let RNMitsuhaView: React.ComponentType<NativeMitsuhaViewProps> | null = null;
if (Platform.OS === 'ios') {
  try {
    RNMitsuhaView = requireNativeComponent<NativeMitsuhaViewProps>('RNMitsuhaView');
  } catch (e) {
    console.warn('[MitsuhaVisualizerNative] Native component already registered or not available');
  }
}

// Props públicas del componente
interface MitsuhaVisualizerNativeProps {
  isPlaying: boolean;
  albumArtUri?: string;
  width?: number;
  height?: number;
  config?: {
    numberOfPoints?: number;
    gain?: number;
    sensitivity?: number;
    waveOffset?: number;
    colorMode?: 'dynamic' | 'custom';
    waveColor?: string;
    subwaveColor?: string;
  };
}

const MitsuhaVisualizerNative: React.FC<MitsuhaVisualizerNativeProps> = ({
  isPlaying,
  albumArtUri,
  width = 400,
  height = 350,
  config = {},
}) => {
  // Animación simple de opacidad y posición - sin deformar el fluido
  // Inicializar según el estado actual de isPlaying
  const opacity = useSharedValue(isPlaying ? 1 : 0);
  const translateY = useSharedValue(isPlaying ? 0 : 20);
  const prevIsPlaying = useRef(isPlaying);
  const isFirstRender = useRef(true);

  // Extraer colores de la imagen del álbum
  const { primaryColor, secondaryColor } = useImageColors(
    config.colorMode === 'dynamic' ? albumArtUri : undefined
  );

  // Animación de visibilidad - suave y respetando la forma del fluido
  useEffect(() => {
    // Saltar animación en el primer render si ya está playing
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (isPlaying && !prevIsPlaying.current) {
      // APARECER: Fade in suave + emerge ligeramente desde abajo
      // El fluido mantiene su forma, solo aparece suavemente
      opacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
        mass: 0.8,
      });
    } else if (!isPlaying && prevIsPlaying.current) {
      // DESAPARECER: El fluido se "hunde" suavemente hacia abajo mientras desaparece
      // Como si se derritiera y hundiera en el suelo
      translateY.value = withTiming(30, {
        duration: 600,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, {
        duration: 500,
        easing: Easing.in(Easing.quad),
      });
    }
    prevIsPlaying.current = isPlaying;
  }, [isPlaying]);

  // Estilo animado - solo opacidad y translación, SIN escala que deforme
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
      ],
    };
  });

  // Determinar colores finales
  const finalPrimaryColor = useMemo(() => {
    if (config.colorMode === 'custom' && config.waveColor) {
      return config.waveColor;
    }
    return primaryColor;
  }, [config.colorMode, config.waveColor, primaryColor]);

  // Para el color secundario: en modo dinámico dejamos que el código nativo iOS
  // use su fallback (mismo color con 60% alpha) que es más fiel a Mitsuha Six original.
  // Solo pasamos secondaryColor si está en modo custom con color específico.
  const finalSecondaryColor = useMemo(() => {
    if (config.colorMode === 'custom' && config.subwaveColor) {
      return config.subwaveColor;
    }
    // Retornar undefined para que iOS use su fallback nativo
    return undefined;
  }, [config.colorMode, config.subwaveColor]);

  // En Android o si no está disponible el componente nativo, mostrar fallback
  if (!RNMitsuhaView) {
    // Fallback para Android - usar el visualizador JS existente
    const { MitsuhaVisualizer } = require('./index');
    return (
      <MitsuhaVisualizer
        isPlaying={isPlaying}
        albumArtUri={albumArtUri}
        width={width}
        height={height}
        config={config}
      />
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { width, height }, 
        animatedStyle
      ]} 
      pointerEvents="none"
    >
      <RNMitsuhaView
        style={{ flex: 1 }}
        isPlaying={isPlaying}
        primaryColor={finalPrimaryColor}
        secondaryColor={finalSecondaryColor}
        numberOfPoints={config.numberOfPoints ?? 12}
        gain={config.gain ?? 35}
        sensitivity={config.sensitivity ?? 1.2}
        waveOffset={config.waveOffset ?? 0}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
});

export default MitsuhaVisualizerNative;
