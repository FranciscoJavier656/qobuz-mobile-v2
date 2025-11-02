import { NativeModules, Platform } from 'react-native';

// Interfaz para react-native-equalizer
interface EqualizerModule {
  enable: (enabled: boolean) => Promise<void>;
  setBandLevel: (bandIndex: number, level: number) => Promise<void>;
  getBandLevelRange: () => Promise<[number, number]>;
  getNumberOfBands: () => Promise<number>;
  getCenterFreq: (bandIndex: number) => Promise<number>;
}

class EqualizerService {
  private enabled: boolean = false;
  private currentValues: number[] = [];
  
  // Mapeo de nuestras frecuencias a los índices de bandas del sistema
  // Sistema típicamente tiene: 60, 230, 910, 3600, 14000 Hz
  // Nuestras bandas: 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
  private bandMapping: Map<number, number> = new Map();

  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        console.log('[EqualizerService] ⚠️ Plataforma no soportada');
        return false;
      }

      const Equalizer = NativeModules.Equalizer as EqualizerModule;
      
      if (!Equalizer) {
        console.log('[EqualizerService] ❌ Módulo nativo de ecualizador no disponible');
        console.log('[EqualizerService] 💡 Asegúrate de ejecutar: npx expo run:ios');
        return false;
      }

      // Obtener información de las bandas disponibles
      const numBands = await Equalizer.getNumberOfBands();
      const [minLevel, maxLevel] = await Equalizer.getBandLevelRange();
      
      console.log('[EqualizerService] ✅ Inicializado');
      console.log(`[EqualizerService] 📊 Bandas disponibles: ${numBands}`);
      console.log(`[EqualizerService] 📊 Rango: ${minLevel} a ${maxLevel} dB`);

      // Mapear nuestras frecuencias a las bandas del sistema
      for (let i = 0; i < numBands; i++) {
        const freq = await Equalizer.getCenterFreq(i);
        console.log(`[EqualizerService] Banda ${i}: ${freq} Hz`);
        this.bandMapping.set(i, freq);
      }

      await Equalizer.enable(true);
      this.enabled = true;
      
      return true;
    } catch (error) {
      console.error('[EqualizerService] ❌ Error al inicializar:', error);
      return false;
    }
  }

  async applyEqValues(values: number[]): Promise<void> {
    try {
      if (!this.enabled) {
        console.log('[EqualizerService] ⚠️ Ecualizador no habilitado');
        return;
      }

      const Equalizer = NativeModules.Equalizer as EqualizerModule;
      if (!Equalizer) return;

      this.currentValues = values;

      // Nuestras frecuencias: 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
      // Sistema típico Android: 60, 230, 910, 3600, 14000 Hz (5 bandas)
      // Sistema típico iOS: 32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz (10 bandas)
      
      const numBands = await Equalizer.getNumberOfBands();
      const [minLevel, maxLevel] = await Equalizer.getBandLevelRange();
      
      console.log('[EqualizerService] 🎛️ Aplicando valores:', values);

      if (numBands === 10) {
        // iOS típicamente tiene 10 bandas que coinciden perfectamente
        for (let i = 0; i < Math.min(values.length, numBands); i++) {
          // Convertir de nuestro rango (-20 a +20) al rango del sistema
          const normalizedValue = this.normalizeValue(values[i], minLevel, maxLevel);
          await Equalizer.setBandLevel(i, normalizedValue);
          console.log(`[EqualizerService] Banda ${i}: ${values[i]} dB -> ${normalizedValue}`);
        }
      } else if (numBands === 5) {
        // Android típicamente tiene 5 bandas, necesitamos interpolar
        const interpolated = this.interpolateTo5Bands(values);
        for (let i = 0; i < interpolated.length; i++) {
          const normalizedValue = this.normalizeValue(interpolated[i], minLevel, maxLevel);
          await Equalizer.setBandLevel(i, normalizedValue);
          console.log(`[EqualizerService] Banda ${i}: ${interpolated[i]} dB -> ${normalizedValue}`);
        }
      } else {
        // Otro número de bandas, intentar mapeo proporcional
        console.log('[EqualizerService] ⚠️ Número de bandas no estándar:', numBands);
        const ratio = values.length / numBands;
        for (let i = 0; i < numBands; i++) {
          const sourceIndex = Math.floor(i * ratio);
          const value = values[sourceIndex] || 0;
          const normalizedValue = this.normalizeValue(value, minLevel, maxLevel);
          await Equalizer.setBandLevel(i, normalizedValue);
        }
      }

      console.log('[EqualizerService] ✅ Ecualizador aplicado exitosamente');
    } catch (error) {
      console.error('[EqualizerService] ❌ Error aplicando ecualizador:', error);
    }
  }

  // Interpolar 10 bandas a 5 bandas (para Android)
  // Nuestras 10: 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
  // Android 5: ~60, ~230, ~910, ~3600, ~14000
  private interpolateTo5Bands(values: number[]): number[] {
    if (values.length !== 10) return values;
    
    return [
      (values[0] + values[1]) / 2,  // 32+55 -> ~60 Hz
      (values[2] + values[3]) / 2,  // 125+250 -> ~230 Hz
      (values[4] + values[5]) / 2,  // 500+1000 -> ~910 Hz
      (values[6] + values[7]) / 2,  // 2000+4000 -> ~3600 Hz
      (values[8] + values[9]) / 2,  // 8000+16000 -> ~14000 Hz
    ];
  }

  // Normalizar valor de nuestro rango (-20 a +20) al rango del sistema
  private normalizeValue(value: number, minLevel: number, maxLevel: number): number {
    // Nuestro rango: -20 a +20
    const ourMin = -20;
    const ourMax = 20;
    const ourRange = ourMax - ourMin;
    
    // Rango del sistema
    const sysRange = maxLevel - minLevel;
    
    // Convertir
    const normalized = ((value - ourMin) / ourRange) * sysRange + minLevel;
    
    // Asegurar que esté en el rango válido
    return Math.max(minLevel, Math.min(maxLevel, normalized));
  }

  async disable(): Promise<void> {
    try {
      const Equalizer = NativeModules.Equalizer as EqualizerModule;
      if (Equalizer) {
        await Equalizer.enable(false);
        this.enabled = false;
        console.log('[EqualizerService] 🔇 Ecualizador deshabilitado');
      }
    } catch (error) {
      console.error('[EqualizerService] Error al deshabilitar:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getCurrentValues(): number[] {
    return this.currentValues;
  }
}

export default new EqualizerService();
