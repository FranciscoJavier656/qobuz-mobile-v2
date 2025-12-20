/**
 * MitsuhaBarView - Réplica exacta de MSHFBarView con física Mitsuha
 * 
 * Características clave:
 * - Animación de 150ms (0.15s) como MSHFJelloLayer
 * - Delays escalonados para efecto cascada
 * - Crecimiento desde el centro hacia arriba/abajo
 * - Física tipo "jello" con timing específico
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  SharedValue,
  Easing,
  useSharedValue,
  useDerivedValue,
  interpolate,
  withDelay,
} from 'react-native-reanimated';

interface MitsuhaBarViewProps {
  audioLevels: SharedValue<number[]>;
  waveColor: string;
  width: number;
  height: number;
  barSpacing: number;
  barCornerRadius: number;
  numberOfPoints: number;
  siriEnabled?: boolean;
  subwaveColor?: string;
  subSubwaveColor?: string;
}

interface BarProps {
  index: number;
  audioLevels: SharedValue<number[]>;
  color: string;
  barWidth: number;
  height: number;
  cornerRadius: number;
  /**
   * Delay escalonado basado en la posición
   * Simula el efecto visual de propagación de onda
   */
  delay: number;
}

/**
 * Barra individual con animación tipo Mitsuha
 * 
 * La animación usa withTiming con duración de 150ms
 * para replicar CABasicAnimation de MSHFJelloLayer
 */
const AnimatedBar: React.FC<BarProps> = ({
  index,
  audioLevels,
  color,
  barWidth,
  height,
  cornerRadius,
  delay,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const levels = audioLevels.value;
    const level = (levels && levels[index] !== undefined) ? levels[index] : 0;
    
    // Altura de la barra basada en el nivel
    const barHeight = Math.max(4, level * height * 0.9);
    
    /**
     * Animación tipo MSHFJelloLayer:
     * - Duración: 150ms (0.15s del original)
     * - Easing: easeOut para el efecto "jello" suave
     */
    return {
      height: withDelay(
        delay,
        withTiming(barHeight, {
          duration: 150, // 0.15s como MSHFJelloLayer
          easing: Easing.out(Easing.cubic),
        })
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: barWidth,
          backgroundColor: color,
          borderRadius: cornerRadius,
        },
        animatedStyle,
      ]}
    />
  );
};

/**
 * Barra con efecto espejo (crece desde el centro hacia arriba y abajo)
 */
const MirroredBar: React.FC<BarProps & { totalHeight: number }> = ({
  index,
  audioLevels,
  color,
  barWidth,
  totalHeight,
  cornerRadius,
  delay,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const levels = audioLevels.value;
    const level = (levels && levels[index] !== undefined) ? levels[index] : 0;
    
    // Cada barra crece la mitad hacia arriba y la mitad hacia abajo
    const barHeight = Math.max(4, level * totalHeight * 0.45);
    
    return {
      height: withDelay(
        delay,
        withTiming(barHeight, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
        })
      ),
    };
  });

  return (
    <View style={styles.mirroredBarContainer}>
      {/* Barra superior (crece hacia arriba) */}
      <Animated.View
        style={[
          styles.barUp,
          {
            width: barWidth,
            backgroundColor: color,
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
          },
          animatedStyle,
        ]}
      />
      {/* Barra inferior (crece hacia abajo) */}
      <Animated.View
        style={[
          styles.barDown,
          {
            width: barWidth,
            backgroundColor: color,
            borderBottomLeftRadius: cornerRadius,
            borderBottomRightRadius: cornerRadius,
            opacity: 0.6, // Reflejo más tenue
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

const MitsuhaBarView: React.FC<MitsuhaBarViewProps> = ({
  audioLevels,
  waveColor,
  width,
  height,
  barSpacing,
  barCornerRadius,
  numberOfPoints,
  siriEnabled = false,
  subwaveColor,
  subSubwaveColor,
}) => {
  // Calcular dimensiones de cada barra
  const totalSpacing = barSpacing * (numberOfPoints + 1);
  const barWidth = Math.max(2, (width - totalSpacing) / numberOfPoints);

  /**
   * Calcular delay escalonado para cada barra
   * Esto crea el efecto de "onda" visual donde las barras
   * del centro reaccionan primero y las de los bordes después
   */
  const getDelay = (index: number): number => {
    // Delay desde el centro hacia los bordes
    const center = numberOfPoints / 2;
    const distanceFromCenter = Math.abs(index - center);
    // Máximo delay de 50ms, escalado desde el centro
    return distanceFromCenter * 2;
  };

  // Generar las barras
  const bars = [];
  for (let i = 0; i < numberOfPoints; i++) {
    bars.push(
      <MirroredBar
        key={`bar-${i}`}
        index={i}
        audioLevels={audioLevels}
        color={waveColor}
        barWidth={barWidth}
        totalHeight={height}
        cornerRadius={barCornerRadius}
        delay={getDelay(i)}
      />
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.barsContainer}>
        {bars}
      </View>
      
      {/* Capa adicional para modo Siri con delay */}
      {siriEnabled && subwaveColor && (
        <View style={[styles.siriLayer, { opacity: 0.5 }]}>
          {Array.from({ length: numberOfPoints }).map((_, i) => (
            <MirroredBar
              key={`bar-sub-${i}`}
              index={i}
              audioLevels={audioLevels}
              color={subwaveColor}
              barWidth={barWidth}
              totalHeight={height}
              cornerRadius={barCornerRadius}
              delay={getDelay(i) + 100} // +100ms delay adicional
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
  bar: {
    minHeight: 4,
  },
  mirroredBarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barUp: {
    minHeight: 2,
  },
  barDown: {
    minHeight: 2,
  },
  siriLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
});

export default MitsuhaBarView;
