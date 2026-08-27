/**
 * useAudioMeter - Hook para obtener datos de audio en tiempo real
 * 
 * Genera datos de audio simulados o reales basados en el estado de reproducción.
 * OPTIMIZADO para 60fps sin re-renders innecesarios.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface UseAudioMeterOptions {
  numberOfPoints: number;
  gain: number;
  sensitivity: number;
  limiter: number;
  isPlaying: boolean;
  fps: number;
  enableFFT: boolean;
}

interface AudioMeterResult {
  audioLevels: SharedValue<number[]>;
  isActive: boolean;
  silentSince: number;
  feedAudioData: (data: number[]) => void;
}

export function useAudioMeter(options: UseAudioMeterOptions): AudioMeterResult {
  const {
    numberOfPoints,
    gain,
    sensitivity,
    isPlaying,
    fps,
    limiter,
  } = options;

  // Usar refs en lugar de state para evitar re-renders
  const isActiveRef = useRef(false);
  const silentSinceRef = useRef(-1);
  
  // Shared value para animaciones fluidas
  const audioLevels = useSharedValue<number[]>(
    new Array(numberOfPoints).fill(0.05)
  );
  
  // Refs para el generador de audio
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const basePhaseRef = useRef(Math.random() * Math.PI * 2);

  // Generador de audio simulado - replica el comportamiento visual de Mitsuha
  // Genera ondas más orgánicas y variadas como el original
  const generateSimulatedAudio = useCallback((): number[] => {
    const time = Date.now() / 1000;
    phaseRef.current += 0.08; // Velocidad de fase más rápida
    basePhaseRef.current += 0.03;
    
    const data = new Array(numberOfPoints);
    
    // Beat base pulsante - simula el bajo/kick
    const bassBeat = Math.pow(Math.abs(Math.sin(time * 2.2)), 2.5) * 0.5;
    
    // Variación aleatoria sutil por frame para más "vida"
    const randomVariation = Math.random() * 0.15;
    
    for (let i = 0; i < numberOfPoints; i++) {
      // Posición normalizada (0-1)
      const pos = i / (numberOfPoints - 1);
      
      // Ondas múltiples con diferentes frecuencias - más dramáticas
      const wave1 = Math.sin(time * 1.8 + pos * 5 + phaseRef.current) * 0.35;
      const wave2 = Math.sin(time * 3.2 + pos * 8 + basePhaseRef.current) * 0.2;
      const wave3 = Math.sin(time * 5.5 + pos * 12) * 0.1;
      
      // Onda de baja frecuencia para movimiento más fluido
      const lowFreq = Math.sin(time * 0.5 + pos * 2) * 0.2;
      
      // Fade en los bordes - pero no llega a 0 para transición suave
      // Usar una curva más suave que permite más altura en el centro
      const edgeFade = Math.pow(Math.sin(pos * Math.PI), 0.6);
      
      // Combinar ondas con más intensidad base
      let value = (bassBeat + wave1 + wave2 + wave3 + lowFreq + 0.25 + randomVariation) * edgeFade;
      
      // Aplicar gain y sensitivity como el original
      value = value * (gain / 50) * sensitivity;
      
      // Aplicar limiter como el original
      if (limiter > 0) {
        value = Math.min(value, limiter);
      }
      
      // Clamp entre 0 y 1
      data[i] = Math.max(0, Math.min(1, value));
    }
    
    // Extremos suaves (no cero absoluto para evitar "saltos")
    data[0] = data[0] * 0.1;
    data[numberOfPoints - 1] = data[numberOfPoints - 1] * 0.1;
    
    return data;
  }, [numberOfPoints, gain, sensitivity, limiter]);

  // Función para alimentar datos de audio externos
  const feedAudioData = useCallback((data: number[]) => {
    if (data.length === 0) return;
    
    const compressed = new Array(numberOfPoints);
    const ratio = data.length / numberOfPoints;
    
    for (let i = 0; i < numberOfPoints; i++) {
      const startIdx = Math.floor(i * ratio);
      const endIdx = Math.floor((i + 1) * ratio);
      
      let sum = 0;
      let count = 0;
      for (let j = startIdx; j < endIdx && j < data.length; j++) {
        sum += Math.abs(data[j]);
        count++;
      }
      
      let value = count > 0 ? sum / count : 0;
      value = value * (gain / 50) * sensitivity;
      
      if (limiter > 0) {
        value = Math.min(value, limiter);
      }
      
      compressed[i] = Math.max(0, Math.min(1, value));
    }
    
    audioLevels.value = compressed;
    
    const hasAudio = compressed.some(v => v > 0.01);
    if (hasAudio) {
      silentSinceRef.current = Date.now();
      isActiveRef.current = true;
    }
  }, [numberOfPoints, gain, sensitivity, limiter]);

  // Loop de animación principal - sin setState para evitar re-renders
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Fade out - valores pequeños, no cero
      audioLevels.value = new Array(numberOfPoints).fill(0.02);
      isActiveRef.current = false;
      return;
    }
    
    const frameInterval = 1000 / fps;
    
    const animate = () => {
      const now = performance.now();
      
      if (now - lastUpdateRef.current >= frameInterval) {
        lastUpdateRef.current = now;
        
        // Generar y asignar directamente al SharedValue
        audioLevels.value = generateSimulatedAudio();
        
        isActiveRef.current = true;
        silentSinceRef.current = Date.now();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    isActiveRef.current = true;
    silentSinceRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, fps, numberOfPoints, generateSimulatedAudio]);

  // Resetear cuando cambia el número de puntos
  useEffect(() => {
    audioLevels.value = new Array(numberOfPoints).fill(0.05);
  }, [numberOfPoints]);

  return {
    audioLevels,
    get isActive() { return isActiveRef.current; },
    get silentSince() { return silentSinceRef.current; },
    feedAudioData,
  };
}

export default useAudioMeter;
