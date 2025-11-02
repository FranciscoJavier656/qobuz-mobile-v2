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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import type { RootState } from '../store';
import type { Track } from '../services/qobuz/types';
import { usePlayerContext } from '../contexts/PlayerContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteParams {
  albumId: string;
  albumTitle: string;
  albumImage?: string;
  artistName?: string;
}

const AlbumDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { albumId, albumTitle, albumImage, artistName } = route.params as RouteParams;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));

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
    playNextTrack, // ✅ Usar función centralizada
  } = usePlayerContext();

  // Obtener albums de Library (con localTracks)
  const albums = useSelector((state: RootState) => state.library.albums);

  useEffect(() => {
    loadAlbumTracks();
  }, [albumId, albums]); // Re-cargar cuando albums cambien

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
        console.log('[AlbumDetailScreen] 🎵 currentIndex cambió desde FullPlayer, reproduciendo:', trackToPlay.title, `(${currentIndex + 1}/${queue.length})`);
        handlePlayTrack(trackToPlay.id.toString());
      }
    }
  }, [currentIndex, queue]); // Solo observar currentIndex y queue

  const loadAlbumTracks = async () => {
    setLoading(true);
    
    console.log('[AlbumDetailScreen] 🔍 Buscando álbum en Library:', { albumId, albumTitle });
    console.log('[AlbumDetailScreen] 📚 Albums disponibles:', albums.length);
    
    // Buscar el álbum en Library usando albumId o albumTitle
    const album = albums.find(a => 
      a.id.toString() === albumId || 
      a.title?.toLowerCase() === albumTitle?.toLowerCase()
    );
    
    if (album && album.localTracks && album.localTracks.length > 0) {
      console.log('[AlbumDetailScreen] ✅ Álbum encontrado con', album.localTracks.length, 'tracks locales');
      
      // Ordenar por track number
      const sortedTracks = [...album.localTracks].sort((a, b) => {
        return (a.track_number || 0) - (b.track_number || 0);
      });
      
      setTracks(sortedTracks);
    } else {
      console.log('[AlbumDetailScreen] ⚠️ Álbum no encontrado o sin tracks locales');
      setTracks([]);
    }
    
    setLoading(false);
  };

  const handlePlayTrack = async (trackId: string) => {
    const track = tracks.find(t => t.id.toString() === trackId);
    if (!track) return;

    // Si es la misma track, toggle play/pause
    if (currentTrack && currentTrack.id.toString() === trackId) {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
      }
      return;
    }

    // Detener sonido anterior si existe
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
      } catch (error) {
        // Ignorar errores al detener sonido (común si ya está interrumpido)
        console.log('[AlbumDetailScreen] Sound ya fue detenido o está en estado inválido');
      }
      setSound(null);
    }

    // Verificar que el track tenga localPath
    if (!track.localPath) {
      console.error('[AlbumDetailScreen] ⚠️ Track no tiene localPath:', track.title);
      return;
    }
    
    console.log('[AlbumDetailScreen] 🎵 Reproduciendo track local:', track.title, 'desde:', track.localPath);

    try {
      // Configurar audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

            // Crear y reproducir el sonido
      const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri: track.localPath },
        { shouldPlay: true }
      );

      // Configurar callback para actualizaciones de estado
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          
          // Si la canción terminó, reproducir la siguiente en la cola
          if (status.didJustFinish) {
            console.log('[AlbumDetailScreen] 🎵 Track terminó, reproduciendo siguiente...');
            setIsPlaying(false);
            playNextTrack();
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
            console.log('[AlbumDetailScreen] ✅ Estado actualizado a playing después de verificación');
          }
        } catch (e) {
          console.log('[AlbumDetailScreen] Error verificando estado:', e);
        }
      }, 200);

      console.log('[AlbumDetailScreen] ✅ Reproduciendo:', track.title);
    } catch (error) {
      console.error('[AlbumDetailScreen] Error reproduciendo:', error);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      console.log('[AlbumDetailScreen] 🎵 Reproduciendo todas las tracks del álbum:', tracks.length, 'tracks');
      setQueue(tracks);
      setCurrentIndex(0);
      handlePlayTrack(tracks[0].id.toString());
    }
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
    const isCurrentlyPlaying = currentTrack && currentTrack.id.toString() === item.id.toString() && isPlaying;

    return (
      <TouchableOpacity
        style={[styles.trackItem, isCurrentlyPlaying && styles.trackItemPlaying]}
        onPress={() => handlePlayTrack(item.id.toString())}
        activeOpacity={0.7}
      >
        <View style={styles.trackLeft}>
          <Text style={styles.trackNumber}>{item.track_number || index + 1}</Text>
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
                  handlePlayTrack(item.id.toString());
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
                  handlePlayTrack(item.id.toString());
                }}
                style={styles.playButton}
              >
                <MaterialIcons name="play-arrow" size={24} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </>
          )}
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#2a2a2a', '#1a1a1a', '#000']}
        style={styles.gradient}
      >
        {/* Header con imagen del álbum */}
        <Animated.View
          style={[
            styles.header,
            {
              height: headerHeight,
            },
          ]}
        >
          <Animated.Image
            source={{ uri: albumImage || 'https://via.placeholder.com/300' }}
            style={[
              styles.albumImage,
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

          <View style={styles.headerContent}>
            <Text style={styles.albumTitle}>{albumTitle}</Text>
            {artistName && (
              <Text style={styles.artistName}>{artistName}</Text>
            )}
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
              <Text style={styles.emptyText}>No hay canciones descargadas</Text>
              <Text style={styles.emptySubtext}>
                Descarga música de este álbum para verla aquí
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
  albumImage: {
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
  },
  albumTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
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

export default AlbumDetailScreen;
