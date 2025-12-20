/**
 * MitsuhaJelloView - Réplica exacta de MSHFJelloView + MSHFJelloLayer
 * 
 * Esta es la implementación fiel del visualizador original de Mitsuha Forever.
 * 
 * Características clave replicadas:
 * - CABasicAnimation de 0.15s para transiciones suaves de path (MSHFJelloLayer)
 * - Delays de 0.25s y 0.50s para subwave y subSubwave
 * - Curvas Bezier cuadráticas con controlPointForPoints
 * - Interpolación suave entre frames para efecto "gelatinoso"
 * - 60 FPS con requestAnimationFrame
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  SharedValue,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface MitsuhaJelloViewProps {
  audioLevels: SharedValue<number[]>;
  waveColor: string;
  subwaveColor: string;
  width: number;
  height: number;
  waveOffset: number;
  siriEnabled?: boolean;
  subSubwaveColor?: string;
}

/**
 * Calcula el punto medio entre dos puntos
 * Réplica de midPointForPoints de MSHFJelloView.swift
 */
function midPointForPoints(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Calcula el punto de control para curvas Bezier
 * Réplica EXACTA de controlPointForPoints de MSHFJelloView.swift
 */
function controlPointForPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  const controlPoint = midPointForPoints(p1, p2);
  const diffY = Math.abs(p2.y - controlPoint.y);

  if (p1.y < p2.y) {
    controlPoint.y += diffY;
  } else if (p1.y > p2.y) {
    controlPoint.y -= diffY;
  }

  return controlPoint;
}

/**
 * Crea el path SVG usando curvas Bezier cuadráticas
 * Réplica EXACTA de createPath de MSHFJelloView.swift
 */
