import { NativeModules, Platform } from 'react-native';

// Interfaz para nuestro módulo nativo personalizado
interface EqualizerModule {
  initialize: () => Promise<boolean>;
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
  // iOS: 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz (10 bandas)
  private bandMapping: Map<number, number> = new Map();

  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS !== 'ios') {
        console.log('[EqualizerService] ⚠️ Solo iOS soportado actualmente');
        return false;
      }

      const Equalizer = NativeModules.RNEqualizer as EqualizerModule;
      
      if (!Equalizer) {
        console.log('[EqualizerService] ❌ Módulo nativo RNEqualizer no disponible');
        console.log('[EqualizerService] 💡 Asegúrate de ejecutar: npx expo run:ios');
        return false;
      }

      // Inicializar el módulo nativo
      const initialized = await Equalizer.initialize();
      if (!initialized) {
        console.log('[EqualizerService] ❌ No se pudo inicializar el ecualizador nativo');
        return false;
      }

      // Obtener información del ecualizador nativo
      const numberOfBands = await Equalizer.getNumberOfBands();
      const [minLevel, maxLevel] = await Equalizer.getBandLevelRange();

      console.log('[EqualizerService] 📊 Bandas disponibles:', numberOfBands);
      console.log('[EqualizerService] 📊 Rango:', minLevel, 'a', maxLevel, 'dB');

      // Nuestro módulo nativo tiene EXACTAMENTE las frecuencias que necesitamos
      // 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
      // Mapeo directo 1:1
      for (let i = 0; i < numberOfBands; i++) {
        const centerFreq = await Equalizer.getCenterFreq(i);
        console.log(`[EqualizerService] Banda ${i}: ${centerFreq} Hz`);
        this.bandMapping.set(i, i); // Mapeo directo
      }

      // Inicializar valores actuales en 0
      this.currentValues = new Array(10).fill(0);

      console.log('[EqualizerService] ✅ Inicializado correctamente');
      console.log('[EqualizerService] 🎛️ Bandas configuradas: 10 (32Hz - 16kHz)');
      
      return true;
    } catch (error) {
      console.error('[EqualizerService] ❌ Error al inicializar:', error);
      return false;
    }
  }

  async applyEqValues(values: number[]): Promise<void> {
    try {
      if (!this.enabled) {
        console.log('[EqualizerService] ⚠️ Ecualizador no habilitado, habilitando...');
        await this.setEnabled(true);
      }

      const Equalizer = NativeModules.RNEqualizer as EqualizerModule;
      if (!Equalizer) {
        console.log('[EqualizerService] ⚠️ Módulo no disponible');
        return;
      }

      this.currentValues = values;

      console.log('[EqualizerService] 🎛️ Aplicando valores:', values.map(v => `${v.toFixed(1)}dB`).join(', '));

      // Mapeo directo 1:1 - nuestro módulo nativo tiene EXACTAMENTE nuestras frecuencias
      // 32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
      for (let i = 0; i < Math.min(values.length, 10); i++) {
        // Limitar valor entre -20 y +20 dB
        const clampedValue = Math.max(-20, Math.min(20, values[i]));
        await Equalizer.setBandLevel(i, clampedValue);
        
        const frequencies = [32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        console.log(`[EqualizerService] ✅ Banda ${i} (${frequencies[i]}Hz): ${clampedValue.toFixed(1)}dB`);
      }

      console.log('[EqualizerService] ✅ Ecualizador aplicado exitosamente');
    } catch (error) {
      console.error('[EqualizerService] ❌ Error aplicando ecualizador:', error);
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    try {
      const Equalizer = NativeModules.RNEqualizer as EqualizerModule;
      
      if (!Equalizer) {
        console.log('[EqualizerService] ⚠️ Módulo no disponible');
        return;
      }

      await Equalizer.enable(enabled);
      this.enabled = enabled;
      console.log('[EqualizerService] 🎚️ Ecualizador', enabled ? 'activado ✅' : 'desactivado 🔇');
    } catch (error) {
      console.error('[EqualizerService] ❌ Error al cambiar estado:', error);
    }
  }

  async setBandLevel(bandIndex: number, level: number): Promise<void> {
    try {
      const Equalizer = NativeModules.RNEqualizer as EqualizerModule;
      
      if (!Equalizer) {
        console.log('[EqualizerService] ⚠️ Módulo no disponible');
        return;
      }

      // Validar índice de banda
      if (bandIndex < 0 || bandIndex >= 10) {
        console.warn('[EqualizerService] ⚠️ Índice de banda inválido:', bandIndex);
        return;
      }

      // Limitar nivel entre -20 y +20 dB
      const clampedLevel = Math.max(-20, Math.min(20, level));

      // Establecer nivel directamente (mapeo 1:1)
      await Equalizer.setBandLevel(bandIndex, clampedLevel);
      this.currentValues[bandIndex] = clampedLevel;

      const frequencies = [32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      console.log(`[EqualizerService] 🎛️ Banda ${bandIndex} (${frequencies[bandIndex]}Hz): ${clampedLevel.toFixed(1)}dB`);
    } catch (error) {
      console.error('[EqualizerService] ❌ Error al ajustar banda:', error);
    }
  }

  async disable(): Promise<void> {
    try {
      await this.setEnabled(false);
      console.log('[EqualizerService] 🔇 Ecualizador deshabilitado');
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
