/**
 * MitsuhaJelloWaveView - Efecto JELLO auténtico de Mitsuha
 * 
 * - Ondas suaves con curvas Bezier
 * - Animación de 150ms
 * - Delays escalonados
 * - Altura limitada (50% max)
 * - Cobertura completa de bordes
 */

import React, { useEffect, useRef, useMemo, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  SharedValue,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

interface MitsuhaJelloWaveViewProps {
  audioLevels: SharedValue<number[]>;
  waveColor: string;
  subwaveColor?: string;
  subSubwaveColor?: string;
  width: number;
  height: number;
  numberOfPoints?: number;
  waveOffset?: number;
  siriEnabled?: boolean;
}

// Configuración de física Mitsuha
const PHYSICS = {
  SUBWAVE_DELAY: 250,
  SUBSUBWAVE_DELAY: 500,
  INTERPOLATION_POINTS: 6,
  MAX_WAVE_HEIGHT: 0.50, // 50% máximo
  MIN_WAVE_HEIGHT: 0.08, // 8% mínimo
  ANIMATION_SMOOTHING: 0.15,
};

const midPoint = (y1: number, y2: number): number => {
  'worklet';
  return (y1 + y2) / 2;
};

const controlPoint = (midY: number, targetY: number): number => {
  'worklet';
  const diffY = Math.abs(targetY - midY);
  if (midY < targetY) return midY + diffY;
  if (midY > targetY) return midY - diffY;
  return midY;
};

const interpolateWithBezier = (points: number[], totalOutputPoints: number): number[] => {
  'worklet';
  
  if (!points || points.length < 2) {
    return new Array(totalOutputPoints).fill(PHYSICS.MIN_WAVE_HEIGHT);
  }
  
  const result: number[] = [];
  const numSegments = points.length - 1;
  const segmentSize = Math.max(1, Math.floor(totalOutputPoints / numSegments));
  
  for (let i = 0; i < numSegments; i++) {
    const p1 = points[i] ?? PHYSICS.MIN_WAVE_HEIGHT;
    const p2 = points[i + 1] ?? PHYSICS.MIN_WAVE_HEIGHT;
    const mid = midPoint(p1, p2);
    const cp1 = controlPoint(mid, p1);
    const cp2 = controlPoint(mid, p2);
    
    for (let j = 0; j < segmentSize; j++) {
      const t = j / segmentSize;
      let y: number;
      
      if (t < 0.5) {
        const localT = t * 2;
        const oneMinusT = 1 - localT;
        y = oneMinusT * oneMinusT * p1 + 2 * oneMinusT * localT * cp1 + localT * localT * mid;
      } else {
        const localT = (t - 0.5) * 2;
        const oneMinusT = 1 - localT;
        y = oneMinusT * oneMinusT * mid + 2 * oneMinusT * localT * cp2 + localT * localT * p2;
      }
      
      // Validar y limitar
      if (!Number.isFinite(y)) y = PHYSICS.MIN_WAVE_HEIGHT;
      result.push(Math.max(PHYSICS.MIN_WAVE_HEIGHT, Math.min(PHYSICS.MAX_WAVE_HEIGHT, y)));
    }
  }
  
  while (result.length < totalOutputPoints) {
    result.push(result[result.length - 1] ?? PHYSICS.MIN_WAVE_HEIGHT);
  }
  
  return result.slice(0, totalOutputPoints);
};

const useDelayedLevels = (
  sourceLevels: SharedValue<number[]>,
  delayMs: number,
  numberOfBars: number
): SharedValue<number[]> => {
  const delayedLevels = useSharedValue<number[]>(new Array(numberOfBars).fill(PHYSICS.MIN_WAVE_HEIGHT));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateDelayed = (levels: number[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      delayedLevels.value = levels;
    }, delayMs);
  };
  
  useAnimatedReaction(
    () => sourceLevels.value,
    (current) => {
      if (current?.length > 0) runOnJS(updateDelayed)([...current]);
    },
    []
  );
  
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  
  return delayedLevels;
};

