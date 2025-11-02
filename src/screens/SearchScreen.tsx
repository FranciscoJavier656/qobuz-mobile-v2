import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useSelector, useDispatch } from 'react-redux';
// expo-av está deprecado pero se mantiene temporalmente hasta migración completa
// TODO: Migrar a expo-audio
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/MaterialIcons';

// Store
import store from '../store';

// Context
import { usePlayerContext } from '../contexts/PlayerContext';

import { RootState } from '../store';
import { addDownload } from '../store/slices/downloadSlice';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';
import type { Track } from '../services/qobuz/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

const qobuzAPI = new QobuzAPI();

// Props interface para TrackItem
interface TrackItemProps {
  item: Track;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onDownload: () => void;
  onOpenPlayer: () => void;
}

// Componente de tarjeta en cuadrícula ultra-moderna
const TrackItem: React.FC<TrackItemProps> = React.memo(({ 
  item, 
  index, 
  isPlaying, 
  onPlay,
  onDownload,
  onOpenPlayer
}) => {
  const itemAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Animaciones individuales para cada barra del waveform
  const waveBar1 = useRef(new Animated.Value(1)).current;
  const waveBar2 = useRef(new Animated.Value(1)).current;
  const waveBar3 = useRef(new Animated.Value(1)).current;
  const waveBar4 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación de entrada staggered
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, [index]);

  useEffect(() => {
    if (isPlaying) {
      // SOLO ANIMAR LA TARJETA QUE SE ESTÁ REPRODUCIENDO
      // Animación de glow pulsante - MÁS LENTA para mejor rendimiento
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000, // Aumentado de 1000ms a 2000ms
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Animación SIMPLIFICADA de las barras - solo 2 barras en lugar de 4
      const animateBar = (bar: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: 0.4, // Menos extremo: 0.4 en lugar de 0.3
              duration: 500 + delay, // Más lento: 500 en lugar de 300
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: 1,
              duration: 500 + delay,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      // SOLO animar 2 barras en lugar de 4 para reducir carga
      animateBar(waveBar1, 0);
      animateBar(waveBar3, 100);
      // Mantener barras 2 y 4 estáticas
      waveBar2.setValue(0.7);
      waveBar4.setValue(0.9);
    } else {
      glowAnim.setValue(0);
      waveBar1.setValue(1);
      waveBar2.setValue(1);
      waveBar3.setValue(1);
      waveBar4.setValue(1);
    }
  }, [isPlaying]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Animated.View
      style={[
        styles.gridCard,
        {
          opacity: itemAnim,
          transform: [
            { scale: scaleAnim },
            {
              translateY: itemAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPlay}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <BlurView intensity={isPlaying ? 60 : 30} tint="dark" style={styles.cardBlur}>
          {/* Fondo con gradiente */}
          <LinearGradient
            colors={
              isPlaying 
                ? ['rgba(29, 185, 84, 0.4)', 'rgba(29, 185, 84, 0.1)', 'rgba(0, 0, 0, 0.8)']
                : ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.8)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Glow effect para reproducción */}
          {isPlaying && (
            <Animated.View style={[styles.glowOverlay, { opacity: glowOpacity }]}>
              <LinearGradient
                colors={['rgba(29, 185, 84, 0.6)', 'transparent', 'rgba(29, 185, 84, 0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          )}

          {/* Contenedor de la portada del álbum */}
          <View style={styles.albumArtContainer}>
            <Image
              source={{
                uri: item.album?.image?.large || item.album?.image?.small || 'https://via.placeholder.com/300',
              }}
              style={styles.albumArt}
            />
            
            {/* Overlay con gradiente en la imagen */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
              style={styles.albumOverlay}
            />

            {/* Badge de calidad Hi-Res */}
            <View style={styles.qualityBadgeCard}>
              <BlurView intensity={80} tint="dark" style={styles.badgeBlur}>
                <LinearGradient
                  colors={['rgba(29, 185, 84, 0.9)', 'rgba(23, 147, 67, 0.9)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badgeGradient}
                >
                  <Icon name="high-quality" size={10} color="#fff" />
                  <Text style={styles.badgeText}>Hi-Res</Text>
                </LinearGradient>
              </BlurView>
            </View>

            {/* Indicador de reproducción */}
            {isPlaying && (
              <View style={styles.playingOverlay}>
                <BlurView intensity={90} tint="dark" style={styles.playingBlur}>
                  <View style={styles.waveformContainer}>
                    <Animated.View 
                      style={[
                        styles.waveBar, 
                        styles.bar1,
                        { transform: [{ scaleY: waveBar1 }] }
                      ]} 
                    />
                    <Animated.View 
                      style={[
                        styles.waveBar, 
                        styles.bar2,
                        { transform: [{ scaleY: waveBar2 }] }
                      ]} 
                    />
                    <Animated.View 
                      style={[
                        styles.waveBar, 
                        styles.bar3,
                        { transform: [{ scaleY: waveBar3 }] }
                      ]} 
                    />
                    <Animated.View 
                      style={[
                        styles.waveBar, 
                        styles.bar4,
                        { transform: [{ scaleY: waveBar4 }] }
                      ]} 
                    />
                  </View>
                  <Text style={styles.playingText}>REPRODUCIENDO</Text>
                </BlurView>
              </View>
            )}

            {/* Botón de play/pause flotante */}
            <View style={styles.playButtonOverlay}>
              <TouchableOpacity 
                style={styles.floatingPlayButton}
                onPress={onPlay}
                activeOpacity={0.8}
              >
                <BlurView intensity={100} tint="light" style={styles.playButtonBlur}>
                  <LinearGradient
                    colors={isPlaying ? ['#1DB954', '#1ed760'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={styles.playButtonGradient}
                  >
                    <Icon
                      name={isPlaying ? 'pause' : 'play-arrow'}
                      size={32}
                      color={isPlaying ? '#000' : '#000'}
                    />
                  </LinearGradient>
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>

          {/* Información de la canción */}
          <View style={styles.cardInfo}>
            <TouchableOpacity onPress={onOpenPlayer} activeOpacity={0.7}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
            <Text style={styles.cardArtist} numberOfLines={1}>
              {item.performer?.name || 'Unknown Artist'}
            </Text>
            
            {/* Duración y botón de descarga */}
            <View style={styles.cardFooter}>
              {item.duration && (
                <View style={styles.durationContainer}>
                  <Icon name="schedule" size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.durationText}>
                    {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                  </Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.downloadIconButton}
                onPress={onDownload}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <BlurView intensity={30} tint="dark" style={styles.downloadIconBlur}>
                  <Icon name="download" size={18} color="rgba(255,255,255,0.6)" />
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SearchScreen = () => {
  const dispatch = useDispatch();
  const playerContext = usePlayerContext();
  const authState = useSelector((state: RootState) => state.auth);
  const downloadSettings = useSelector((state: RootState) => state.download.settings);
  const isAuthenticated = authState?.isAuthenticated || false;
  const authToken = authState?.token || null;
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Usar el PlayerContext para el estado compartido
  const sound = playerContext.sound;
  const setSound = playerContext.setSound;
  const currentTrack = playerContext.currentTrack;
  const setCurrentTrack = playerContext.setCurrentTrack;
  const isPlaying = playerContext.isPlaying;
  const setIsPlaying = playerContext.setIsPlaying;
  const miniPlayerVisible = playerContext.miniPlayerVisible;
  const setMiniPlayerVisible = playerContext.setMiniPlayerVisible;
  const fullPlayerVisible = playerContext.fullPlayerVisible;
  const setFullPlayerVisible = playerContext.setFullPlayerVisible;
  
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [isFullTrack, setIsFullTrack] = useState(false);
  const [playQueue, setPlayQueue] = useState<Track[]>([]);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const miniProgressBarWidth = useRef(0);
  const lastPositionUpdate = useRef(0);
  const animationFrameId = useRef<number | null>(null);
  
  // Actualizar progreso de reproducción usando el callback nativo
  useEffect(() => {
    if (!sound) return;

    const onPlaybackStatusUpdate = (status: any) => {
      if (status.isLoaded && !isSeeking) {
        const currentPosition = status.positionMillis || 0;
        const currentDuration = status.durationMillis || 0;
        
        // Throttle: solo actualizar estado cada 1000ms para reducir re-renders
        const now = Date.now();
        if (now - lastPositionUpdate.current < 1000) {
          return;
        }
        
        lastPositionUpdate.current = now;
        
        // Usar requestAnimationFrame para suavizar las actualizaciones
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
        
        animationFrameId.current = requestAnimationFrame(() => {
          setPosition(currentPosition);
          setDuration(currentDuration);
        });
      }
    };

    // Establecer el callback nativo en lugar de setInterval
    sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

    return () => {
      sound.setOnPlaybackStatusUpdate(null);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [sound, isSeeking]);

  // Establecer token de autenticación
  useEffect(() => {
    if (authToken && typeof authToken === 'string') {
      qobuzAPI.setAuthToken(authToken);
    }
  }, [authToken]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
    });

    // Fade in animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    return () => {
      if (sound) {
        sound.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            sound.unloadAsync().catch(() => {
              // Ignorar errores al desmontar
            });
          }
        }).catch(() => {
          // Ignorar si el sonido ya está descargado
        });
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [sound]);

  const handleSearch = useCallback(async () => {
    console.log('[SearchScreen] handleSearch called', { query, isAuthenticated, authToken: !!authToken });
    
    if (!query.trim() || !isAuthenticated) {
      console.log('[SearchScreen] Búsqueda cancelada:', { 
        queryEmpty: !query.trim(), 
        notAuthenticated: !isAuthenticated 
      });
      return;
    }

    // Animate search bar
    Animated.sequence([
      Animated.timing(searchBarScale, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    try {
      console.log('[SearchScreen] Buscando:', query);
      const searchResults = await qobuzAPI.searchTracks(query, 50);
      console.log('[SearchScreen] Resultados obtenidos:', searchResults?.length || 0);
      setResults(searchResults || []);
    } catch (error) {
      console.error('[SearchScreen] Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, isAuthenticated, authToken]);

  const handlePlay = async (track: Track) => {
    try {
      console.log('[SearchScreen] handlePlay called for track:', track.id, track.title);
      
      // Si es el mismo track que ya está en el mini player, solo alternar play/pause
      if (currentTrack?.id === track.id && miniPlayerVisible) {
        console.log('[SearchScreen] Same track in mini player, toggling play/pause');
        await handleMiniPlayerPlayPause();
        return;
      }

      // Si hay otro track reproduciéndose sin mini player (preview), detenerlo
      if (sound && !miniPlayerVisible) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (e) {
          console.log('[SearchScreen] Sound already unloaded');
        }
        setSound(null);
      }

      // Establecer el track que está reproduciéndose
      setPlayingTrackId(track.id);

      // Usar el mismo método que handleOpenMiniPlayer - reproducir canción completa
      console.log('[SearchScreen] Opening mini player and playing full track');
      await handleOpenMiniPlayer(track);

    } catch (error) {
      console.error('Error playing track:', error);
      setPlayingTrackId(null);
      setIsPlaying(false);
      Alert.alert('Error', 'No se pudo reproducir la canción');
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    
    Animated.sequence([
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastVisible(false);
    });
  };

  const handleDownload = (track: Track) => {
    // Leer la calidad DIRECTAMENTE del store en el momento de la descarga
    const currentQuality = store.getState().download.settings.defaultQuality;
    console.log('[SearchScreen] 🎵 Adding download with quality:', currentQuality);
    console.log('[SearchScreen] 📊 Store state check:', store.getState().download.settings);
    
    dispatch(addDownload({
      track,
      quality: currentQuality, // Usar calidad actual del store
    }));
    showToast(`✓ ${track.title} añadido a descargas`);
  };

  // Función para reproducir track COMPLETO (sin límite de 30 segundos)
  const playFullTrack = async (track: Track) => {
    try {
      console.log('[SearchScreen] Playing FULL TRACK:', track.id, track.title);
      
      // Limpiar timeout de preview si existe
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }

      // Si hay un sonido anterior, detenerlo
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (e) {
          console.log('[SearchScreen] Sound already unloaded');
        }
        setSound(null);
      }

      setPlayingTrackId(track.id);
      setIsFullTrack(true);

      // Obtener la URL completa con firma MD5
      let fullTrackUrl: string | null = null;
      
      try {
        console.log('[SearchScreen] Getting full track URL with signature...');
        fullTrackUrl = await qobuzAPI.getTrackFileUrl(track.id, 27, 'stream');
        console.log('[SearchScreen] Full track URL obtained');
      } catch (error) {
        console.error('[SearchScreen] Error getting full track URL:', error);
        Alert.alert('Error', 'No se pudo obtener la URL de la canción completa');
        setIsPlaying(false);
        return;
      }

      if (!fullTrackUrl) {
        Alert.alert('Error', 'No se pudo obtener la URL de streaming');
        setIsPlaying(false);
        return;
      }

      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: fullTrackUrl },
        { shouldPlay: true }
      );
      
      // Configurar callback para actualizaciones de estado
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setPlayingTrackId(null);
            setIsPlaying(false);
            setSound(null);
          } else {
            setIsPlaying(status.isPlaying);
          }
        }
      });

      setSound(newSound);
      
      // Establecer isPlaying basado en el estado inicial real del sound
      if (initialStatus.isLoaded) {
        setIsPlaying(initialStatus.isPlaying);
      }
      
      // Verificar el estado después de un breve momento para asegurar sincronización
      setTimeout(async () => {
        try {
          const currentStatus = await newSound.getStatusAsync();
          if (currentStatus.isLoaded && currentStatus.isPlaying) {
            setIsPlaying(true);
            console.log('[SearchScreen] ✅ Estado actualizado a playing después de verificación');
          }
        } catch (e) {
          console.log('[SearchScreen] Error verificando estado:', e);
        }
      }, 200);

    } catch (error) {
      console.error('Error playing full track:', error);
      setPlayingTrackId(null);
      setIsPlaying(false);
      Alert.alert('Error', 'No se pudo reproducir la canción');
    }
  };

  // Toggle play/pause en el mini player
  const handleMiniPlayerPlayPause = async () => {
    if (!currentTrack || !sound) return;

    try {
      const status = await sound.getStatusAsync();
      
      if (status.isLoaded) {
        if (status.isPlaying) {
          // Pausar
          console.log('[SearchScreen] Pausing track');
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          // Reanudar
          console.log('[SearchScreen] Resuming track');
          await sound.playAsync();
          setIsPlaying(true);
        }
        console.log('[SearchScreen] isPlaying updated to:', !status.isPlaying);
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  // Abrir mini player y reproducir track completo
  const handleOpenMiniPlayer = async (track: Track) => {
    console.log('[SearchScreen] ==> handleOpenMiniPlayer INICIO - track:', track.title);
    console.log('[SearchScreen] Estado ANTES:', { 
      miniPlayerVisible, 
      currentTrack: currentTrack?.id, 
      isFullTrack,
      fullPlayerVisible,
      soundExists: !!sound
    });
    
    // Si es el mismo track que ya está sonando en el mini player Y el sonido existe, solo mostrar el mini player
    if (currentTrack?.id === track.id && isFullTrack && sound) {
      console.log('[SearchScreen] Mismo track con sonido existente, solo mostrar mini player');
      setMiniPlayerVisible(true);
      return;
    }

    // Establecer el track actual y estados PRIMERO
    console.log('[SearchScreen] Nuevo track o sonido inexistente, reiniciando reproducción...');
    setCurrentTrack(track);
    setMiniPlayerVisible(true);
    setFullPlayerVisible(false); // Asegurar que full player está cerrado
    
    console.log('[SearchScreen] Estados establecidos');

    // Reproducir track completo
    console.log('[SearchScreen] Iniciando reproducción...');
    await playFullTrack(track);
    
    console.log('[SearchScreen] ==> handleOpenMiniPlayer FIN');
  };

  // Cerrar mini player y detener reproducción
  // Cerrar mini player y detener reproducción
  const handleCloseMiniPlayer = async () => {
    // Limpiar timeout si existe
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    // Detener y limpiar sonido
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
      } catch (e) {
        console.log('[SearchScreen] Sound already unloaded');
      }
      setSound(null);
    }

    // Ocultar mini player y limpiar estado
    setMiniPlayerVisible(false);
    setCurrentTrack(null);
    setPlayingTrackId(null);
    setIsPlaying(false);
    setIsFullTrack(false);
  };

  // Manejar seek en la barra de progreso del mini player
  const handleSeek = async (progressValue: number) => {
    if (sound && duration > 0) {
      try {
        const seekPosition = progressValue * duration;
        await sound.setPositionAsync(seekPosition);
        setPosition(seekPosition);
      } catch (error) {
        console.error('[SearchScreen] Error seeking:', error);
      }
    }
  };

  // Adelantar 10 segundos
  const handleForward = async () => {
    if (sound && duration > 0) {
      try {
        const newPosition = Math.min(position + 10000, duration); // +10 segundos
        await sound.setPositionAsync(newPosition);
        setPosition(newPosition);
      } catch (error) {
        console.error('[SearchScreen] Error forwarding:', error);
      }
    }
  };

  // Atrasar 10 segundos
  const handleRewind = async () => {
    if (sound) {
      try {
        const newPosition = Math.max(position - 10000, 0); // -10 segundos
        await sound.setPositionAsync(newPosition);
        setPosition(newPosition);
      } catch (error) {
        console.error('[SearchScreen] Error rewinding:', error);
      }
    }
  };

  // Formatear tiempo en mm:ss
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Abrir reproductor completo desde el mini player
  const handleOpenFullPlayer = () => {
    setFullPlayerVisible(true);
    // Mantener el mini player activo pero no visible cuando el full player está abierto
  };

  // Cerrar reproductor completo (volver al mini player)
  const handleCloseFullPlayer = () => {
    // Mostrar el mini player de nuevo si hay una canción reproduciéndose
    if (currentTrack && isFullTrack) {
      setMiniPlayerVisible(true);
      setFullPlayerVisible(false);
    } else {
      setFullPlayerVisible(false);
    }
  };

  // Cerrar reproductor completo completamente (detener todo)
  const handleCloseFullPlayerCompletely = async () => {
    setFullPlayerVisible(false);
    // Ejecutar la lógica de cierre del mini player para limpiar todo
    await handleCloseMiniPlayer();
  };

  const renderTrackItem = useCallback(({ item, index }: { item: Track; index: number }) => {
    // La tarjeta está "playing" solo si es el track actual Y el audio está realmente reproduciéndose
    const isTrackPlaying = currentTrack?.id === item.id && isPlaying;
    return (
      <TrackItem
        item={item}
        index={index}
        isPlaying={isTrackPlaying}
        onPlay={() => handlePlay(item)}
        onDownload={() => handleDownload(item)}
        onOpenPlayer={() => handleOpenMiniPlayer(item)}
      />
    );
  }, [currentTrack, isPlaying, handlePlay, handleDownload, handleOpenMiniPlayer]); // Agregar funciones a las dependencias

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.loadingContainer}>
            <LinearGradient
              colors={['rgba(29, 185, 84, 0.2)', 'rgba(29, 185, 84, 0.05)']}
              style={styles.loadingGradient}
            >
              <Icon name="search" size={64} color="rgba(29, 185, 84, 0.5)" />
              <Text style={styles.emptyText}>Buscando música...</Text>
            </LinearGradient>
          </View>
        </View>
      );
    }

    if (!query) {
      return (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']}
            style={styles.emptyContainer}
          >
            <Icon name="music-note" size={80} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>Descubre música Hi-Res</Text>
            <Text style={styles.emptySubtitle}>
              Busca tus artistas, álbumes y canciones favoritas
            </Text>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']}
          style={styles.emptyContainer}
        >
          <Icon name="search-off" size={80} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No se encontraron resultados</Text>
          <Text style={styles.emptySubtitle}>
            Intenta con otros términos de búsqueda
          </Text>
        </LinearGradient>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        {/* Animated Background Gradient */}
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a', '#0f0f0f']}
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
        />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header with Glassmorphism */}
          <BlurView intensity={80} tint="dark" style={styles.header}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <Text style={styles.headerTitle}>Buscar</Text>
              <Animated.View style={[styles.searchContainer, { transform: [{ scale: searchBarScale }] }]}>
                <BlurView intensity={40} tint="dark" style={styles.searchBar}>
                  <Icon name="search" size={24} color="rgba(255,255,255,0.6)" />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Artistas, canciones, álbumes..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <Icon name="close" size={20} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                  )}
                </BlurView>
              </Animated.View>
            </LinearGradient>
          </BlurView>

          {/* Results Grid */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTrackItem}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            // OPTIMIZACIONES CRÍTICAS DE RENDIMIENTO
            removeClippedSubviews={true} // Desmontar items fuera de la pantalla
            maxToRenderPerBatch={6} // Renderizar máximo 6 items por lote (3 filas)
            updateCellsBatchingPeriod={50} // Actualizar cada 50ms en lugar de cada frame
            initialNumToRender={8} // Renderizar solo 8 items inicialmente (4 filas)
            windowSize={5} // Mantener solo 5 pantallas de items en memoria
            getItemLayout={(data, index) => ({
              length: CARD_WIDTH + 180,
              offset: (CARD_WIDTH + 180) * Math.floor(index / NUM_COLUMNS),
              index,
            })}
          />
        </Animated.View>
      </SafeAreaView>

      {/* Mini Player y Full Player ahora se manejan globalmente en App.tsx */}
    </View>

    {/* Toast de descarga */}
    {toastVisible && (
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity: toastAnim,
            transform: [{
              translateY: toastAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={styles.toastBlur}>
          <LinearGradient
            colors={['rgba(29, 185, 84, 0.9)', 'rgba(29, 185, 84, 0.7)']}
            style={styles.toastGradient}
          >
            <Icon name="download" size={20} color="#fff" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
    letterSpacing: -1,
  },
  searchContainer: {
    marginBottom: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  
  // Grid Layout Styles
  gridContent: {
    padding: CARD_MARGIN,
    paddingTop: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridCard: {
    width: CARD_WIDTH,
    marginBottom: CARD_MARGIN,
  },
  cardBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  
  // Album Art Container
  albumArtContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    marginBottom: 12,
  },
  albumArt: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  albumOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  
  // Quality Badge
  qualityBadgeCard: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeBlur: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  
  // Playing Overlay
  playingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  playingBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: 6,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  bar1: {
    height: 16,
  },
  bar2: {
    height: 12,
  },
  bar3: {
    height: 18,
  },
  bar4: {
    height: 14,
  },
  playingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1DB954',
    letterSpacing: 1,
  },
  
  // Floating Play Button
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  playButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    overflow: 'hidden',
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Card Info
  cardInfo: {
    padding: 12,
    paddingTop: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  downloadIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  downloadIconBlur: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
  },
  loadingGradient: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(29, 185, 84, 0.8)',
  },
  
  // Mini Player Styles - Apple Music Style
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    zIndex: 10000, // MUY ALTO para prueba
    elevation: 20, // Para Android
    backgroundColor: 'red', // COLOR DE PRUEBA - TEMPORAL
  },
  miniPlayerBlur: {
    flex: 1,
    overflow: 'hidden',
  },
  miniPlayerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  miniPlayerAlbum: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  miniPlayerInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  miniPlayerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  miniPlayerArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
  miniPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniPlayerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toastBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  toastGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  toastText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SearchScreen;
