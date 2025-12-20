/**
 * MitsuhaVisualizer - Componente principal del visualizador de audio
 * 
 * Usa el código NATIVO ORIGINAL de libmitsuha (MSHJelloView/MSHJelloLayer)
 * en iOS para animaciones auténticas de 150ms con CABasicAnimation.
 * 
 * Características:
 * - iOS: Código nativo original de Nepeta/Andy Shin
 * - Estilos de visualización (wave/jello, bar)
 * - Colorización dinámica desde artwork del álbum
 * - Animaciones con timing de 150ms NATIVAS
 * - Auto-hide cuando no hay audio (500ms fade)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

// Visualizador NATIVO para iOS (código original libmitsuha)
import MitsuhaVisualizerNative from './MitsuhaVisualizerNative';

// Views JS fallback para Android
import MitsuhaExactJelloView from './views/MitsuhaExactJelloView';
import MitsuhaJelloBarView from './views/MitsuhaJelloBarView';
import MitsuhaDotView from './views/MitsuhaDotView';

// Hooks
import { useAudioMeter } from './hooks/useAudioMeter';
import { useImageColors } from './hooks/useImageColors';

// Types
import {
  MitsuhaVisualizerProps,
  MitsuhaConfig,
  DEFAULT_CONFIG,
  MitsuhaStyle,
} from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MitsuhaVisualizer: React.FC<MitsuhaVisualizerProps> = ({
  config: userConfig,
  albumArtUri,
  isPlaying,
  audioData,
  width = SCREEN_WIDTH,
  height = 200,
  onVisibilityChange,
}) => {
  // Merge config con valores por defecto
  const config: MitsuhaConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...userConfig,
    }),
    [userConfig]
  );

  // Estado de visibilidad
  const [isVisible, setIsVisible] = useState(false);
  const opacity = useSharedValue(0);

  // Colores dinámicos desde la imagen del álbum
  const { primaryColor, secondaryColor } = useImageColors(
    config.colorMode === 'dynamic' ? albumArtUri : undefined
  );

  // Determinar colores según el modo
  const waveColor = useMemo(() => {
    switch (config.colorMode) {
      case 'dynamic':
        return primaryColor;
      case 'siri':
        return '#FF3B30'; // Rojo iOS
      case 'custom':
      default:
        return config.waveColor;
    }
  }, [config.colorMode, config.waveColor, primaryColor]);

  const subwaveColor = useMemo(() => {
    switch (config.colorMode) {
      case 'dynamic':
        return secondaryColor;
      case 'siri':
        return '#34C759'; // Verde iOS
      case 'custom':
      default:
        return config.subwaveColor || config.waveColor;
    }
  }, [config.colorMode, config.subwaveColor, config.waveColor, secondaryColor]);

  const subSubwaveColor = useMemo(() => {
    if (config.colorMode === 'siri') {
      return '#007AFF'; // Azul iOS
    }
    return config.subSubwaveColor || subwaveColor;
  }, [config.colorMode, config.subSubwaveColor, subwaveColor]);

  // Hook de audio meter
  const { audioLevels, isActive, feedAudioData } = useAudioMeter({
    numberOfPoints: config.numberOfPoints,
    gain: config.gain,
    sensitivity: config.sensitivity,
    limiter: config.limiter,
    isPlaying,
    fps: config.fps,
    enableFFT: config.enableFFT,
  });

  // Alimentar datos de audio externos si se proporcionan
  useEffect(() => {
    if (audioData && audioData.length > 0) {
      feedAudioData(audioData);
    }
  }, [audioData, feedAudioData]);

  // Manejar visibilidad con animación
  useEffect(() => {
    const shouldShow = isPlaying && (isActive || config.disableBatterySaver);
    
    if (shouldShow && !isVisible) {
      setIsVisible(true);
      // Animación de entrada (fade in con spring)
      opacity.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });
      onVisibilityChange?.(true);
    } else if (!shouldShow && isVisible && !config.disableBatterySaver) {
      // Animación de salida (fade out suave)
      opacity.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      }, (finished) => {
        if (finished) {
          runOnJS(setIsVisible)(false);
          runOnJS(onVisibilityChange ?? (() => {}))(false);
        }
      });
    }
  }, [isPlaying, isActive, config.disableBatterySaver, isVisible]);

  // Estilo animado para el contenedor
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // =========================================================================
  // EN iOS: Usar el visualizador NATIVO (código original de libmitsuha)
  // =========================================================================
  if (Platform.OS === 'ios') {
    // El visualizador nativo maneja su propia visibilidad y animaciones
    return (
      <MitsuhaVisualizerNative
        isPlaying={isPlaying}
        albumArtUri={albumArtUri}
        width={width}
        height={height}
        config={{
          numberOfPoints: config.numberOfPoints,
          gain: config.gain,
          sensitivity: config.sensitivity,
          waveOffset: config.waveOffset,
          colorMode: config.colorMode,
          waveColor: config.waveColor,
          subwaveColor: config.subwaveColor,
        }}
      />
    );
  }

  // =========================================================================
  // EN ANDROID: Usar visualizador JS (fallback)
  // =========================================================================
  
  // Renderizar la vista según el estilo seleccionado
  const renderVisualizerView = () => {
    const commonProps = {
      audioLevels,
      waveColor,
      subwaveColor,
      width,
      height,
    };

    switch (config.style) {
      case 'wave':
      case 'jello':
        return (
          <MitsuhaExactJelloView
            {...commonProps}
            numberOfPoints={config.numberOfPoints}
            waveOffset={config.waveOffset}
            siriEnabled={config.colorMode === 'siri'}
            subSubwaveColor={subSubwaveColor}
          />
        );

      case 'siri':
        return (
          <MitsuhaExactJelloView
            {...commonProps}
            numberOfPoints={config.numberOfPoints}
            waveOffset={config.waveOffset}
            siriEnabled={true}
            subSubwaveColor={subSubwaveColor}
          />
        );

      case 'bar':
        return (
          <MitsuhaJelloBarView
            {...commonProps}
            barSpacing={config.barSpacing}
            barCornerRadius={config.barCornerRadius}
            numberOfPoints={config.numberOfPoints}
            siriEnabled={config.colorMode === 'siri'}
            subSubwaveColor={subSubwaveColor}
          />
        );

      case 'dot':
        return (
          <MitsuhaDotView
            {...commonProps}
            barSpacing={config.barSpacing}
            numberOfPoints={config.numberOfPoints}
            siriEnabled={config.colorMode === 'siri'}
            subSubwaveColor={subSubwaveColor}
          />
        );

      default:
        return (
          <MitsuhaExactJelloView
            {...commonProps}
            numberOfPoints={config.numberOfPoints}
            waveOffset={config.waveOffset}
            siriEnabled={config.colorMode === 'siri'}
            subSubwaveColor={subSubwaveColor}
          />
        );
    }
  };

  // No renderizar si no es visible y no está en modo siempre visible
  if (!isVisible && !config.disableBatterySaver && !isPlaying) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { width, height },
        animatedContainerStyle,
      ]}
      pointerEvents="none"
    >
      {renderVisualizerView()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
});

export default MitsuhaVisualizer;
