import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EqualizerService from '../services/EqualizerService';

export interface Track {
  id: number;
  title: string;
  performer?: {
    name: string;
  };
  album?: {
    image?: {
      small?: string;
      thumbnail?: string;
      large?: string;
    };
  };
  duration?: number;
  localPath?: string;
  local_file_uri?: string;
  [key: string]: any;
}

interface PlayerContextType {
  fullPlayerVisible: boolean;
  setFullPlayerVisible: (visible: boolean) => void;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  sound: Audio.Sound | null;
  setSound: (sound: Audio.Sound | null) => void;
  miniPlayerVisible: boolean;
  setMiniPlayerVisible: (visible: boolean) => void;
  isLocalFile: boolean;
  setIsLocalFile: (isLocal: boolean) => void;
  queue: Track[];
  setQueue: (queue: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  playNextTrack: () => Promise<void>;
  setupSoundCallback: (sound: Audio.Sound) => void;
  isShuffleEnabled: boolean;
  setIsShuffleEnabled: (enabled: boolean) => void;
  repeatMode: 'off' | 'all' | 'one';
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Inicializar ecualizador al montar el componente
  useEffect(() => {
    const initEqualizer = async () => {
      try {
        const initialized = await EqualizerService.initialize();
        if (initialized) {
          // Cargar y aplicar configuración guardada
          const saved = await AsyncStorage.getItem('@eq_settings');
          if (saved) {
            const { values } = JSON.parse(saved);
            await EqualizerService.applyEqValues(values);
            console.log('[PlayerContext] ✅ Ecualizador inicializado con configuración guardada');
          } else {
            console.log('[PlayerContext] ✅ Ecualizador inicializado con valores por defecto');
          }
        }
      } catch (error) {
        console.log('[PlayerContext] ⚠️ Error inicializando ecualizador:', error);
      }
    };

    initEqualizer();
  }, []);

  const addToQueue = (tracks: Track[]) => {
    setQueue(prevQueue => [...prevQueue, ...tracks]);
  };

  const playNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Si repeat all está activado, volver al inicio
      setCurrentIndex(0);
    }
  };

  const playPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Si repeat all está activado, ir al final
      setCurrentIndex(queue.length - 1);
    }
  };

  // Función centralizada para reproducir el siguiente track automáticamente
  const playNextTrack = useCallback(async () => {
    console.log('[PlayerContext] 🎵 playNextTrack llamado');
    console.log('[PlayerContext] Current index:', currentIndex);
    console.log('[PlayerContext] Queue length:', queue.length);
    console.log('[PlayerContext] Repeat mode:', repeatMode);

    try {
      // Detener y limpiar sonido actual
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (error) {
          console.log('[PlayerContext] Sound ya estaba detenido');
        }
        setSound(null);
      }

      // Determinar siguiente índice
      let nextIndex = -1;
      
      if (repeatMode === 'one') {
        // Repetir la misma canción
        nextIndex = currentIndex;
        console.log('[PlayerContext] 🔂 Repeat one: reproduciendo misma canción');
      } else if (currentIndex < queue.length - 1) {
        // Hay más canciones en la cola
        nextIndex = currentIndex + 1;
        console.log('[PlayerContext] ▶️ Siguiente canción en cola');
      } else if (repeatMode === 'all' && queue.length > 0) {
        // Volver al inicio si repeat all está activado
        nextIndex = 0;
        console.log('[PlayerContext] 🔁 Repeat all: volviendo al inicio');
      } else {
        // Fin de la cola
        console.log('[PlayerContext] 🏁 Fin de la cola');
        setIsPlaying(false);
        return;
      }

      const nextTrack = queue[nextIndex];
      if (!nextTrack) {
        console.log('[PlayerContext] ❌ No se encontró siguiente track');
        setIsPlaying(false);
        return;
      }

      console.log('[PlayerContext] 🎵 Reproduciendo:', nextTrack.title);

      // Buscar localPath
      let localPath = nextTrack.localPath || nextTrack.local_file_uri;
      
      if (!localPath) {
        try {
          const libraryAlbumsJson = await AsyncStorage.getItem('@qobuz_library_albums');
          if (libraryAlbumsJson) {
            const albums = JSON.parse(libraryAlbumsJson);
            for (const album of albums) {
              if (album.localTracks) {
                const track = album.localTracks.find((t: Track) => t.id === nextTrack.id);
                if (track?.localPath) {
                  localPath = track.localPath;
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('[PlayerContext] Error buscando localPath:', error);
        }
      }

      if (!localPath) {
        console.log('[PlayerContext] ❌ No localPath, saltando');
        // Intentar siguiente canción
        setCurrentIndex(nextIndex);
        setTimeout(() => playNextTrack(), 100);
        return;
      }

      // Crear y reproducir
      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true }
      );

      // Configurar callback recursivo para el siguiente track
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          
          if (status.didJustFinish) {
            console.log('[PlayerContext] 🎵 Track terminó, reproduciendo siguiente...');
            setIsPlaying(false);
            playNextTrack();
          }
        }
      });

      setSound(newSound);
      setCurrentTrack(nextTrack);
      setCurrentIndex(nextIndex);

      if (initialStatus.isLoaded) {
        setIsPlaying(initialStatus.isPlaying);
      }

      // Verificar estado después de un momento
      setTimeout(async () => {
        try {
          const currentStatus = await newSound.getStatusAsync();
          if (currentStatus.isLoaded && currentStatus.isPlaying) {
            setIsPlaying(true);
          }
        } catch (e) {
          console.log('[PlayerContext] Error verificando estado:', e);
        }
      }, 200);

    } catch (error) {
      console.error('[PlayerContext] ❌ Error en playNextTrack:', error);
      setIsPlaying(false);
    }
  }, [sound, currentIndex, queue, repeatMode]);

  // Función para configurar el callback de autoplay en cualquier sonido
  const setupSoundCallback = useCallback((newSound: Audio.Sound) => {
    console.log('[PlayerContext] ⚙️ Configurando callback de autoplay');
    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        setIsPlaying(status.isPlaying);
        
        // Log detallado para debugging
        if (status.positionMillis && status.durationMillis) {
          const progress = (status.positionMillis / status.durationMillis) * 100;
          if (progress > 95) {
            console.log('[PlayerContext] 🔄 Cerca del final:', progress.toFixed(1) + '%');
          }
        }
        
        if (status.didJustFinish) {
          console.log('[PlayerContext] 🎵 Track terminó, reproduciendo siguiente...');
          setIsPlaying(false);
          playNextTrack();
        }
      }
    });
  }, [playNextTrack]);

  return (
    <PlayerContext.Provider value={{ 
      fullPlayerVisible, 
      setFullPlayerVisible,
      currentTrack,
      setCurrentTrack,
      isPlaying,
      setIsPlaying,
      sound,
      setSound,
      miniPlayerVisible,
      setMiniPlayerVisible,
      isLocalFile,
      setIsLocalFile,
      queue,
      setQueue,
      addToQueue,
      currentIndex,
      setCurrentIndex,
      playNext,
      playPrevious,
      playNextTrack,
      setupSoundCallback,
      isShuffleEnabled,
      setIsShuffleEnabled,
      repeatMode,
      setRepeatMode,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext debe usarse dentro de PlayerProvider');
  }
  return context;
};
