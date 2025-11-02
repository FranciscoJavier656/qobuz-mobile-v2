import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootState, AppDispatch } from '../store';
import type { Track } from '../services/qobuz/types';
import { usePlayerContext } from '../contexts/PlayerContext';
import { removeTrackFromPlaylist, deletePlaylist } from '../store/slices/librarySlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteParams {
  playlistId: string;
  playlistName: string;
}

const PlaylistDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { playlistId, playlistName } = route.params as RouteParams;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));
  const [isHandlingPlayback, setIsHandlingPlayback] = useState(false);

  // Usar PlayerContext para reproducción (incluyendo el sound compartido)
  const { 
    currentTrack, 
    isPlaying,
    sound,
    setCurrentTrack,
    setIsPlaying,
    setSound,
    setMiniPlayerVisible,
    setIsLocalFile,
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    repeatMode,
  } = usePlayerContext();

  // Obtener playlist desde Redux
  const playlist = useSelector((state: RootState) => 
    state.library.playlists.find(p => p.id === playlistId)
  );

  useEffect(() => {
    loadPlaylistTracks();
  }, [playlistId, playlist]);

  // Limpiar sound cuando el componente se desmonte
  useEffect(() => {
    return () => {
      // No limpiar el sound aquí porque es compartido en el contexto
      // El MiniPlayerWrapper se encarga de la limpieza cuando se cierra
    };
  }, []);

  // useEffect para detectar cambios en currentIndex (desde FullPlayer botones next/prev)
  useEffect(() => {
    // Solo ejecutar si hay una cola y el índice cambió externamente
    if (queue.length > 0 && currentIndex >= 0 && currentIndex < queue.length && tracks.length > 0) {
      const trackToPlay = queue[currentIndex];
      
      // Solo reproducir si el track cambió (para evitar loops)
      if (currentTrack?.id !== trackToPlay.id) {
        console.log('[PlaylistDetailScreen] 🎵 currentIndex cambió desde FullPlayer, reproduciendo:', trackToPlay.title, `(${currentIndex + 1}/${queue.length})`);
        handlePlayTrack(trackToPlay);
      }
    }
  }, [currentIndex, queue]); // Solo observar currentIndex y queue

  const loadPlaylistTracks = () => {
    setLoading(true);
    
    if (playlist) {
      console.log('[PlaylistDetailScreen] Cargando tracks de playlist:', playlistName);
      console.log('[PlaylistDetailScreen] Tracks encontradas:', playlist.tracks.length);
      setTracks(playlist.tracks);
    } else {
      console.warn('[PlaylistDetailScreen] Playlist no encontrada:', playlistId);
      setTracks([]);
    }
    
    setLoading(false);
  };

  // Función para reproducir la siguiente canción en la cola
  const playNextInQueue = async () => {
    console.log('[PlaylistDetailScreen] 🔄 Reproducir siguiente en cola');
    console.log('[PlaylistDetailScreen] 📊 Cola actual:', queue.length, 'tracks, índice:', currentIndex);
    console.log('[PlaylistDetailScreen] 🔁 Repeat mode:', repeatMode);
    
    // Si repeatMode es 'one', repetir la misma canción
    if (repeatMode === 'one' && currentTrack) {
      console.log('[PlaylistDetailScreen] 🔁 Repitiendo canción actual');
      // Reproducir la misma canción directamente sin llamar a handlePlayTrack
      const trackToPlay = currentTrack;
      
      // Detener sonido anterior si existe
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (error) {
          console.log('[PlaylistDetailScreen] Sound ya fue detenido');
        }
        setSound(null);
      }
      
      // Buscar localPath
      let localPath = trackToPlay.localPath || trackToPlay.local_file_uri;
      if (!localPath) {
        try {
          const downloadsJson = await AsyncStorage.getItem('downloads');
          if (downloadsJson) {
            const downloads = JSON.parse(downloadsJson);
            const download = downloads.find((d: any) => d.track.id === trackToPlay.id);
            if (download && download.localPath) {
              localPath = download.localPath;
            }
          }
        } catch (error) {
          console.error('[PlaylistDetailScreen] Error buscando localPath:', error);
        }
      }
      
      if (localPath) {
        // Crear y reproducir el sonido
        const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
          { uri: localPath },
          { shouldPlay: true }
        );
        
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              console.log('[PlaylistDetailScreen] 🎵 Track terminó, reproduciendo siguiente...');
              setIsPlaying(false);
              playNextInQueue();
            }
          }
        });
        
        setSound(newSound);
        
        if (initialStatus.isLoaded) {
          setIsPlaying(initialStatus.isPlaying);
        }
        
        setTimeout(async () => {
          try {
            const currentStatus = await newSound.getStatusAsync();
            if (currentStatus.isLoaded && currentStatus.isPlaying) {
              setIsPlaying(true);
            }
          } catch (e) {
            console.log('[PlaylistDetailScreen] Error verificando estado:', e);
          }
        }, 200);
      }
      return;
    }
    
    if (queue.length > 0 && currentIndex < queue.length - 1) {
      const nextIndex = currentIndex + 1;
      let nextTrack = queue[nextIndex];
      
      console.log('[PlaylistDetailScreen] ▶️ Siguiente track:', nextTrack.title);
      
      // Detener sonido anterior si existe
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (error) {
          console.log('[PlaylistDetailScreen] Sound ya fue detenido');
        }
        setSound(null);
      }
      
      // Buscar localPath
      let localPath = nextTrack.localPath || nextTrack.local_file_uri;
      if (!localPath) {
        try {
          const downloadsJson = await AsyncStorage.getItem('downloads');
          if (downloadsJson) {
            const downloads = JSON.parse(downloadsJson);
            const download = downloads.find((d: any) => d.track.id === nextTrack.id);
            if (download && download.localPath) {
              localPath = download.localPath;
              nextTrack = { ...nextTrack, localPath, local_file_uri: localPath };
            }
          }
        } catch (error) {
          console.error('[PlaylistDetailScreen] Error buscando localPath:', error);
        }
      }
      
      if (!localPath) {
        console.log('[PlaylistDetailScreen] ❌ No localPath encontrado, saltando al siguiente');
        setCurrentIndex(nextIndex + 1);
        await playNextInQueue();
        return;
      }
      
      setCurrentIndex(nextIndex);
      setCurrentTrack(nextTrack);
      
      // Crear y reproducir el sonido
      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            console.log('[PlaylistDetailScreen] 🎵 Track terminó, reproduciendo siguiente...');
            setIsPlaying(false);
            playNextInQueue();
          }
        }
      });
      
      setSound(newSound);
      
      if (initialStatus.isLoaded) {
        setIsPlaying(initialStatus.isPlaying);
      }
      
      setTimeout(async () => {
        try {
          const currentStatus = await newSound.getStatusAsync();
          if (currentStatus.isLoaded && currentStatus.isPlaying) {
            setIsPlaying(true);
          }
        } catch (e) {
          console.log('[PlaylistDetailScreen] Error verificando estado:', e);
        }
      }, 200);
      
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Si repeatMode es 'all', volver al inicio
      console.log('[PlaylistDetailScreen] 🔁 Repeat all: volviendo al inicio');
      
      let firstTrack = queue[0];
      
      // Detener sonido anterior si existe
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (error) {
          console.log('[PlaylistDetailScreen] Sound ya fue detenido');
        }
        setSound(null);
      }
      
      // Buscar localPath
      let localPath = firstTrack.localPath || firstTrack.local_file_uri;
      if (!localPath) {
        try {
          const downloadsJson = await AsyncStorage.getItem('downloads');
          if (downloadsJson) {
            const downloads = JSON.parse(downloadsJson);
            const download = downloads.find((d: any) => d.track.id === firstTrack.id);
            if (download && download.localPath) {
              localPath = download.localPath;
              firstTrack = { ...firstTrack, localPath, local_file_uri: localPath };
            }
          }
        } catch (error) {
          console.error('[PlaylistDetailScreen] Error buscando localPath:', error);
        }
      }
      
      if (!localPath) {
        console.log('[PlaylistDetailScreen] ❌ No localPath encontrado para primer track');
        setIsPlaying(false);
        return;
      }
      
      setCurrentIndex(0);
      setCurrentTrack(firstTrack);
      
      // Crear y reproducir el sonido
      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            console.log('[PlaylistDetailScreen] 🎵 Track terminó, reproduciendo siguiente...');
            setIsPlaying(false);
            playNextInQueue();
          }
        }
      });
      
      setSound(newSound);
      
      if (initialStatus.isLoaded) {
        setIsPlaying(initialStatus.isPlaying);
      }
      
      setTimeout(async () => {
        try {
          const currentStatus = await newSound.getStatusAsync();
          if (currentStatus.isLoaded && currentStatus.isPlaying) {
            setIsPlaying(true);
          }
        } catch (e) {
          console.log('[PlaylistDetailScreen] Error verificando estado:', e);
        }
      }, 200);
      
    } else {
      console.log('[PlaylistDetailScreen] 🏁 Final de la cola alcanzado');
      setIsPlaying(false);
    }
  };

  const handlePlayTrack = async (track: Track) => {
    // Prevenir llamadas concurrentes
    if (isHandlingPlayback) {
      console.log('[PlaylistDetailScreen] ⚠️ Ya hay una operación de playback en progreso, ignorando');
      return;
    }
    
    setIsHandlingPlayback(true);
    
    try {
      console.log('[PlaylistDetailScreen] 🎵 handlePlayTrack llamado para:', track.title);
      console.log('[PlaylistDetailScreen] 🔍 currentTrack:', currentTrack?.title);
      console.log('[PlaylistDetailScreen] 🔍 sound existe:', !!sound);
      console.log('[PlaylistDetailScreen] 🔍 isPlaying:', isPlaying);
      
      // Si no hay cola establecida o la track no está en la cola, crear cola desde esta track
      const trackIndex = tracks.findIndex(t => t.id === track.id);
      if (trackIndex !== -1 && (queue.length === 0 || queue[0]?.id !== tracks[0]?.id)) {
        console.log('[PlaylistDetailScreen] 📋 Estableciendo cola desde track', trackIndex + 1, 'de', tracks.length);
        setQueue(tracks.slice(trackIndex));
        setCurrentIndex(0);
      } else if (trackIndex !== -1) {
        // Actualizar el índice en la cola existente
        const queueIndex = queue.findIndex(t => t.id === track.id);
        if (queueIndex !== -1) {
          setCurrentIndex(queueIndex);
        }
      }
      
      // Solo hacer toggle si es la misma track Y hay un sound activo
      if (currentTrack && currentTrack.id === track.id && sound) {
        console.log('[PlaylistDetailScreen] ⏯️ Toggle play/pause para misma track CON sound');
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            if (isPlaying) {
              await sound.pauseAsync();
              setIsPlaying(false);
              console.log('[PlaylistDetailScreen] ⏸️ Pausado');
            } else {
              await sound.playAsync();
              setIsPlaying(true);
              console.log('[PlaylistDetailScreen] ▶️ Reproduciendo');
            }
            setIsHandlingPlayback(false);
            return;
          }
        } catch (error) {
          console.error('[PlaylistDetailScreen] ❌ Error en toggle:', error);
          // Si hay error, continuar con reproducción normal
        }
      }

      // Si llegamos aquí, necesitamos crear un nuevo sound
      console.log('[PlaylistDetailScreen] 🆕 Creando nuevo sound para reproducir');

      // Detener sonido anterior si existe
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
            console.log('[PlaylistDetailScreen] 🛑 Sonido anterior detenido');
          }
        } catch (error) {
          // Ignorar errores al detener sonido (común si ya está interrumpido)
          console.log('[PlaylistDetailScreen] Sound ya fue detenido o está en estado inválido');
        }
        setSound(null);
      }

      // Verificar si el track tiene localPath (es un archivo local)
      const trackWithLocal = track as any;
      let localPath = trackWithLocal.localPath || trackWithLocal.local_file_uri;
      
      console.log('[PlaylistDetailScreen] 🔍 Buscando localPath para track ID:', track.id);
      console.log('[PlaylistDetailScreen] 📍 LocalPath inicial:', localPath);

      // Si no tiene localPath, buscar en las descargas de AsyncStorage
      if (!localPath) {
        console.log('[PlaylistDetailScreen] 📦 Buscando en AsyncStorage...');
        try {
          const downloadsJson = await AsyncStorage.getItem('downloads');
          if (downloadsJson) {
            const downloads = JSON.parse(downloadsJson);
            console.log('[PlaylistDetailScreen] 📦 Downloads encontrados:', downloads.length);
            const download = downloads.find((d: any) => d.track.id === track.id);
            if (download && download.localPath) {
              localPath = download.localPath;
              console.log('[PlaylistDetailScreen] ✅ LocalPath encontrado:', localPath);
            } else {
              console.log('[PlaylistDetailScreen] ❌ Download no encontrado para track ID:', track.id);
            }
          } else {
            console.log('[PlaylistDetailScreen] ❌ No hay downloads en AsyncStorage');
          }
        } catch (error) {
          console.error('[PlaylistDetailScreen] Error buscando en downloads:', error);
        }
      }

      if (!localPath) {
        console.log('[PlaylistDetailScreen] ❌ No se encontró localPath, mostrando alert');
        setIsHandlingPlayback(false);
        Alert.alert(
          'Track no disponible',
          'Esta canción no está descargada localmente. Solo puedes reproducir canciones descargadas.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('[PlaylistDetailScreen] 🎵 Iniciando reproducción con localPath:', localPath);
      
      // Configurar audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Crear y reproducir el sonido
      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true }
      );

      // Configurar callback para actualizaciones de estado
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          
          // Si la canción terminó, reproducir la siguiente en la cola
          if (status.didJustFinish) {
            console.log('[PlaylistDetailScreen] 🎵 Track terminó, reproduciendo siguiente...');
            setIsPlaying(false);
            playNextInQueue();
          }
        }
      });

      setSound(newSound);
      setCurrentTrack(track);
      setMiniPlayerVisible(true);
      setIsLocalFile(true);
      
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
            console.log('[PlaylistDetailScreen] ✅ Estado actualizado a playing después de verificación');
          }
        } catch (e) {
          console.log('[PlaylistDetailScreen] Error verificando estado:', e);
        }
      }, 200);

      console.log('[PlaylistDetailScreen] ✅ Reproduciendo:', track.title);
    } catch (error) {
      console.error('[PlaylistDetailScreen] Error reproduciendo:', error);
      Alert.alert(
        'Error',
        'No se pudo reproducir la canción',
        [{ text: 'OK' }]
      );
    } finally {
      setIsHandlingPlayback(false);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      console.log('[PlaylistDetailScreen] 🎵 Reproduciendo toda la playlist:', tracks.length, 'tracks');
      // Establecer la cola completa de reproducción
      setQueue(tracks);
      setCurrentIndex(0);
      // Reproducir la primera track
      handlePlayTrack(tracks[0]);
    }
  };

  const handleRemoveTrack = (trackId: number) => {
    Alert.alert(
      'Eliminar canción',
      '¿Quieres eliminar esta canción de la playlist?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            dispatch(removeTrackFromPlaylist({ playlistId, trackId }));
            console.log('[PlaylistDetailScreen] ❌ Track eliminada de playlist');
          },
        },
      ]
    );
  };

  const handleDeletePlaylist = () => {
    Alert.alert(
      'Eliminar playlist',
      `¿Estás seguro de que quieres eliminar "${playlistName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            dispatch(deletePlaylist(playlistId));
            navigation.goBack();
            console.log('[PlaylistDetailScreen] 🗑️ Playlist eliminada');
          },
        },
      ]
    );
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animaciones del header
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [300, 100],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0, 200],
    outputRange: [1.5, 1, 0.8],
    extrapolate: 'clamp',
  });

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => {
    const isCurrentlyPlaying = currentTrack && currentTrack.id === item.id && isPlaying;

    return (
      <TouchableOpacity
        style={[styles.trackItem, isCurrentlyPlaying && styles.trackItemPlaying]}
        onPress={() => handlePlayTrack(item)}
        activeOpacity={0.7}
      >
        <View style={styles.trackLeft}>
          <Text style={styles.trackNumber}>{index + 1}</Text>
          <Image
            source={{ uri: item.album?.image?.thumbnail || item.album?.image?.small || 'https://via.placeholder.com/50' }}
            style={styles.trackImage}
          />
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.performer?.name || 'Unknown Artist'}
            </Text>
          </View>
        </View>
        <View style={styles.trackRight}>
          {isCurrentlyPlaying ? (
            <>
              <MaterialIcons name="equalizer" size={20} color="#1DB954" style={{ marginRight: 8 }} />
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handlePlayTrack(item);
                }}
                style={styles.playButton}
              >
                <MaterialIcons name="pause" size={24} color="#1DB954" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handlePlayTrack(item);
                }}
                style={styles.playButton}
              >
                <MaterialIcons name="play-arrow" size={24} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleRemoveTrack(item.id);
            }}
            style={styles.removeButton}
          >
            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#2a2a2a', '#1a1a1a', '#000']} style={styles.gradient}>
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#1DB954" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Obtener imagen del primer track si existe
  const playlistImage = tracks.length > 0 
    ? tracks[0].album?.image?.large || tracks[0].album?.image?.small
    : 'https://via.placeholder.com/300';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#2a2a2a', '#1a1a1a', '#000']}
        style={styles.gradient}
      >
        {/* Header con imagen de la playlist */}
        <Animated.View
          style={[
            styles.header,
            {
              height: headerHeight,
            },
          ]}
        >
          <Animated.Image
            source={{ uri: playlistImage }}
            style={[
              styles.playlistImage,
              {
                opacity: imageOpacity,
                transform: [{ scale: imageScale }],
              },
            ]}
            blurRadius={20}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
            style={styles.headerGradient}
          />
          
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <BlurView intensity={80} tint="dark" style={styles.backButtonBlur}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>

          {/* Delete button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePlaylist}
          >
            <BlurView intensity={80} tint="dark" style={styles.backButtonBlur}>
              <MaterialIcons name="delete" size={24} color="#ff4444" />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <MaterialIcons name="queue-music" size={32} color="#1DB954" style={{ marginBottom: 8 }} />
            <Text style={styles.playlistName}>{playlistName}</Text>
            <Text style={styles.trackCount}>
              {tracks.length} {tracks.length === 1 ? 'canción' : 'canciones'}
            </Text>
          </View>
        </Animated.View>

        {/* Botón de reproducir todo */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.playAllButton}
            onPress={handlePlayAll}
            disabled={tracks.length === 0}
          >
            <LinearGradient
              colors={tracks.length > 0 ? ['#1ed760', '#1DB954'] : ['#333', '#222']}
              style={styles.playAllGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons name="play-arrow" size={28} color="#fff" />
              <Text style={styles.playAllText}>Reproducir todo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shuffleButton}>
            <MaterialIcons name="shuffle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Lista de tracks */}
        <Animated.FlatList
          data={tracks}
          renderItem={renderTrackItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.trackList}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="music-off" size={64} color="#333" />
              <Text style={styles.emptyText}>Playlist vacía</Text>
              <Text style={styles.emptySubtext}>
                Añade canciones a esta playlist desde el reproductor
              </Text>
            </View>
          }
        />
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
  },
  playlistImage: {
    width: SCREEN_WIDTH,
    height: '100%',
    resizeMode: 'cover',
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  deleteButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  trackCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  playAllButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  playAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  playAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shuffleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackList: {
    paddingBottom: 160,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  trackItemPlaying: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  trackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trackNumber: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    width: 30,
    textAlign: 'center',
  },
  trackImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginLeft: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  trackRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  playButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PlaylistDetailScreen;
