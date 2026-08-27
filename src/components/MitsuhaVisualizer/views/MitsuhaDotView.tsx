/**
 * MitsuhaDotView - Vista de puntos/círculos
 * 
 * Replica MSHFDotView de libmitsuha6
 * Círculos que escalan según la amplitud del audio
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

interface MitsuhaDotViewProps {
  // Niveles de audio (0-1)
  audioLevels: SharedValue<number[]>;
  // Color de los puntos
  waveColor: string;
  // Dimensiones
  width: number;
  height: number;
  // Espaciado entre puntos
  barSpacing: number;
  // Número de puntos
  numberOfPoints: number;
  // Modo Siri
  siriEnabled?: boolean;
  subwaveColor?: string;
  subSubwaveColor?: string;
}

interface DotProps {
  index: number;
  audioLevels: SharedValue<number[]>;
  color: string;
  baseSize: number;
  x: number;
  centerY: number;
}

const AnimatedDot: React.FC<DotProps> = ({
  index,
  audioLevels,
  color,
  baseSize,
  x,
  centerY,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const level = audioLevels.value[index] || 0;
    
    // El punto crece y se eleva según el nivel
    const scale = 1 + level * 1.5; // Escala de 1x a 2.5x
    const translateY = -level * 50; // Se eleva hasta 50px
    
    return {
      transform: [
        { translateY: withSpring(translateY, { damping: 12, stiffness: 180 }) },
        { scale: withSpring(scale, { damping: 12, stiffness: 180 }) },
      ],
      opacity: withSpring(0.5 + level * 0.5, { damping: 15 }), // Opacidad 0.5 a 1
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          backgroundColor: color,
          left: x - baseSize / 2,
          top: centerY - baseSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

const MitsuhaDotView: React.FC<MitsuhaDotViewProps> = ({
  audioLevels,
  waveColor,
  width,
  height,
  barSpacing,
  numberOfPoints,
  siriEnabled = false,
  subwaveColor,
  subSubwaveColor,
}) => {
  // Calcular tamaño y posición de cada punto
  const totalWidth = width - barSpacing * 2;
  const spacing = totalWidth / (numberOfPoints - 1 || 1);
  const baseSize = Math.min(spacing - barSpacing, height * 0.15);
  const actualSize = Math.max(8, baseSize);
  const centerY = height * 0.7; // Puntos centrados en el 70% inferior

  // Generar puntos
  const dots = [];
  for (let i = 0; i < numberOfPoints; i++) {
    const x = barSpacing + i * spacing;
    dots.push(
      <AnimatedDot
        key={`dot-${i}`}
        index={i}
        audioLevels={audioLevels}
        color={waveColor}
        baseSize={actualSize}
        x={x}
        centerY={centerY}
      />
    );
  }

  // Puntos adicionales para modo Siri
  const siriDotsGreen = siriEnabled && subwaveColor ? (
    <View style={[styles.siriLayer, { opacity: 0.6 }]}>
      {Array.from({ length: numberOfPoints }).map((_, i) => (
        <AnimatedDot
          key={`dot-green-${i}`}
          index={i}
          audioLevels={audioLevels}
          color={subwaveColor}
          baseSize={actualSize * 0.9}
          x={barSpacing + i * spacing}
          centerY={centerY + 10}
        />
      ))}
    </View>
  ) : null;

  const siriDotsBlue = siriEnabled && subSubwaveColor ? (
    <View style={[styles.siriLayer, { opacity: 0.4 }]}>
      {Array.from({ length: numberOfPoints }).map((_, i) => (
        <AnimatedDot
          key={`dot-blue-${i}`}
          index={i}
          audioLevels={audioLevels}
          color={subSubwaveColor}
          baseSize={actualSize * 0.8}
          x={barSpacing + i * spacing}
          centerY={centerY + 20}
        />
      ))}
    </View>
  ) : null;

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Capa más profunda */}
      {siriDotsBlue}
      
      {/* Capa intermedia */}
      {siriDotsGreen}
      
      {/* Capa principal */}
      <View style={StyleSheet.absoluteFill}>
        {dots}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
  },
  siriLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default MitsuhaDotView;
