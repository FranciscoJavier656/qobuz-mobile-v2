/**
 * AudioTapBridge.ts
 * Puente TypeScript para conectar MTAudioTap con expo-av
 * 
 * Este módulo permite notificar al código nativo cuando hay un nuevo
 * AVPlayerItem disponible para que MTAudioTap pueda conectarse
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { AudioTapBridge } = NativeModules;

// Event emitter para escuchar eventos del tap
const audioTapEmitter = Platform.OS === 'ios' && AudioTapBridge 
  ? new NativeEventEmitter(AudioTapBridge)
  : null;

export interface AudioTapEvents {
  onAudioTapAttached: () => void;
  onAudioTapDetached: () => void;
  onFFTData: (data: { bands: number[] }) => void;
}

class AudioTapService {
  private isAttached = false;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    if (audioTapEmitter) {
      audioTapEmitter.addListener('onAudioTapAttached', () => {
        this.isAttached = true;
        console.log('[AudioTapService] ✅ Tap conectado al AVPlayer');
        this.emit('onAudioTapAttached');
      });

      audioTapEmitter.addListener('onAudioTapDetached', () => {
        this.isAttached = false;
        console.log('[AudioTapService] ⏹ Tap desconectado');
        this.emit('onAudioTapDetached');
      });
    }
  }

  /**
   * Notifica al módulo nativo que hay un nuevo Sound/PlayerItem listo
   * Llamar después de cargar un nuevo audio con expo-av
   */
  notifyPlayerReady(): void {
    if (Platform.OS !== 'ios' || !AudioTapBridge) {
      console.log('[AudioTapService] ⚠️ Solo disponible en iOS');
      return;
    }

    console.log('[AudioTapService] 🔔 Notificando nuevo PlayerItem...');
    AudioTapBridge.notifyPlayerItemReady({});
  }

  /**
   * Intenta conectar el tap al AVPlayer activo
   */
  attachToPlayer(): void {
    if (Platform.OS !== 'ios' || !AudioTapBridge) return;
    AudioTapBridge.attachToPlayer('default');
  }

  /**
   * Desconecta el tap
   */
  detach(): void {
    if (Platform.OS !== 'ios' || !AudioTapBridge) return;
    AudioTapBridge.detach();
    this.isAttached = false;
  }

  /**
   * Verifica si el tap está conectado
   */
  getIsAttached(): boolean {
    return this.isAttached;
  }

  /**
   * Suscribe a eventos
   */
  on(event: keyof AudioTapEvents, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Retorna función para desuscribirse
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

// Singleton
export const audioTapService = new AudioTapService();
export default audioTapService;
