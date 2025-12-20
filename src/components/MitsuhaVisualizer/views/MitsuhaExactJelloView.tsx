/**
 * MitsuhaExactJelloView - RÉPLICA EXACTA de MSHFJelloView + MSHFJelloLayer
 * 
 * Código traducido directamente de libmitsuha6:
 * 
 * MSHFJelloView.swift:
 * - createPath() con CGMutablePath
 * - midPointForPoints() y controlPointForPoints() para curvas Bezier
 * - redraw() con delays de 0.25s y 0.50s para subwaves
 * 
 * MSHFJelloLayer.swift:
 * - CABasicAnimation de 0.15 segundos (150ms) para el path
 * 
 * MSHFView.m:
 * - setSampleData() para procesar datos de audio
 * - gain, sensitivity, limiter, waveOffset
 * - pixelFixer = width / numberOfPoints
 * - Cálculo de Y: (pureValue * sensitivity) + waveOffset
 */

import React, { useEffect, useRef, memo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedReaction,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';

// ============================================================================
// TIPOS - Exactos como CGPoint del original
// ============================================================================

interface CGPoint {
  x: number;
  y: number;
}

interface MitsuhaExactJelloViewProps {
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

// ============================================================================
// CONSTANTES - Exactas como el original
// ============================================================================

// MSHFJelloLayer: animation.duration = 0.15
const ANIMATION_DURATION_MS = 150;

// MSHFJelloView: DispatchQueue.main.asyncAfter(deadline: .now() + 0.25)
const SUBWAVE_DELAY_MS = 250;

// MSHFJelloView: DispatchQueue.main.asyncAfter(deadline: .now() + 0.50)
const SUBSUBWAVE_DELAY_MS = 500;

// ============================================================================
// FUNCIONES - Traducciones EXACTAS de MSHFJelloView.swift
// ============================================================================

/**
 * Traducción EXACTA de:
 * 
 * private func midPointForPoints(_ p1: CGPoint, _ p2: CGPoint) -> CGPoint {
 *     return CGPoint(x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2)
 * }
 */
const midPointForPoints = (p1: CGPoint, p2: CGPoint): CGPoint => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

/**
 * Traducción EXACTA de:
 * 
 * private func controlPointForPoints(_ p1: CGPoint, _ p2: CGPoint) -> CGPoint {
 *     var controlPoint = midPointForPoints(p1, p2)
 *     let diffY = abs(p2.y - controlPoint.y)
 *
 *     if p1.y < p2.y {
 *         controlPoint.y += diffY
 *     } else if p1.y > p2.y {
 *         controlPoint.y -= diffY
 *     }
 *
 *     return controlPoint
 * }
 */
const controlPointForPoints = (p1: CGPoint, p2: CGPoint): CGPoint => {
  const controlPoint = midPointForPoints(p1, p2);
  const diffY = Math.abs(p2.y - controlPoint.y);

  if (p1.y < p2.y) {
    controlPoint.y += diffY;
  } else if (p1.y > p2.y) {
    controlPoint.y -= diffY;
  }

  return controlPoint;
};

/**
 * Traducción EXACTA de createPath() de MSHFJelloView.swift:
 * 
 * private func createPath() -> CGPath {
 *     let path = CGMutablePath()
 *     let height = frame.size.height
 *     path.move(to: CGPoint(x: 0, y: height))
 *     
 *     var p1 = self.points.pointee
 *     path.addLine(to: p1)
 *
 *     for i in 1..<numberOfPoints {
 *         let p2 = self.points[i]
 *         let midPoint = midPointForPoints(p1, p2)
 *         
 *         path.addQuadCurve(to: midPoint, control: controlPointForPoints(midPoint, p1))
 *         path.addQuadCurve(to: p2, control: controlPointForPoints(midPoint, p2))
 *         
 *         p1 = p2
 *     }
 *
 *     path.addLine(to: CGPoint(x: frame.size.width, y: height))
 *     return path
 * }
 */
const createPath = (points: CGPoint[], frameWidth: number, frameHeight: number): string => {
  if (points.length < 2) {
    // Path vacío que va del fondo izquierdo al fondo derecho
    return `M 0 ${frameHeight} L ${frameWidth} ${frameHeight} Z`;
  }

  // path.move(to: CGPoint(x: 0, y: height))
  let path = `M 0 ${frameHeight}`;

  // var p1 = self.points.pointee (primer punto)
  let p1 = points[0];
  
  // path.addLine(to: p1)
  path += ` L ${p1.x} ${p1.y}`;

  // for i in 1..<numberOfPoints
  for (let i = 1; i < points.length; i++) {
    const p2 = points[i];
    const midPoint = midPointForPoints(p1, p2);

    // path.addQuadCurve(to: midPoint, control: controlPointForPoints(midPoint, p1))
    const cp1 = controlPointForPoints(midPoint, p1);
    path += ` Q ${cp1.x} ${cp1.y} ${midPoint.x} ${midPoint.y}`;

    // path.addQuadCurve(to: p2, control: controlPointForPoints(midPoint, p2))
    const cp2 = controlPointForPoints(midPoint, p2);
    path += ` Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;

    p1 = p2;
  }

  // path.addLine(to: CGPoint(x: frame.size.width, y: height))
  path += ` L ${frameWidth} ${frameHeight}`;
  
  // Cerrar el path
  path += ' Z';

  return path;
};

// ============================================================================
// WAVE LAYER - Simula MSHFJelloLayer con animación de 150ms
// ============================================================================

interface WaveLayerProps {
  pathData: string;
  color: string;
  opacity: number;
  width: number;
  height: number;
}

const WaveLayer: React.FC<WaveLayerProps> = memo(({
  pathData,
  color,
  opacity,
  width,
  height,
}) => {
  if (!pathData) return null;

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

// ============================================================================
// COMPONENTE PRINCIPAL - MitsuhaExactJelloView
// ============================================================================

const MitsuhaExactJelloView: React.FC<MitsuhaExactJelloViewProps> = ({
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
  // Estados para los paths de cada capa (como waveLayer, subwaveLayer, subSubwaveLayer)
  const [mainPath, setMainPath] = useState<string>('');
  const [subPath, setSubPath] = useState<string>('');
  const [subSubPath, setSubSubPath] = useState<string>('');

  // Valores actuales interpolados para animación de 150ms
  const currentPointsRef = useRef<CGPoint[]>([]);
  const targetPointsRef = useRef<CGPoint[]>([]);
  
  // Refs para timeouts (simula DispatchQueue.main.asyncAfter)
  const subwaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subSubwaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para el loop de animación
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // ============================================================================
  // INICIALIZACIÓN - Como MSHFView: self.points = malloc(sizeof(CGPoint) * numberOfPoints)
  // ============================================================================
  
  useEffect(() => {
    // Inicializar puntos como en el original
    // pixelFixer = bounds.size.width / numberOfPoints
    const pixelFixer = width / numberOfPoints;
    
    const initialPoints: CGPoint[] = [];
    for (let i = 0; i < numberOfPoints; i++) {
      initialPoints.push({
        x: i * pixelFixer,
        y: waveOffset, // Inicialmente en waveOffset (línea base)
      });
    }
    
    currentPointsRef.current = initialPoints.map(p => ({ ...p }));
    targetPointsRef.current = initialPoints.map(p => ({ ...p }));
    
    // Crear path inicial
    const initialPath = createPath(initialPoints, width, height);
    setMainPath(initialPath);
    setSubPath(initialPath);
    setSubSubPath(initialPath);
  }, [width, height, numberOfPoints, waveOffset]);

  // ============================================================================
  // ANIMACIÓN - Simula CABasicAnimation de MSHFJelloLayer (150ms)
  // ============================================================================
  
  useEffect(() => {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      // Factor de interpolación basado en 150ms
      // MEJORADO: Interpolación más suave tipo "spring" para efecto gelatina
      // Usar un lerp más bajo hace la animación más fluida y "jiggly"
      const baseLerp = Math.min(1, deltaTime / ANIMATION_DURATION_MS);
      const springLerp = baseLerp * 0.25; // Más lento = más fluido y orgánico
      
      let hasChanged = false;
      const currentPoints = currentPointsRef.current;
      const targetPoints = targetPointsRef.current;
      
      // Interpolar cada punto hacia su target con efecto "jelly"
      for (let i = 0; i < numberOfPoints; i++) {
        if (currentPoints[i] && targetPoints[i]) {
          const dy = targetPoints[i].y - currentPoints[i].y;
          
          // Umbral más bajo para animaciones más suaves
          if (Math.abs(dy) > 0.1) {
            // Añadir un poco de "overshoot" para efecto gelatina
            const overshoot = dy > 0 ? 1.05 : 0.95;
            currentPoints[i].y += dy * springLerp * overshoot;
            hasChanged = true;
          } else {
            currentPoints[i].y = targetPoints[i].y;
          }
          
          // X es fijo, no necesita interpolación
          currentPoints[i].x = targetPoints[i].x;
        }
      }
      
      // Solo actualizar el path si hubo cambios
      if (hasChanged) {
        const newPath = createPath(currentPoints, width, height);
        setMainPath(newPath);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [numberOfPoints, width, height]);

  // ============================================================================
  // setSampleData - Traducción EXACTA de MSHFView.m
  // ============================================================================
  
  const setSampleData = useCallback((data: number[]) => {
    // Como MSHFView.m setSampleData:
    // float const pixelFixer = self.bounds.size.width / self.numberOfPoints;
    const pixelFixer = width / (numberOfPoints - 1); // -1 para que el último punto llegue al borde
    
    const newTargets: CGPoint[] = [];
    
    for (let i = 0; i < numberOfPoints; i++) {
      // self.points[i].x = i * pixelFixer;
      const x = i * pixelFixer;
      
      // double pureValue = data[i * compressionRate] * self.gain;
      // Como no tenemos gain explícito, el dato ya viene procesado (0-1)
      const pureValue = data[i] || 0;
      
      // self.points[i].y = (pureValue * self.sensitivity) + self.waveOffset;
      // El valor representa qué tanto "sube" la onda desde waveOffset
      // En el original, Y más pequeño = más arriba en pantalla
      // height - (valor * altura_disponible) nos da la posición Y
      // AUMENTADO: Las ondas pueden ocupar hasta 85% de la altura
      const maxHeight = height * 0.85;
      const y = height - (pureValue * maxHeight) + waveOffset;
      
      // if (isnan(self.points[i].y)) self.points[i].y = self.waveOffset;
      const safeY = isNaN(y) ? height - waveOffset : Math.max(0, Math.min(height, y));
      
      newTargets.push({ x, y: safeY });
    }
    
    // Forzar que el primer y último punto estén en los bordes exactos
    // Para que las ondas cubran de borde a borde sin gaps
    if (newTargets.length > 0) {
      newTargets[0].x = 0;
      newTargets[0].y = height; // Empezar desde el fondo
      newTargets[newTargets.length - 1].x = width;
      newTargets[newTargets.length - 1].y = height; // Terminar en el fondo
    }
    
    targetPointsRef.current = newTargets;
    
    // ============================================================================
    // redraw() de MSHFJelloView - Delays para subwaves
    // ============================================================================
    
    const pathForSubwaves = createPath(newTargets, width, height);
    
    // DispatchQueue.main.asyncAfter(deadline: .now() + 0.25)
    if (subwaveTimeoutRef.current) {
      clearTimeout(subwaveTimeoutRef.current);
    }
    subwaveTimeoutRef.current = setTimeout(() => {
      setSubPath(pathForSubwaves);
    }, SUBWAVE_DELAY_MS);
    
    // DispatchQueue.main.asyncAfter(deadline: .now() + 0.50) - solo si siriEnabled
    if (siriEnabled) {
      if (subSubwaveTimeoutRef.current) {
        clearTimeout(subSubwaveTimeoutRef.current);
      }
      subSubwaveTimeoutRef.current = setTimeout(() => {
        setSubSubPath(pathForSubwaves);
      }, SUBSUBWAVE_DELAY_MS);
    }
  }, [width, height, numberOfPoints, waveOffset, siriEnabled]);

  // ============================================================================
  // REACCIONAR A CAMBIOS DE AUDIO
  // ============================================================================
  
  useAnimatedReaction(
    () => audioLevels.value,
    (currentLevels) => {
      'worklet';
      if (currentLevels && currentLevels.length > 0) {
        runOnJS(setSampleData)(currentLevels);
      }
    },
    [setSampleData]
  );

  // ============================================================================
  // CLEANUP
  // ============================================================================
  
  useEffect(() => {
    return () => {
      if (subwaveTimeoutRef.current) clearTimeout(subwaveTimeoutRef.current);
      if (subSubwaveTimeoutRef.current) clearTimeout(subSubwaveTimeoutRef.current);
    };
  }, []);

  // ============================================================================
  // COLORES - Como updateWave del original
  // ============================================================================
  
  const effectiveSubwaveColor = subwaveColor || waveColor;
  const effectiveSubSubwaveColor = subSubwaveColor || effectiveSubwaveColor;

  // ============================================================================
  // RENDER - Como initializeWaveLayers del original
  // waveLayer.zPosition = 0
  // subwaveLayer.zPosition = -1
  // subSubwaveLayer.zPosition = -2
  // ============================================================================

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {/* subSubwaveLayer - zPosition = -2 (más atrás) */}
      {siriEnabled && (
        <WaveLayer
          pathData={subSubPath}
          color={effectiveSubSubwaveColor}
          opacity={0.4}
          width={width}
          height={height}
        />
      )}

      {/* subwaveLayer - zPosition = -1 - onda secundaria retrasada */}
      <WaveLayer
        pathData={subPath}
        color={effectiveSubwaveColor}
        opacity={0.55}
        width={width}
        height={height}
      />

      {/* waveLayer - zPosition = 0 (frente) - onda principal */}
      <WaveLayer
        pathData={mainPath}
        color={waveColor}
        opacity={0.75}
        width={width}
        height={height}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden', // Evitar que las ondas se salgan del contenedor
    backgroundColor: 'transparent',
  },
});

export default memo(MitsuhaExactJelloView);
