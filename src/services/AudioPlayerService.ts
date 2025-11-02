import { NativeModules, Platform } from 'react-native';

interface AudioPlayerModule {
  // Ecualizador
  initialize: () => Promise<boolean>;
  enable: (enabled: boolean) => Promise<void>;
  setBandLevel: (bandIndex: number, level: number) => Promise<void>;
  getBandLevelRange: () => Promise<[number, number]>;
  getNumberOfBands: () => Promise<number>;
  getCenterFreq: (bandIndex: number) => Promise<number>;
  
  // Reproductor
  loadAudio: (uri: string) => Promise<{ duration: number; uri: string }>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getStatus: () => Promise<{
    isPlaying: boolean;
    positionMillis: number;
    durationMillis: number;
    volume: number;
  }>;
  seekTo: (positionMs: number) => Promise<void>;
}

export interface AudioStatus {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  volume: number;
}

class AudioPlayerService {
  private player: AudioPlayerModule | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private onStatusUpdate?: (status: AudioStatus) => void;
  private onPlaybackFinished?: () => void;

  constructor() {
    if (Platform.OS === 'ios') {
      this.player = NativeModules.RNEqualizer as AudioPlayerModule;
      
      if (!this.player) {
        console.warn('[AudioPlayerService] ⚠️ Módulo nativo no disponible');
      } else {
        console.log('[AudioPlayerService] ✅ Módulo nativo cargado');
      }
    } else {
      console.warn('[AudioPlayerService] ⚠️ Solo iOS soportado actualmente');
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.player) return false;

    try {
      const result = await this.player.initialize();
      console.log('[AudioPlayerService] ✅ Inicializado');
      return result;
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error inicializando:', error);
      return false;
    }
  }

  async loadAsync(uri: string): Promise<{ durationMillis: number }> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      console.log('[AudioPlayerService] 📂 Cargando:', uri);
      const result = await this.player.loadAudio(uri);
      console.log('[AudioPlayerService] ✅ Audio cargado:', result.duration, 'ms');
      
      return { durationMillis: result.duration };
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error cargando audio:', error);
      throw error;
    }
  }

  async playAsync(): Promise<void> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      await this.player.play();
      this.startStatusUpdates();
      console.log('[AudioPlayerService] ▶️ Reproduciendo');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error reproduciendo:', error);
      throw error;
    }
  }

  async pauseAsync(): Promise<void> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      await this.player.pause();
      this.stopStatusUpdates();
      console.log('[AudioPlayerService] ⏸️ Pausado');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error pausando:', error);
      throw error;
    }
  }

  async stopAsync(): Promise<void> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      await this.player.stop();
      this.stopStatusUpdates();
      console.log('[AudioPlayerService] ⏹️ Detenido');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error deteniendo:', error);
      throw error;
    }
  }

  async setVolumeAsync(volume: number): Promise<void> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      await this.player.setVolume(volume);
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error ajustando volumen:', error);
      throw error;
    }
  }

  async getStatusAsync(): Promise<AudioStatus> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      const status = await this.player.getStatus();
      return status;
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error obteniendo status:', error);
      throw error;
    }
  }

  async setPositionAsync(positionMillis: number): Promise<void> {
    if (!this.player) {
      throw new Error('Player no disponible');
    }

    try {
      await this.player.seekTo(positionMillis);
      console.log('[AudioPlayerService] ⏩ Seek a', positionMillis, 'ms');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error en seek:', error);
      throw error;
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: AudioStatus) => void): void {
    this.onStatusUpdate = callback;
  }

  setOnPlaybackFinished(callback: () => void): void {
    this.onPlaybackFinished = callback;
  }

  async unloadAsync(): Promise<void> {
    if (!this.player) return;

    try {
      await this.stopAsync();
      this.stopStatusUpdates();
      console.log('[AudioPlayerService] 🗑️ Audio descargado');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error descargando:', error);
    }
  }

  // Métodos del ecualizador
  async enableEqualizer(enabled: boolean): Promise<void> {
    if (!this.player) return;

    try {
      await this.player.enable(enabled);
      console.log('[AudioPlayerService] 🎚️ Ecualizador', enabled ? 'habilitado' : 'deshabilitado');
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error en ecualizador:', error);
    }
  }

  async setEqualizerBand(bandIndex: number, level: number): Promise<void> {
    if (!this.player) return;

    try {
      await this.player.setBandLevel(bandIndex, level);
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error ajustando banda:', error);
    }
  }

  async applyEqualizerPreset(values: number[]): Promise<void> {
    if (!this.player) return;

    try {
      // Habilitar ecualizador si no lo está
      await this.player.enable(true);
      
      // Aplicar cada banda
      for (let i = 0; i < values.length; i++) {
        await this.player.setBandLevel(i, values[i]);
      }
      
      console.log('[AudioPlayerService] 🎛️ Preset aplicado:', values.map(v => `${v.toFixed(1)}dB`).join(', '));
    } catch (error) {
      console.error('[AudioPlayerService] ❌ Error aplicando preset:', error);
    }
  }

  // Private methods
  private startStatusUpdates(): void {
    this.stopStatusUpdates();

    // Actualizar cada 100ms
    this.statusUpdateInterval = setInterval(async () => {
      try {
        if (!this.player) return;

        const status = await this.player.getStatus();

        // Llamar callback si existe
        if (this.onStatusUpdate) {
          this.onStatusUpdate(status);
        }

        // Detectar fin de reproducción
        if (!status.isPlaying && status.positionMillis >= status.durationMillis - 100) {
          this.stopStatusUpdates();
          
          if (this.onPlaybackFinished) {
            this.onPlaybackFinished();
          }
        }
      } catch (error) {
        // Error silencioso, puede pasar si cambiamos de track rápido
      }
    }, 100);
  }

  private stopStatusUpdates(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  // Compatibilidad con API de expo-av
  get isLoaded(): boolean {
    return this.player !== null;
  }

  static async createAsync(): Promise<AudioPlayerService> {
    const service = new AudioPlayerService();
    await service.initialize();
    return service;
  }
}

export default AudioPlayerService;
