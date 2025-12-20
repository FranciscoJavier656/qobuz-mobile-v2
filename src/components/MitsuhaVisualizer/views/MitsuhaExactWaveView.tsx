/**
 * MitsuhaExactWaveView - Réplica EXACTA de MSHFJelloView
 * 
 * Usa SVG Path con curvas Bezier cuadráticas exactamente como el original.
 * Requiere build nativo (npx expo run:ios) para funcionar.
 * 
 * Características:
 * - Path continuo relleno (no barras)
 * - Curvas Bezier cuadráticas entre puntos
 * - Efecto jello con animación de 150ms
 * - Múltiples capas con delays (250ms, 500ms)
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SharedValue } from 'react-native-reanimated';

interface MitsuhaExactWaveViewProps {
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

// Configuración exacta de Mitsuha
const MITSUHA_CONFIG = {
  SUBWAVE_DELAY: 250,
  SUBSUBWAVE_DELAY: 500,
  // Altura máxima de la onda (desde abajo)
  MAX_WAVE_HEIGHT: 0.6,
  MIN_WAVE_HEIGHT: 0.05,
};

/**
 * Calcula punto medio entre dos puntos (midPointForPoints del original)
 */
const midPointForPoints = (p1: { x: number; y: number }, p2: { x: number; y: number }) => ({
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2,
});

/**
 * Calcula punto de control para curva Bezier (controlPointForPoints del original)
 * ESTA ES LA CLAVE del efecto jello
 */
const controlPointForPoints = (
  mid: { x: number; y: number },
  target: { x: number; y: number }
) => {
  const controlPoint = { ...mid };
  const diffY = Math.abs(target.y - controlPoint.y);

  if (mid.y < target.y) {
    controlPoint.y += diffY;
  } else if (mid.y > target.y) {
    controlPoint.y -= diffY;
  }

  return controlPoint;
};

/**
 * Crea el path SVG exactamente como createPath() del original
 */
