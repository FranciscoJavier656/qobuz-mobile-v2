/**
 * MitsuhaBarView - Vista de barras verticales
 * 
 * Replica MSHFBarView de libmitsuha6
 * Barras que crecen desde abajo según la amplitud del audio
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

interface MitsuhaBarViewProps {
  // Niveles de audio (0-1)
  audioLevels: SharedValue<number[]>;
  // Color de las barras
  waveColor: string;
  // Dimensiones
  width: number;
  height: number;
  // Espaciado entre barras
  barSpacing: number;
  // Radio de esquinas
  barCornerRadius: number;
  // Número de barras
  numberOfPoints: number;
  // Modo Siri (barras con colores RGB y delay)
  siriEnabled?: boolean;
  subwaveColor?: string;
  subSubwaveColor?: string;
}

interface BarProps {
  index: number;
  audioLevels: SharedValue<number[]>;
  color: string;
  barWidth: number;
  barSpacing: number;
  height: number;
  cornerRadius: number;
  delay?: number; // Delay en ms para efecto Siri
}

const AnimatedBar: React.FC<BarProps> = ({
  index,
  audioLevels,
  color,
  barWidth,
  barSpacing,
  height,
  cornerRadius,
  delay = 0,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const levels = audioLevels.value;
    const level = (levels && levels[index] !== undefined) ? levels[index] : 0.05;
    // Altura mínima de 4px para que siempre sea visible
    const barHeight = Math.max(4, level * height);
    
    return {
      height: withSpring(barHeight, {
        damping: 12,  // Más suave para 60fps
        stiffness: 200, // Más responsivo
        mass: 0.3,    // Más ligero
      }),
      backgroundColor: color,
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: barWidth,
          marginHorizontal: barSpacing / 2,
          borderRadius: cornerRadius,
        },
        animatedStyle,
      ]}
    />
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
  // Calcular ancho de cada barra
  const totalSpacing = barSpacing * (numberOfPoints + 1);
  const barWidth = (width - totalSpacing) / numberOfPoints;
  const actualBarWidth = Math.max(1, barWidth);

  // Generar las barras
  const bars = [];
  for (let i = 0; i < numberOfPoints; i++) {
    bars.push(
      <AnimatedBar
        key={`bar-${i}`}
        index={i}
        audioLevels={audioLevels}
        color={waveColor}
        barWidth={actualBarWidth}
        barSpacing={barSpacing}
        height={height}
        cornerRadius={barCornerRadius}
      />
    );
  }

  // Barras adicionales para modo Siri (con delay)
  const siriBarsGreen = siriEnabled && subwaveColor ? (
    <View style={[styles.siriLayer, { opacity: 0.7 }]}>
      {Array.from({ length: numberOfPoints }).map((_, i) => (
        <AnimatedBar
          key={`bar-green-${i}`}
          index={i}
          audioLevels={audioLevels}
          color={subwaveColor}
          barWidth={actualBarWidth}
          barSpacing={barSpacing}
          height={height}
          cornerRadius={barCornerRadius}
          delay={250}
        />
      ))}
    </View>
  ) : null;

  const siriBarsBlue = siriEnabled && subSubwaveColor ? (
    <View style={[styles.siriLayer, { opacity: 0.5 }]}>
      {Array.from({ length: numberOfPoints }).map((_, i) => (
        <AnimatedBar
          key={`bar-blue-${i}`}
          index={i}
          audioLevels={audioLevels}
          color={subSubwaveColor}
          barWidth={actualBarWidth}
          barSpacing={barSpacing}
          height={height}
          cornerRadius={barCornerRadius}
          delay={500}
        />
      ))}
    </View>
  ) : null;

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Capa más profunda (azul en modo Siri) */}
      {siriBarsBlue}
      
      {/* Capa intermedia (verde en modo Siri) */}
      {siriBarsGreen}
      
      {/* Capa principal */}
      <View style={styles.barsContainer}>
        {bars}
      </View>
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
    justifyContent: 'center',
  },
  bar: {
    minHeight: 4,
  },
  siriLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MitsuhaBarView;
