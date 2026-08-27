/**
 * MitsuhaWaveView - Vista de ondas estilo Jello
 * 
 * Replica MSHFJelloView de libmitsuha6
 * Usa curvas Bezier cuadráticas para ondas suaves
 * 
 * VERSIÓN SIMPLIFICADA - Usa useAnimatedReaction + runOnJS
 * para evitar errores de worklet con funciones no-worklet
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  SharedValue,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface MitsuhaWaveViewProps {
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
 */
function midPoint(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Calcula el punto de control para curvas Bezier suaves
 */
function controlPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  const mid = midPoint(p1, p2);
  const diffY = Math.abs(p2.y - mid.y);

  if (p1.y < p2.y) {
    return { x: mid.x, y: mid.y + diffY };
  } else if (p1.y > p2.y) {
    return { x: mid.x, y: mid.y - diffY };
  }
  return mid;
}

/**
 * Genera el path SVG para la onda
 */
function createWavePath(
  levels: number[],
  width: number,
  height: number,
  waveOffset: number
): string {
  if (levels.length === 0) return '';

  const points: { x: number; y: number }[] = [];
  const numPoints = levels.length;
  const pixelFixer = width / numPoints;

  for (let i = 0; i < numPoints; i++) {
    const x = i * pixelFixer;
    const y = height - (levels[i] * (height - waveOffset) + waveOffset);
    points.push({ x, y });
  }

  points[0].y = height - waveOffset;
  points[numPoints - 1] = { x: width, y: height - waveOffset };

  let path = `M 0 ${height}`;
  path += ` L ${points[0].x} ${points[0].y}`;

  let p1 = points[0];
  for (let i = 1; i < numPoints; i++) {
    const p2 = points[i];
    const mid = midPoint(p1, p2);
    const cp1 = controlPoint(mid, p1);
    path += ` Q ${cp1.x} ${cp1.y} ${mid.x} ${mid.y}`;
    const cp2 = controlPoint(mid, p2);
    path += ` Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
    p1 = p2;
  }

  path += ` L ${width} ${height}`;
  path += ' Z';

  return path;
}

const MitsuhaWaveView: React.FC<MitsuhaWaveViewProps> = ({
  audioLevels,
  waveColor,
  subwaveColor,
  width,
  height,
  waveOffset,
  siriEnabled = false,
  subSubwaveColor,
}) => {
  // Estado local para los paths (actualizado desde el hilo JS)
  const [mainPath, setMainPath] = useState('');
  const [subPath, setSubPath] = useState('');
  const [subSubPath, setSubSubPath] = useState('');

  // Callback para actualizar paths en el hilo JS
  const updatePaths = useCallback((levels: number[]) => {
    const path = createWavePath(levels, width, height, waveOffset);
    setMainPath(path);
    
    const subLevels = levels.map((v: number) => v * 0.85);
    const subPathStr = createWavePath(subLevels, width, height, waveOffset);
    setSubPath(subPathStr);
    
    if (siriEnabled) {
      const subSubLevels = levels.map((v: number) => v * 0.7);
      const subSubPathStr = createWavePath(subSubLevels, width, height, waveOffset);
      setSubSubPath(subSubPathStr);
    }
  }, [width, height, waveOffset, siriEnabled]);

  // Reaccionar a cambios en audioLevels - UI thread observa, JS thread procesa
  useAnimatedReaction(
    () => {
      'worklet';
      return audioLevels.value;
    },
    (currentLevels) => {
      'worklet';
      runOnJS(updatePaths)(currentLevels);
    },
    [updatePaths]
  );

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={waveColor} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={waveColor} stopOpacity={0.3} />
          </LinearGradient>
          <LinearGradient id="subwaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={subwaveColor} stopOpacity={0.6} />
            <Stop offset="100%" stopColor={subwaveColor} stopOpacity={0.1} />
          </LinearGradient>
          {siriEnabled && subSubwaveColor && (
            <LinearGradient id="subSubwaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={subSubwaveColor} stopOpacity={0.4} />
              <Stop offset="100%" stopColor={subSubwaveColor} stopOpacity={0.05} />
            </LinearGradient>
          )}
        </Defs>

        {/* Capa más profunda (si Siri está habilitado) */}
        {siriEnabled && subSubwaveColor && subSubPath && (
          <Path d={subSubPath} fill="url(#subSubwaveGradient)" />
        )}

        {/* Subwave (capa intermedia) */}
        {subPath && (
          <Path d={subPath} fill="url(#subwaveGradient)" />
        )}

        {/* Wave principal (capa superior) */}
        {mainPath && (
          <Path d={mainPath} fill="url(#waveGradient)" />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default MitsuhaWaveView;
