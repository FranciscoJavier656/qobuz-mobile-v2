/**
 * MitsuhaJelloBarView - Visualizador ultra-optimizado con efecto gelatina
 * 
 * Réplica de la física de MSHFJelloLayer pero sin SVG.
 * Usa una ÚNICA animación compartida + transforms para máximo rendimiento.
 * 
 * Técnicas de optimización:
 * 1. Una sola SharedValue con todos los niveles interpolados
 * 2. Barras usan scaleY transform (más rápido que cambiar altura)
 * 3. Interpolación suave tipo "jello" en el worklet thread
 * 4. Sin withTiming/withSpring individuales - todo manual a 60fps
 */

import React, { useEffect, useRef, useCallback, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  SharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  runOnJS,
  useAnimatedReaction,
  cancelAnimation,
} from 'react-native-reanimated';

interface MitsuhaJelloBarViewProps {
  audioLevels: SharedValue<number[]>;
  waveColor: string;
  width: number;
  height: number;
  barSpacing?: number;
  barCornerRadius?: number;
  numberOfPoints?: number;
  siriEnabled?: boolean;
  subwaveColor?: string;
  subSubwaveColor?: string;
}

// Configuración de física Mitsuha
const PHYSICS = {
  // Tiempo de interpolación (150ms como MSHFJelloLayer)
  INTERPOLATION_TIME: 150,
  // Factor de suavizado para efecto gelatina (0-1, menor = más suave)
  JELLO_SMOOTHING: 0.18,
  // Delay entre barras para efecto cascada (ms)
  CASCADE_DELAY: 8,
  // Altura mínima de barra (proporción)
  MIN_HEIGHT: 0.02,
  // Overshoot para efecto rebote
  OVERSHOOT: 1.08,
  // Damping del rebote
  DAMPING: 0.92,
};

/**
 * Hook personalizado para interpolar niveles con física jello
 * Todo corre en el UI thread para máximo rendimiento
 */
const useJelloLevels = (
  audioLevels: SharedValue<number[]>,
  numberOfPoints: number
): SharedValue<number[]> => {
  // Estado interno interpolado
  const smoothLevels = useSharedValue<number[]>(
    new Array(numberOfPoints).fill(PHYSICS.MIN_HEIGHT)
  );
  
  // Velocidades para efecto rebote
  const velocities = useSharedValue<number[]>(
    new Array(numberOfPoints).fill(0)
  );
  
  // Target levels con cascade delay simulado
  const targetLevels = useSharedValue<number[]>(
    new Array(numberOfPoints).fill(PHYSICS.MIN_HEIGHT)
  );

  // Reacción a cambios de audio - actualiza targets con delay escalonado
  useAnimatedReaction(
    () => audioLevels.value,
    (current, previous) => {
      'worklet';
      if (!current || current.length === 0) return;
      
      // Copiar valores actuales a targets
      const newTargets = [...targetLevels.value];
      for (let i = 0; i < numberOfPoints && i < current.length; i++) {
        newTargets[i] = Math.max(PHYSICS.MIN_HEIGHT, current[i]);
      }
      targetLevels.value = newTargets;
    },
    [numberOfPoints]
  );

  // Derivar los niveles suavizados con física jello
  useDerivedValue(() => {
    'worklet';
    const targets = targetLevels.value;
    const current = smoothLevels.value;
    const vels = velocities.value;
    
    const newLevels = new Array(numberOfPoints);
    const newVels = new Array(numberOfPoints);
    
    for (let i = 0; i < numberOfPoints; i++) {
      const target = targets[i] || PHYSICS.MIN_HEIGHT;
      const curr = current[i] || PHYSICS.MIN_HEIGHT;
      const vel = vels[i] || 0;
      
      // Calcular diferencia al target
      const diff = target - curr;
      
      // Aplicar física tipo spring/jello
      // Aceleración hacia el target + damping
      const acceleration = diff * PHYSICS.JELLO_SMOOTHING;
      let newVel = (vel + acceleration) * PHYSICS.DAMPING;
      
      // Aplicar overshoot si nos acercamos
      if (Math.abs(diff) < 0.1 && Math.abs(newVel) > 0.01) {
        newVel *= PHYSICS.OVERSHOOT;
      }
      
      // Limitar velocidad
      newVel = Math.max(-0.5, Math.min(0.5, newVel));
      
      // Nueva posición
      let newLevel = curr + newVel;
      
      // Clamp entre min y 1
      newLevel = Math.max(PHYSICS.MIN_HEIGHT, Math.min(1.0, newLevel));
      
      newLevels[i] = newLevel;
      newVels[i] = newVel;
    }
    
    smoothLevels.value = newLevels;
    velocities.value = newVels;
    
    return newLevels;
  }, [numberOfPoints]);

  return smoothLevels;
};