function createPath(
  levels: number[],
  width: number,
  height: number,
  waveOffset: number
): string {
  if (levels.length === 0) return '';

  const numberOfPoints = levels.length;
  const pixelFixer = width / numberOfPoints;

  // Crear puntos basados en los niveles de audio
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numberOfPoints; i++) {
    const x = i * pixelFixer;
    // Y invertido: altura - (nivel * altura disponible)
    const y = height - (levels[i] * (height - waveOffset) + waveOffset);
    points.push({ x, y });
  }

  // Forzar extremos en la línea base (como en el original)
  points[0].y = height - waveOffset;
  points[numberOfPoints - 1] = { x: width, y: height - waveOffset };

  // Construir path SVG - réplica exacta de createPath()
  let path = `M 0 ${height}`; // move(to: CGPoint(x: 0, y: height))
  
  let p1 = points[0];
  path += ` L ${p1.x} ${p1.y}`; // addLine(to: p1)

  for (let i = 1; i < numberOfPoints; i++) {
    const p2 = points[i];
    const midPoint = midPointForPoints(p1, p2);

    // Primera curva cuadrática: addQuadCurve(to: midPoint, control: controlPoint(midPoint, p1))
    const cp1 = controlPointForPoints(midPoint, p1);
    path += ` Q ${cp1.x} ${cp1.y} ${midPoint.x} ${midPoint.y}`;

    // Segunda curva cuadrática: addQuadCurve(to: p2, control: controlPoint(midPoint, p2))
    const cp2 = controlPointForPoints(midPoint, p2);
    path += ` Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;

    p1 = p2;
  }

  // addLine(to: CGPoint(x: frame.size.width, y: height))
  path += ` L ${width} ${height}`;
  path += ' Z'; // Cerrar el path

  return path;
}

const MitsuhaJelloView: React.FC<MitsuhaJelloViewProps> = ({
  audioLevels,
  waveColor,
  subwaveColor,
  width,
  height,
  waveOffset,
  siriEnabled = false,
  subSubwaveColor,
}) => {
  // Niveles interpolados para cada capa
  const [smoothLevels, setSmoothLevels] = useState<number[]>([]);
  const [subLevels, setSubLevels] = useState<number[]>([]);
  const [subSubLevels, setSubSubLevels] = useState<number[]>([]);

  // Refs para interpolación suave (simula CABasicAnimation de 150ms)
  const currentLevelsRef = useRef<number[]>([]);
  const targetLevelsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Historial para delays
  const levelHistoryRef = useRef<number[][]>([]);
  const SUBWAVE_DELAY_FRAMES = 15; // ~250ms a 60fps
  const SUBSUB_DELAY_FRAMES = 30; // ~500ms a 60fps

  /**
   * Interpolación lineal suave - simula CABasicAnimation
   * La clave del efecto "gelatinoso" es la interpolación gradual
   */
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  /**
   * Función de animación que interpola los niveles suavemente
   * Réplica del CABasicAnimation de 150ms en MSHFJelloLayer
   */
  const animateLevels = useCallback((timestamp: number) => {
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Factor de interpolación basado en 150ms (como MSHFJelloLayer)
    // A 60fps, 150ms = ~9 frames, así que interpolamos ~11% por frame
    const interpolationSpeed = Math.min(1, deltaTime / 150);

    if (currentLevelsRef.current.length > 0 && targetLevelsRef.current.length > 0) {
      // Interpolar niveles actuales hacia los objetivos
      const newLevels = currentLevelsRef.current.map((current, i) => {
        const target = targetLevelsRef.current[i] || current;
        return lerp(current, target, interpolationSpeed);
      });
      
      currentLevelsRef.current = newLevels;
      setSmoothLevels([...newLevels]);

      // Guardar en historial para delays
      levelHistoryRef.current.push([...newLevels]);
      if (levelHistoryRef.current.length > SUBSUB_DELAY_FRAMES + 5) {
        levelHistoryRef.current.shift();
      }

      // Actualizar subwave con delay de 250ms
      if (levelHistoryRef.current.length > SUBWAVE_DELAY_FRAMES) {
        const delayedLevels = levelHistoryRef.current[
          levelHistoryRef.current.length - SUBWAVE_DELAY_FRAMES - 1
        ];
        if (delayedLevels) {
          setSubLevels(delayedLevels);
        }
      }

      // Actualizar subsubwave con delay de 500ms
      if (siriEnabled && levelHistoryRef.current.length > SUBSUB_DELAY_FRAMES) {
        const delayedLevels = levelHistoryRef.current[
          levelHistoryRef.current.length - SUBSUB_DELAY_FRAMES - 1
        ];
        if (delayedLevels) {
          setSubSubLevels(delayedLevels);
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(animateLevels);
  }, [siriEnabled]);

  // Iniciar loop de animación
  useEffect(() => {
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animateLevels);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animateLevels]);

  // Recibir nuevos niveles de audio
  const updateTargetLevels = useCallback((levels: number[]) => {
    if (levels && levels.length > 0) {
      targetLevelsRef.current = levels;
      
      // Inicializar currentLevels si está vacío
      if (currentLevelsRef.current.length === 0) {
        currentLevelsRef.current = [...levels];
        setSmoothLevels([...levels]);
      }
    }
  }, []);

  // Reaccionar a cambios en audioLevels
  useAnimatedReaction(
    () => {
      'worklet';
      return audioLevels.value;
    },
    (currentLevels) => {
      'worklet';
      runOnJS(updateTargetLevels)(currentLevels);
    },
    [updateTargetLevels]
  );

  // Generar paths desde los niveles interpolados
  const mainPath = smoothLevels.length > 0 
    ? createPath(smoothLevels, width, height, waveOffset) 
    : '';
  const subPath = subLevels.length > 0 
    ? createPath(subLevels, width, height, waveOffset + 5) 
    : '';
  const subSubPath = subSubLevels.length > 0 
    ? createPath(subSubLevels, width, height, waveOffset + 10) 
    : '';

  /**
   * Nota sobre las transiciones CSS:
   * 
   * El MSHFJelloLayer original usa CABasicAnimation con duration: 0.15s
   * En SVG, usamos la propiedad CSS transition para simular esto.
   * 
   * La transición de 150ms en el path 'd' simula:
   * animation.duration = 0.15 del MSHFJelloLayer.swift
   */

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Gradiente principal con opacidad más alta arriba */}
          <LinearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={waveColor} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={waveColor} stopOpacity={0.4} />
          </LinearGradient>
          
          {/* Subwave con menos opacidad */}
          <LinearGradient id="subwaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={subwaveColor} stopOpacity={0.7} />
            <Stop offset="100%" stopColor={subwaveColor} stopOpacity={0.2} />
          </LinearGradient>
          
          {/* SubSubwave para modo Siri */}
          {siriEnabled && subSubwaveColor && (
            <LinearGradient id="subSubwaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={subSubwaveColor} stopOpacity={0.5} />
              <Stop offset="100%" stopColor={subSubwaveColor} stopOpacity={0.1} />
            </LinearGradient>
          )}
        </Defs>

        {/* Capa más profunda - zPosition = -2 (solo Siri) */}
        {siriEnabled && subSubwaveColor && subSubPath && (
          <Path
            d={subSubPath}
            fill="url(#subSubwaveGradient)"
            style={styles.animatedPath}
          />
        )}

        {/* Capa intermedia - zPosition = -1 */}
        {subPath && (
          <Path
            d={subPath}
            fill="url(#subwaveGradient)"
            style={styles.animatedPath}
          />
        )}

        {/* Capa principal - zPosition = 0 */}
        {mainPath && (
          <Path
            d={mainPath}
            fill="url(#waveGradient)"
            style={styles.animatedPath}
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  /**
   * Transición CSS de 150ms para simular CABasicAnimation
   * del MSHFJelloLayer original (animation.duration = 0.15)
   */
  animatedPath: {
    // React Native SVG no soporta transition CSS directamente
    // La animación se maneja a nivel de datos
  },
});

export default MitsuhaJelloView;
