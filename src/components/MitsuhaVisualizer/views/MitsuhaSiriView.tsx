/**
 * MitsuhaSiriView - Vista estilo Siri con ondas espejo
 * 
 * Replica MSHFSiriView de libmitsuha6
 * Ondas con reflejo vertical y colores RGB con blending
 * 
 * VERSIÓN SIMPLIFICADA - Usa useAnimatedReaction + runOnJS
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  SharedValue,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface MitsuhaSiriViewProps {
  audioLevels: SharedValue<number[]>;
  waveColor: string;
  subwaveColor: string;
  subSubwaveColor: string;
  width: number;
  height: number;
  waveOffset: number;
}

/**
 * Calcula puntos de control para curvas suaves
 */
function midPoint(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function controlPoint(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const mid = midPoint(p1, p2);
  const diffY = Math.abs(p2.y - mid.y);
  if (p1.y < p2.y) return { x: mid.x, y: mid.y + diffY };
  if (p1.y > p2.y) return { x: mid.x, y: mid.y - diffY };
  return mid;
}

/**
 * Genera path para onda Siri (sin cerrar, solo la línea superior)
 */
function createSiriPath(
  levels: number[],
  width: number,
  height: number,
  waveOffset: number
): string {
  if (levels.length === 0) return '';

  const points: { x: number; y: number }[] = [];
  const numPoints = levels.length;
  const pixelFixer = width / numPoints;
  const centerY = height / 2;

  for (let i = 0; i < numPoints; i++) {
    const x = i * pixelFixer;
    const amplitude = levels[i] * (height / 3);
    const y = centerY - amplitude;
    points.push({ x, y });
  }

  points[0].y = centerY - waveOffset;
  points[numPoints - 1] = { x: width, y: centerY - waveOffset };

  let path = `M 0 ${centerY}`;
  path += ` L ${points[0].x} ${points[0].y}`;

  let p1 = points[0];
  for (let i = 1; i < numPoints; i++) {
    const p2 = points[i];
    const mid = midPoint(p1, p2);
    const cp1 = controlPoint(mid, p1);
    const cp2 = controlPoint(mid, p2);
    path += ` Q ${cp1.x} ${cp1.y} ${mid.x} ${mid.y}`;
    path += ` Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
    p1 = p2;
  }

  path += ` L ${width} ${centerY}`;
  
  for (let i = numPoints - 1; i >= 0; i--) {
    const x = points[i].x;
    const y = 2 * centerY - points[i].y;
    if (i === numPoints - 1) {
      path += ` L ${x} ${y}`;
    } else {
      const nextPoint = points[i + 1];
      const nextY = 2 * centerY - nextPoint.y;
      const p1r = { x, y };
      const p2r = { x: nextPoint.x, y: nextY };
      const midr = midPoint(p1r, p2r);
      path += ` Q ${midr.x} ${midr.y} ${x} ${y}`;
    }
  }

  path += ' Z';
  return path;
}

const MitsuhaSiriView: React.FC<MitsuhaSiriViewProps> = ({
  audioLevels,
  waveColor,
  subwaveColor,
  subSubwaveColor,
  width,
  height,
  waveOffset,
}) => {
  const [redPath, setRedPath] = useState('');
  const [greenPath, setGreenPath] = useState('');
  const [bluePath, setBluePath] = useState('');

  const updatePaths = useCallback((levels: number[]) => {
    // Rojo (principal)
    const red = createSiriPath(levels, width, height, waveOffset);
    setRedPath(red);

    // Verde (con ligero offset)
    const greenLevels = levels.map((v: number, i: number) => v * 0.9 + 0.02 * Math.sin(i * 0.5));
    const green = createSiriPath(greenLevels, width, height, waveOffset);
    setGreenPath(green);

    // Azul (más delay)
    const blueLevels = levels.map((v: number, i: number) => v * 0.8 + 0.03 * Math.cos(i * 0.5));
    const blue = createSiriPath(blueLevels, width, height, waveOffset);
    setBluePath(blue);
  }, [width, height, waveOffset]);

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
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={waveColor} stopOpacity={0.8} />
            <Stop offset="50%" stopColor={waveColor} stopOpacity={0.6} />
            <Stop offset="100%" stopColor={waveColor} stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={subwaveColor} stopOpacity={0.7} />
            <Stop offset="50%" stopColor={subwaveColor} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={subwaveColor} stopOpacity={0.7} />
          </LinearGradient>
          <LinearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={subSubwaveColor} stopOpacity={0.6} />
            <Stop offset="50%" stopColor={subSubwaveColor} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={subSubwaveColor} stopOpacity={0.6} />
          </LinearGradient>
        </Defs>

        {bluePath && <Path d={bluePath} fill="url(#blueGradient)" opacity={0.6} />}
        {greenPath && <Path d={greenPath} fill="url(#greenGradient)" opacity={0.7} />}
        {redPath && <Path d={redPath} fill="url(#redGradient)" opacity={0.8} />}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default MitsuhaSiriView;