const createWavePath = (
  points: { x: number; y: number }[],
  width: number,
  height: number
): string => {
  if (points.length < 2) {
    return `M 0 ${height} L ${width} ${height} Z`;
  }

  let path = `M 0 ${height}`; // Empieza en esquina inferior izquierda

  // Línea al primer punto
  path += ` L ${points[0].x} ${points[0].y}`;

  let p1 = points[0];

  // Conectar puntos con curvas Bezier cuadráticas
  for (let i = 1; i < points.length; i++) {
    const p2 = points[i];
    const mid = midPointForPoints(p1, p2);

    // Primera curva: de p1 a midpoint con control hacia p1
    const cp1 = controlPointForPoints(mid, p1);
    path += ` Q ${cp1.x} ${cp1.y} ${mid.x} ${mid.y}`;

    // Segunda curva: de midpoint a p2 con control hacia p2
    const cp2 = controlPointForPoints(mid, p2);
    path += ` Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;

    p1 = p2;
  }

  // Línea a esquina inferior derecha y cerrar
  path += ` L ${width} ${height} Z`;

  return path;
};

/**
 * Convierte niveles de audio (0-1) a puntos de coordenadas
 */
const levelsToPoints = (
  levels: number[],
  width: number,
  height: number,
  waveOffset: number
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  const numPoints = levels.length;

  for (let i = 0; i < numPoints; i++) {
    const x = (i / (numPoints - 1)) * width;
    // El nivel determina qué tan alto sube desde abajo
    // level 0 = en el fondo (height), level 1 = arriba
    const level = Math.max(
      MITSUHA_CONFIG.MIN_WAVE_HEIGHT,
      Math.min(MITSUHA_CONFIG.MAX_WAVE_HEIGHT, levels[i] || 0)
    );
    const y = height - (level * height) + waveOffset;
    
    points.push({ x, y });
  }

  // Asegurar que los extremos están en waveOffset (línea base)
  if (points.length > 0) {
    points[0].y = Math.max(points[0].y, height - waveOffset - 10);
    points[points.length - 1].y = Math.max(points[points.length - 1].y, height - waveOffset - 10);
  }

  return points;
};

/**
 * Componente de una capa de onda
 */
interface WaveLayerProps {
  levels: number[];
  color: string;
  width: number;
  height: number;
  waveOffset: number;
  opacity: number;
}

const WaveLayer: React.FC<WaveLayerProps> = memo(({
  levels,
  color,
  width,
  height,
  waveOffset,
  opacity,
}) => {
  const points = levelsToPoints(levels, width, height, waveOffset);
  const pathData = createWavePath(points, width, height);

  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Path d={pathData} fill={color} />
    </Svg>
  );
});

WaveLayer.displayName = 'WaveLayer';

/**
 * Componente principal
 */
const MitsuhaExactWaveView: React.FC<MitsuhaExactWaveViewProps> = ({
  audioLevels,
  waveColor,
  subwaveColor,
  subSubwaveColor,
  width,
  height,
  numberOfPoints = 8,
  waveOffset = 0,
  siriEnabled = false,
}) => {
  // Estado para los niveles de cada capa
  const [mainLevels, setMainLevels] = useState<number[]>(
    new Array(numberOfPoints).fill(MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
  );
  const [subwaveLevels, setSubwaveLevels] = useState<number[]>(
    new Array(numberOfPoints).fill(MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
  );
  const [subSubwaveLevels, setSubSubwaveLevels] = useState<number[]>(
    new Array(numberOfPoints).fill(MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
  );

  // Refs para los timeouts de delay
  const subwaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subSubwaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Interpolación suave
  const currentLevelsRef = useRef<number[]>(
    new Array(numberOfPoints).fill(MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
  );
  const targetLevelsRef = useRef<number[]>(
    new Array(numberOfPoints).fill(MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
  );
  const animationFrameRef = useRef<number | null>(null);

  // Escuchar cambios en audioLevels (SharedValue)
  useEffect(() => {
    let lastValue: number[] = [];
    
    const checkForUpdates = () => {
      const currentValue = audioLevels.value;
      
      // Verificar si cambió
      if (currentValue && currentValue.length > 0) {
        const changed = currentValue.some((v, i) => v !== lastValue[i]);
        
        if (changed) {
          lastValue = [...currentValue];
          
          // Escalar niveles al rango de altura
          const scaledLevels = currentValue.map(v => 
            MITSUHA_CONFIG.MIN_WAVE_HEIGHT + 
            (v || 0) * (MITSUHA_CONFIG.MAX_WAVE_HEIGHT - MITSUHA_CONFIG.MIN_WAVE_HEIGHT)
          );
          
          targetLevelsRef.current = scaledLevels;
          
          // Actualizar subwave con delay
          if (subwaveTimeoutRef.current) {
            clearTimeout(subwaveTimeoutRef.current);
          }
          subwaveTimeoutRef.current = setTimeout(() => {
            setSubwaveLevels([...scaledLevels]);
          }, MITSUHA_CONFIG.SUBWAVE_DELAY);

          // Actualizar subSubwave con delay mayor
          if (siriEnabled) {
            if (subSubwaveTimeoutRef.current) {
              clearTimeout(subSubwaveTimeoutRef.current);
            }
            subSubwaveTimeoutRef.current = setTimeout(() => {
              setSubSubwaveLevels([...scaledLevels]);
            }, MITSUHA_CONFIG.SUBSUBWAVE_DELAY);
          }
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(checkForUpdates);
    };
    
    // Loop de animación para interpolación suave (150ms como el original)
    const animate = () => {
      const current = currentLevelsRef.current;
      const target = targetLevelsRef.current;
      
      // Interpolación suave (simula 150ms CABasicAnimation)
      const smoothing = 0.15;
      const newLevels = current.map((curr, i) => {
        const tgt = target[i] || MITSUHA_CONFIG.MIN_WAVE_HEIGHT;
        return curr + (tgt - curr) * smoothing;
      });
      
      currentLevelsRef.current = newLevels;
      setMainLevels([...newLevels]);
    };
    
    // Iniciar loops
    checkForUpdates();
    const animateInterval = setInterval(animate, 16); // ~60fps
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(animateInterval);
      if (subwaveTimeoutRef.current) {
        clearTimeout(subwaveTimeoutRef.current);
      }
      if (subSubwaveTimeoutRef.current) {
        clearTimeout(subSubwaveTimeoutRef.current);
      }
    };
  }, [audioLevels, numberOfPoints, siriEnabled]);

  // Colores efectivos
  const effectiveSubwaveColor = subwaveColor || waveColor;
  const effectiveSubSubwaveColor = subSubwaveColor || effectiveSubwaveColor;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {/* SubSubwave layer (más atrás) */}
      {siriEnabled && (
        <WaveLayer
          levels={subSubwaveLevels}
          color={effectiveSubSubwaveColor}
          width={width}
          height={height}
          waveOffset={waveOffset}
          opacity={0.3}
        />
      )}

      {/* Subwave layer */}
      <WaveLayer
        levels={subwaveLevels}
        color={effectiveSubwaveColor}
        width={width}
        height={height}
        waveOffset={waveOffset}
        opacity={0.5}
      />

      {/* Main wave layer (frente) */}
      <WaveLayer
        levels={mainLevels}
        color={waveColor}
        width={width}
        height={height}
        waveOffset={waveOffset}
        opacity={0.85}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
});

export default memo(MitsuhaExactWaveView);
