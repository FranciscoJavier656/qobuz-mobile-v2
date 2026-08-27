/**
 * MitsuhaMetalVisualizer.tsx
 * Componente React Native que usa Metal para renderizado GPU
 * 
 * Proporciona animaciones de onda fluidas a 60fps usando la GPU de Apple
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  requireNativeComponent,
  Platform,
  UIManager,
  ViewStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useImageColors } from './hooks/useImageColors';
import { MitsuhaConfig } from './types';

// Verificar si el componente nativo Metal está disponible
const METAL_VIEW_NAME = 'RNMitsuhaMetalView';
let RNMitsuhaMetalView: any = null;

try {
  if (Platform.OS === 'ios') {
    const hasViewManager = UIManager.getViewManagerConfig(METAL_VIEW_NAME) != null;
    if (hasViewManager) {
      RNMitsuhaMetalView = requireNativeComponent(METAL_VIEW_NAME);
      console.log('[MitsuhaMetalVisualizer] ✅ Metal view disponible');
    } else {
      console.log('[MitsuhaMetalVisualizer] ⚠️ Metal view no disponible, usando fallback');
    }
  }
} catch (e) {
  console.warn('[MitsuhaMetalVisualizer] Error cargando Metal view:', e);
}

// Estilos de visualizador
export enum VisualizerStyle {
  Jello = 0,
  Glow = 1,
  Siri = 2,
}

interface MitsuhaMetalVisualizerProps {
  isPlaying: boolean;
  albumArtUri?: string;
  width?: number;
  height?: number;
  config?: MitsuhaConfig & {
    visualizerStyle?: VisualizerStyle;
    useMetal?: boolean;
  };
  style?: ViewStyle;
}

const MitsuhaMetalVisualizer: React.FC<MitsuhaMetalVisualizerProps> = ({
  isPlaying,
  albumArtUri,
  width = 400,
  height = 350,
  config = {},
  style,
}) => {
  // Animación de visibilidad
  const opacity = useSharedValue(isPlaying ? 1 : 0);
  const translateY = useSharedValue(isPlaying ? 0 : 20);
  const prevIsPlaying = useRef(isPlaying);
  const isFirstRender = useRef(true);

  // Extraer colores de la imagen del álbum
  const { primaryColor } = useImageColors(
    config.colorMode === 'dynamic' ? albumArtUri : undefined
  );

  // Animación de visibilidad
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (isPlaying && !prevIsPlaying.current) {
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

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Determinar color final
  const finalPrimaryColor = useMemo(() => {
    if (config.colorMode === 'custom' && config.waveColor) {
      return config.waveColor;
    }
    return primaryColor;
  }, [config.colorMode, config.waveColor, primaryColor]);

  // Color secundario: undefined para que iOS use su fallback nativo
  const finalSecondaryColor = useMemo(() => {
    if (config.colorMode === 'custom' && config.subwaveColor) {
      return config.subwaveColor;
    }
    return undefined;
  }, [config.colorMode, config.subwaveColor]);

  // Si Metal no está disponible, usar el visualizador estándar como fallback
  if (!RNMitsuhaMetalView) {
    const { default: MitsuhaVisualizerNative } = require('./MitsuhaVisualizerNative');
    return (
      <MitsuhaVisualizerNative
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
        animatedStyle,
        style,
      ]}
      pointerEvents="none"
    >
      <RNMitsuhaMetalView
        style={styles.metalView}
        isPlaying={isPlaying}
        primaryColor={finalPrimaryColor}
        secondaryColor={finalSecondaryColor}
        numberOfPoints={config.numberOfPoints ?? 12}
        gain={config.gain ?? 35}
        sensitivity={config.sensitivity ?? 1.2}
        waveOffset={config.waveOffset ?? 0}
        visualizerStyle={config.visualizerStyle ?? VisualizerStyle.Jello}
        useMetal={config.useMetal ?? true}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  metalView: {
    flex: 1,
  },
});

export default MitsuhaMetalVisualizer;

// Export para uso directo
export { MitsuhaMetalVisualizer };