const useJelloInterpolation = (
  audioLevels: SharedValue<number[]>,
  numberOfOutputBars: number
): SharedValue<number[]> => {
  const interpolatedLevels = useSharedValue<number[]>(new Array(numberOfOutputBars).fill(PHYSICS.MIN_WAVE_HEIGHT));
  const targetLevels = useSharedValue<number[]>(new Array(numberOfOutputBars).fill(PHYSICS.MIN_WAVE_HEIGHT));
  
  useAnimatedReaction(
    () => audioLevels.value,
    (current) => {
      'worklet';
      if (!current?.length) return;
      
      const scaledInput = current.map(v => {
        const val = Number.isFinite(v) ? v : 0;
        return PHYSICS.MIN_WAVE_HEIGHT + val * (PHYSICS.MAX_WAVE_HEIGHT - PHYSICS.MIN_WAVE_HEIGHT);
      });
      
      targetLevels.value = interpolateWithBezier(scaledInput, numberOfOutputBars);
    },
    [numberOfOutputBars]
  );
  
  useDerivedValue(() => {
    'worklet';
    const targets = targetLevels.value;
    const current = interpolatedLevels.value;
    if (!targets?.length) return current;
    
    const newLevels = new Array(numberOfOutputBars);
    for (let i = 0; i < numberOfOutputBars; i++) {
      const target = targets[i] ?? PHYSICS.MIN_WAVE_HEIGHT;
      const curr = current[i] ?? PHYSICS.MIN_WAVE_HEIGHT;
      let newVal = curr + (target - curr) * PHYSICS.ANIMATION_SMOOTHING;
      if (!Number.isFinite(newVal)) newVal = PHYSICS.MIN_WAVE_HEIGHT;
      newLevels[i] = newVal;
    }
    
    interpolatedLevels.value = newLevels;
    return newLevels;
  }, [numberOfOutputBars]);
  
  return interpolatedLevels;
};

interface WaveBarProps {
  index: number;
  levels: SharedValue<number[]>;
  color: string;
  barWidth: number;
  height: number;
  left: number;
  opacity?: number;
}

const WaveBar = memo<WaveBarProps>(({ index, levels, color, barWidth, height, left, opacity = 1 }) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    let level = levels.value[index];
    if (!Number.isFinite(level)) level = PHYSICS.MIN_WAVE_HEIGHT;
    return {
      transform: [{ scaleY: level }],
      opacity,
    };
  }, [index, opacity]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { width: barWidth + 2, height, backgroundColor: color, left: Math.max(0, left - 1) },
        animatedStyle,
      ]}
    />
  );
});

WaveBar.displayName = 'WaveBar';

interface WaveLayerProps {
  levels: SharedValue<number[]>;
  color: string;
  width: number;
  height: number;
  numberOfBars: number;
  zIndex: number;
  opacity?: number;
}

const WaveLayer = memo<WaveLayerProps>(({ levels, color, width, height, numberOfBars, zIndex, opacity = 1 }) => {
  const barWidth = Math.ceil(width / numberOfBars) + 1;
  
  const bars = useMemo(() => {
    const items = [];
    for (let i = 0; i < numberOfBars; i++) {
      items.push({ index: i, left: Math.floor(i * (width / numberOfBars)) });
    }
    return items;
  }, [numberOfBars, width]);

  return (
    <View style={[styles.waveLayer, { zIndex, width: width + 4 }]} pointerEvents="none">
      {bars.map((bar) => (
        <WaveBar
          key={bar.index}
          index={bar.index}
          levels={levels}
          color={color}
          barWidth={barWidth}
          height={height}
          left={bar.left}
          opacity={opacity}
        />
      ))}
    </View>
  );
});

WaveLayer.displayName = 'WaveLayer';

const MitsuhaJelloWaveView: React.FC<MitsuhaJelloWaveViewProps> = ({
  audioLevels,
  waveColor,
  subwaveColor,
  subSubwaveColor,
  width,
  height,
  numberOfPoints = 8,
  siriEnabled = false,
}) => {
  const numberOfBars = Math.max(8, numberOfPoints * PHYSICS.INTERPOLATION_POINTS);
  
  const mainLevels = useJelloInterpolation(audioLevels, numberOfBars);
  const subwaveLevels = useDelayedLevels(mainLevels, PHYSICS.SUBWAVE_DELAY, numberOfBars);
  const subSubwaveLevels = useDelayedLevels(mainLevels, PHYSICS.SUBSUBWAVE_DELAY, numberOfBars);
  
  const effectiveSubwaveColor = subwaveColor || waveColor;
  const effectiveSubSubwaveColor = subSubwaveColor || effectiveSubwaveColor;

  return (
    <View style={[styles.container, { width: width + 4, height, marginLeft: -2 }]} pointerEvents="none">
      {siriEnabled && (
        <WaveLayer
          levels={subSubwaveLevels}
          color={effectiveSubSubwaveColor}
          width={width}
          height={height}
          numberOfBars={numberOfBars}
          zIndex={0}
          opacity={0.3}
        />
      )}
      
      <WaveLayer
        levels={subwaveLevels}
        color={effectiveSubwaveColor}
        width={width}
        height={height}
        numberOfBars={numberOfBars}
        zIndex={1}
        opacity={0.45}
      />
      
      <WaveLayer
        levels={mainLevels}
        color={waveColor}
        width={width}
        height={height}
        numberOfBars={numberOfBars}
        zIndex={2}
        opacity={0.8}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  waveLayer: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  waveBar: { position: 'absolute', bottom: 0, transformOrigin: 'bottom' },
});

export default memo(MitsuhaJelloWaveView);