/**
 * Componente de barra individual - MEMOIZADO para evitar re-renders
 */
interface BarProps {
  index: number;
  smoothLevels: SharedValue<number[]>;
  color: string;
  barWidth: number;
  height: number;
  cornerRadius: number;
  left: number;
}

const JelloBar = memo<BarProps>(({
  index,
  smoothLevels,
  color,
  barWidth,
  height,
  cornerRadius,
  left,
}) => {
  // Estilo animado usando transform scaleY (más eficiente que height)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const levels = smoothLevels.value;
    const level = (levels && levels[index] !== undefined) ? levels[index] : PHYSICS.MIN_HEIGHT;
    
    // Usar scaleY desde el bottom (originY: 1)
    return {
      transform: [
        { scaleY: level },
      ],
    };
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: barWidth,
          height: height, // Altura completa, se escala con transform
          backgroundColor: color,
          borderRadius: cornerRadius,
          left: left,
          // Transform origin bottom
          transformOrigin: 'bottom',
        },
        animatedStyle,
      ]}
    />
  );
});

JelloBar.displayName = 'JelloBar';

/**
 * Componente principal del visualizador
 */
const MitsuhaJelloBarView: React.FC<MitsuhaJelloBarViewProps> = ({
  audioLevels,
  waveColor,
  width,
  height,
  barSpacing = 2,
  barCornerRadius = 2,
  numberOfPoints = 24,
  siriEnabled = false,
  subwaveColor,
  subSubwaveColor,
}) => {
  // Niveles interpolados con física jello
  const smoothLevels = useJelloLevels(audioLevels, numberOfPoints);
  
  // Calcular dimensiones de barras
  const totalSpacing = barSpacing * (numberOfPoints - 1);
  const barWidth = (width - totalSpacing) / numberOfPoints;
  
  // Colores para modo Siri
  const getBarColor = useCallback((index: number): string => {
    if (!siriEnabled) return waveColor;
    
    // Dividir en 3 secciones para colores RGB
    const section = Math.floor((index / numberOfPoints) * 3);
    switch (section) {
      case 0: return waveColor; // Rojo
      case 1: return subwaveColor || '#34C759'; // Verde
      case 2: return subSubwaveColor || '#007AFF'; // Azul
      default: return waveColor;
    }
  }, [siriEnabled, waveColor, subwaveColor, subSubwaveColor, numberOfPoints]);

  // Pre-calcular posiciones de barras (evita cálculos en render)
  const barConfigs = React.useMemo(() => {
    const configs = [];
    for (let i = 0; i < numberOfPoints; i++) {
      configs.push({
        index: i,
        left: i * (barWidth + barSpacing),
        color: getBarColor(i),
      });
    }
    return configs;
  }, [numberOfPoints, barWidth, barSpacing, getBarColor]);

  return (
    <View style={[styles.container, { width, height }]}>
      {barConfigs.map((config) => (
        <JelloBar
          key={config.index}
          index={config.index}
          smoothLevels={smoothLevels}
          color={config.color}
          barWidth={barWidth}
          height={height}
          cornerRadius={barCornerRadius}
          left={config.left}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
  },
});

export default memo(MitsuhaJelloBarView);
