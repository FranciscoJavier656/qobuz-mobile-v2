import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import type { RootState, AppDispatch } from '../store';
import { removeFromFavorites, correctFavoriteSource } from '../store/slices/favoritesSlice';
import { loadLibrary, processExistingDownloads } from '../store/slices/librarySlice';
import type { Track, Album, Artist } from '../services/qobuz/types';
import { usePlayerContext } from '../contexts/PlayerContext';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

const Icon = MaterialIcons;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type LibraryTab = 'favorites' | 'albums' | 'artists' | 'playlists' | 'downloads';

interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  type: 'track' | 'album' | 'artist' | 'playlist';
  count?: number;
  isSection?: boolean; // Para identificar headers de sección
  sectionTitle?: string; // Título de la sección
}

// Funciones de conversión fuera del componente para evitar recreación
const convertTracksToItems = (tracks: Track[]): LibraryItem[] => {
  return tracks.map(track => ({
    id: track.id.toString(),
    title: track.title,
    subtitle: `${track.performer?.name || 'Unknown Artist'}`,
    image: track.album?.image?.large || track.album?.image?.small || 'https://via.placeholder.com/300',
    type: 'track' as const,
  }));
};

const convertAlbumsToItems = (albumsList: Album[]): LibraryItem[] => {
  return albumsList.map(album => ({
    id: album.id.toString(),
    title: album.title,
    subtitle: `${album.artist?.name || 'Unknown Artist'}${album.release_date_original ? ' • ' + new Date(album.release_date_original).getFullYear() : ''}`,
    image: album.image?.large || album.image?.small || 'https://via.placeholder.com/300',
    type: 'album' as const,
    count: album.tracks_count,
  }));
};

const convertArtistsToItems = (artistsList: Artist[]): LibraryItem[] => {
  return artistsList.map(artist => ({
    id: artist.id.toString(),
    title: artist.name,
    subtitle: `${artist.albums_count || 0} álbumes`,
    image: artist.picture || 'https://via.placeholder.com/300',
    type: 'artist' as const,
  }));
};

const convertPlaylistsToItems = (playlistsList: any[]): LibraryItem[] => {
  return playlistsList.map(playlist => ({
    id: playlist.id,
    title: playlist.name,
    subtitle: `${playlist.tracks.length} canciones`,
    image: playlist.tracks[0]?.album?.image?.large || 'https://via.placeholder.com/300',
    type: 'playlist' as const,
    count: playlist.tracks.length,
  }));
};

const convertDownloadsToItems = (downloadsList: any[]): LibraryItem[] => {
  return downloadsList.map(download => ({
    id: download.track.id.toString(),
    title: download.track.title,
    subtitle: `${download.track.performer?.name || 'Unknown Artist'} • ${(download.size / 1024 / 1024).toFixed(1)} MB`,
    image: download.track.album?.image?.large || download.track.album?.image?.small || 'https://via.placeholder.com/300',
    type: 'track' as const,
  }));
};

// Selectores memoizados para evitar re-renders innecesarios
const selectFavorites = (state: RootState) => state.favorites?.tracks ?? [];
const selectAlbums = (state: RootState) => state.library?.albums ?? [];
const selectArtists = (state: RootState) => state.library?.artists ?? [];
const selectPlaylists = (state: RootState) => state.library?.playlists ?? [];
const selectDownloads = (state: RootState) => state.download?.downloads ?? [];
const selectRecentlyPlayed = (state: RootState) => state.library?.recentlyPlayed ?? [];

// Selectores memoizados con transformación
const selectFavoriteItems = createSelector(
  [selectFavorites],
  (favorites) => {
    const items: LibraryItem[] = [];
    
    // Separar por source
    const localTracks = favorites.filter(f => f.favoriteSource === 'local');
    const streamingTracks = favorites.filter(f => f.favoriteSource === 'streaming');
    
    // Agregar sección de Locales si hay tracks
    if (localTracks.length > 0) {
      items.push({
        id: 'section-local',
        title: '📁 Locales',
        subtitle: `${localTracks.length} canción${localTracks.length > 1 ? 'es' : ''}`,
        image: '',
        type: 'track',
        isSection: true,
        sectionTitle: 'Locales',
      });
      items.push(...convertTracksToItems(localTracks));
    }
    
    // Agregar sección de Streaming si hay tracks
    if (streamingTracks.length > 0) {
      items.push({
        id: 'section-streaming',
        title: '🎵 Streaming (Qobuz)',
        subtitle: `${streamingTracks.length} canción${streamingTracks.length > 1 ? 'es' : ''}`,
        image: '',
        type: 'track',
        isSection: true,
        sectionTitle: 'Streaming',
      });
      items.push(...convertTracksToItems(streamingTracks));
    }
    
    return items;
  }
);

const selectAlbumItems = createSelector(
  [selectAlbums],
  (albums) => convertAlbumsToItems(albums)
);

const selectArtistItems = createSelector(
  [selectArtists],
  (artists) => convertArtistsToItems(artists)
);

const selectPlaylistItems = createSelector(
  [selectPlaylists],
  (playlists) => convertPlaylistsToItems(playlists)
);

const selectDownloadItems = createSelector(
  [selectDownloads],
  (downloads) => convertDownloadsToItems(downloads)
);

// Componente separado para cada item (para poder usar hooks)
const LibraryItemCard: React.FC<{
  item: LibraryItem;
  index: number;
  onRemove?: (id: string) => void;
  onPlay?: (id: string) => void;
  isPlaying?: boolean;
}> = React.memo(({ item, index, onRemove, onPlay, isPlaying }) => {
  const itemAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const translateY = itemAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  // Si es una sección, renderizar header
  if (item.isSection) {
    return (
      <Animated.View
        style={[
          styles.sectionHeader,
          {
            opacity: itemAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(29, 185, 84, 0.2)', 'rgba(29, 185, 84, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionGradient}
        >
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <Text style={styles.sectionSubtitle}>{item.subtitle}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  // Renderizar item normal
  return (
    <Animated.View
      style={[
        styles.itemContainer,
        {
          opacity: itemAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => console.log('Item pressed:', item.id)}
      >
        <BlurView intensity={20} tint="dark" style={styles.itemBlur}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.itemGradient}
          >
            {/* Imagen del item */}
            <View style={styles.itemImageContainer}>
              <Image
                source={{ uri: item.image }}
                style={[
                  styles.itemImage,
                  item.type === 'artist' && styles.itemImageCircle,
                ]}
              />
              {/* Badge de tipo */}
              <View style={styles.typeBadge}>
                <BlurView intensity={40} tint="dark" style={styles.typeBadgeBlur}>
                  <Icon
                    name={
                      item.type === 'album'
                        ? 'album'
                        : item.type === 'artist'
                        ? 'person'
                        : item.type === 'playlist'
                        ? 'queue-music'
                        : 'music-note'
                    }
                    size={14}
                    color="#1DB954"
                  />
                </BlurView>
              </View>
            </View>

            {/* Info del item */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
              {item.count && (
                <View style={styles.countBadge}>
                  <Icon name="music-note" size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.countText}>{item.count}</Text>
                </View>
              )}
            </View>

            {/* Botones de acción */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  if (onPlay) {
                    onPlay(item.id);
                  }
                }}
              >
                <BlurView intensity={40} tint="dark" style={styles.actionButtonBlur}>
                  <Icon 
                    name={isPlaying ? "pause" : "play-arrow"} 
                    size={24} 
                    color="#1DB954" 
                  />
                </BlurView>
              </TouchableOpacity>
              
              {/* Botón de eliminar (solo para favoritos) */}
              {onRemove && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  <BlurView intensity={40} tint="dark" style={styles.actionButtonBlur}>
                    <Icon name="favorite" size={20} color="#ff4444" />
                  </BlurView>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
});

const LibraryScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<LibraryTab>('favorites');
  const [favoriteFilter, setFavoriteFilter] = useState<'local' | 'streaming'>('local');
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  // PlayerContext
  const playerContext = usePlayerContext();
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
  const isLocalFile = playerContext.isLocalFile;
  const setIsLocalFile = playerContext.setIsLocalFile;

  // Estado de autenticación
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const authToken = useSelector((state: RootState) => state.auth.token);

  // Instancia de QobuzAPI
  const qobuzAPI = useRef(new QobuzAPI()).current;

  // Usar selectores memoizados para obtener datos ya transformados
  const favoriteItems = useSelector(selectFavoriteItems);
  const favoriteTracks = useSelector(selectFavorites); // Para acceder a los tracks con source
  const albumItems = useSelector(selectAlbumItems);
  const artistItems = useSelector(selectArtistItems);
  const playlistItems = useSelector(selectPlaylistItems);
  const downloadItems = useSelector(selectDownloadItems);

  // Aplicar filtro a favoritos
  const filteredFavoriteItems = useMemo(() => {
    // Siempre filtrar - mostrar solo local o streaming según el filtro activo
    return favoriteItems.filter(item => {
      // Mantener headers de sección que coincidan con el filtro activo
      if (item.isSection) {
        if (favoriteFilter === 'local') {
          return item.sectionTitle === 'Locales';
        } else if (favoriteFilter === 'streaming') {
          return item.sectionTitle === 'Streaming';
        }
        return false;
      }
      
      // Filtrar tracks según el filtro
      const track = favoriteTracks.find((f: any) => f.id.toString() === item.id);
      
      if (!track) return false;
      
      if (favoriteFilter === 'local') {
        return track.favoriteSource === 'local';
      } else if (favoriteFilter === 'streaming') {
        return track.favoriteSource === 'streaming';
      }
      
      return false;
    });
  }, [favoriteItems, favoriteTracks, favoriteFilter]);

  // Calcular items según tab activo con useMemo
  const items = useMemo(() => {
    switch (activeTab) {
      case 'favorites':
        return filteredFavoriteItems;
      case 'albums':
        return albumItems;
      case 'artists':
        return artistItems;
      case 'playlists':
        return playlistItems;
      case 'downloads':
        return downloadItems;
      default:
        return [];
    }
  }, [activeTab, filteredFavoriteItems, albumItems, artistItems, playlistItems, downloadItems]);

  const tabs: Array<{ id: LibraryTab; title: string; icon: string }> = [
    { id: 'favorites', title: 'Favoritos', icon: 'favorite' },
    { id: 'albums', title: 'Álbumes', icon: 'album' },
    { id: 'artists', title: 'Artistas', icon: 'person' },
    { id: 'playlists', title: 'Playlists', icon: 'queue-music' },
    { id: 'downloads', title: 'Descargas', icon: 'file-download' },
  ];

  // Establecer token de autenticación en QobuzAPI
  useEffect(() => {
    if (authToken && typeof authToken === 'string') {
      console.log('[LibraryScreen] Setting auth token in QobuzAPI');
      qobuzAPI.setAuthToken(authToken);
    }
  }, [authToken]);

  // Cargar biblioteca desde AsyncStorage al iniciar
  useEffect(() => {
    console.log('[LibraryScreen] Cargando biblioteca desde AsyncStorage...');
    dispatch(loadLibrary()).then(() => {
      // Después de cargar, reprocesar descargas existentes
      console.log('[LibraryScreen] Reprocesando descargas existentes...');
      dispatch(processExistingDownloads());
    });
  }, [dispatch]);

  // Debug: Log de albums y artists cuando cambien
  useEffect(() => {
    console.log('[LibraryScreen] 📊 Estado actual de biblioteca:');
    console.log('[LibraryScreen] 📀 Albums:', albumItems.length, albumItems);
    console.log('[LibraryScreen] 🎤 Artists:', artistItems.length, artistItems);
    console.log('[LibraryScreen] 📥 Downloads:', downloadItems.length);
  }, [albumItems, artistItems, downloadItems]);

  useEffect(() => {
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(headerAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleExploreMusic = useCallback(() => {
    navigation.navigate('Search' as never);
  }, [navigation]);

  const handleTabPress = useCallback((tabId: LibraryTab) => {
    setActiveTab(tabId);
    
    // Resetear filtro al cambiar de tab
    if (tabId !== 'favorites') {
      setFavoriteFilter('local');
    }
    
    // Animación de transición
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim]);

  const handleFilterToggle = useCallback(() => {
    // Solo activo en el tab de favoritos
    if (activeTab !== 'favorites') return;
    
    // Alternar entre: local <-> streaming
    if (favoriteFilter === 'local') {
      setFavoriteFilter('streaming');
    } else {
      setFavoriteFilter('local');
    }
  }, [activeTab, favoriteFilter]);

  // Función para reproducir track de streaming
  const playStreamingTrack = async (track: Track) => {
    try {
      console.log('[LibraryScreen] Playing STREAMING track:', track.title);
      console.log('[LibraryScreen] Auth token available:', !!authToken);
      console.log('[LibraryScreen] Is authenticated:', isAuthenticated);
      
      // Si hay un sonido anterior, detenerlo
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (e) {
          console.log('[LibraryScreen] Sound already unloaded');
        }
        setSound(null);
      }

      setIsPlaying(true);
      setIsLocalFile(false);

      // Obtener la URL completa con firma MD5
      let fullTrackUrl: string | null = null;
      
      try {
        console.log('[LibraryScreen] Getting full track URL with signature for track ID:', track.id);
        fullTrackUrl = await qobuzAPI.getTrackFileUrl(track.id, 27, 'stream');
        console.log('[LibraryScreen] Full track URL obtained:', fullTrackUrl ? 'SUCCESS' : 'NULL');
      } catch (error) {
        console.error('[LibraryScreen] Error getting full track URL:', error);
        Alert.alert('Error', 'No se pudo obtener la URL de streaming. Verifica tu conexión y autenticación.');
        setIsPlaying(false);
        return;
      }

      if (!fullTrackUrl) {
        Alert.alert('Error', 'No se pudo obtener la URL de streaming');
        setIsPlaying(false);
        return;
      }

      console.log('[LibraryScreen] Creating Audio.Sound with URL...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fullTrackUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            setSound(null);
          }
        }
      );

      setSound(newSound);
      console.log('[LibraryScreen] ✅ Streaming track playing successfully');

    } catch (error) {
      console.error('[LibraryScreen] Error playing streaming track:', error);
      setIsPlaying(false);
      Alert.alert('Error', 'No se pudo reproducir la canción');
    }
  };

  // Función para reproducir track local
  const playLocalTrack = async (track: Track) => {
    try {
      console.log('[LibraryScreen] Playing LOCAL track:', track.title);
      
      // Verificar si el track tiene una URI local
      const localUri = (track as any).localUri || (track as any).local_file_uri;
      
      if (!localUri) {
        console.error('[LibraryScreen] No local URI found for track:', track);
        throw new Error('No local URI found');
      }

      console.log('[LibraryScreen] Local URI found:', localUri);

      // Si hay un sonido anterior, detenerlo
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (e) {
          console.log('[LibraryScreen] Sound already unloaded');
        }
        setSound(null);
      }

      setIsPlaying(true);
      setIsLocalFile(true);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            setSound(null);
          }
        }
      );

      setSound(newSound);
      console.log('[LibraryScreen] ✅ Local track playing');

    } catch (error) {
      console.error('[LibraryScreen] Error playing local track:', error);
      setIsPlaying(false);
      Alert.alert('Error', 'No se pudo reproducir el archivo local');
    }
  };

  // Handler principal de play para favoritos
  const handlePlayFavorite = async (trackId: string) => {
    try {
      console.log('[LibraryScreen] handlePlayFavorite called for:', trackId);
      
      // Buscar el track en favoritos
      const favoriteTrack = favoriteTracks.find((t: any) => t.id.toString() === trackId);
      
      if (!favoriteTrack) {
        console.error('[LibraryScreen] Track not found in favorites');
        return;
      }

      // Si es el mismo track, alternar play/pause
      if (currentTrack?.id.toString() === trackId && miniPlayerVisible) {
        console.log('[LibraryScreen] Same track, toggling play/pause');
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

      // Establecer el track actual
      setCurrentTrack(favoriteTrack);
      setMiniPlayerVisible(true);
      setFullPlayerVisible(false);

      // Verificar si realmente tiene URI local antes de intentar reproducir como local
      const hasLocalUri = !!(favoriteTrack as any).localUri || !!(favoriteTrack as any).local_file_uri;

      // Reproducir según la fuente
      if (favoriteTrack.favoriteSource === 'local') {
        if (hasLocalUri) {
          console.log('[LibraryScreen] Playing from LOCAL source');
          await playLocalTrack(favoriteTrack);
        } else {
          console.warn('[LibraryScreen] ⚠️ Track marked as local but no localUri found, correcting to streaming');
          
          // Corregir automáticamente la fuente en favoritos (silenciosamente)
          await dispatch(correctFavoriteSource(favoriteTrack.id, 'streaming') as any);
          
          // Actualizar el track actual con la fuente corregida
          const correctedTrack = { ...favoriteTrack, favoriteSource: 'streaming' as const };
          setCurrentTrack(correctedTrack);
          
          // Reproducir desde streaming (sin alert, se corrigió automáticamente)
          console.log('[LibraryScreen] Auto-corrected to streaming, playing now...');
          await playStreamingTrack(correctedTrack);
        }
      } else {
        console.log('[LibraryScreen] Playing from STREAMING source');
        await playStreamingTrack(favoriteTrack);
      }

    } catch (error) {
      console.error('[LibraryScreen] Error in handlePlayFavorite:', error);
      setIsPlaying(false);
    }
  };

  const getFilterIcon = () => {
    if (activeTab !== 'favorites') {
      return 'sort'; // Ícono por defecto
    }
    
    switch (favoriteFilter) {
      case 'local':
        return 'folder'; // Locales
      case 'streaming':
        return 'cloud'; // Streaming
      default:
        return 'folder';
    }
  };

  const getFilterColor = () => {
    // Siempre color activo en favoritos (naranja para local, verde para streaming)
    if (activeTab !== 'favorites') {
      return '#1DB954';
    }
    return favoriteFilter === 'local' ? '#ff9800' : '#1DB954'; // Naranja para local, verde para streaming
  };

  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      <BlurView intensity={20} tint="dark" style={styles.tabBarBlur}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => handleTabPress(tab.id)}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={0.7}
              >
                <BlurView
                  intensity={isActive ? 40 : 0}
                  tint="dark"
                  style={styles.tabBlur}
                >
                  <LinearGradient
                    colors={
                      isActive
                        ? ['rgba(29, 185, 84, 0.3)', 'rgba(29, 185, 84, 0.1)']
                        : ['transparent', 'transparent']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tabGradient}
                  >
                    <Icon
                      name={tab.icon as any}
                      size={20}
                      color={isActive ? '#1DB954' : 'rgba(255,255,255,0.6)'}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        isActive && styles.tabTextActive,
                      ]}
                    >
                      {tab.title}
                    </Text>
                  </LinearGradient>
                </BlurView>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BlurView>
    </View>
  );

  const handleRemoveFavorite = useCallback((itemId: string) => {
    const trackId = parseInt(itemId, 10);
    dispatch(removeFromFavorites(trackId) as any);
    console.log('[LibraryScreen] ❌ Removed from favorites:', trackId);
  }, [dispatch]);

  const renderItem = ({ item, index }: { item: LibraryItem; index: number }) => {
    // Determinar si este track está reproduciéndose
    const isCurrentlyPlaying = currentTrack?.id.toString() === item.id && isPlaying && miniPlayerVisible;
    
    return (
      <LibraryItemCard 
        item={item} 
        index={index}
        onRemove={activeTab === 'favorites' ? handleRemoveFavorite : undefined}
        onPlay={activeTab === 'favorites' ? handlePlayFavorite : undefined}
        isPlaying={isCurrentlyPlaying}
      />
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <BlurView intensity={20} tint="dark" style={styles.emptyStateBlur}>
        <LinearGradient
          colors={['rgba(29, 185, 84, 0.1)', 'rgba(29, 185, 84, 0.05)']}
          style={styles.emptyStateGradient}
        >
          <Icon
            name={tabs.find((t) => t.id === activeTab)?.icon as any}
            size={80}
            color="rgba(29, 185, 84, 0.3)"
          />
          <Text style={styles.emptyStateTitle}>
            No hay {tabs.find((t) => t.id === activeTab)?.title.toLowerCase()}
          </Text>
          <Text style={styles.emptyStateText}>
            Explora música y añade tus {tabs.find((t) => t.id === activeTab)?.title.toLowerCase()} favoritos
          </Text>
          <TouchableOpacity style={styles.exploreButton} onPress={handleExploreMusic}>
            <BlurView intensity={40} tint="dark" style={styles.exploreButtonBlur}>
              <LinearGradient
                colors={['rgba(29, 185, 84, 0.4)', 'rgba(29, 185, 84, 0.2)']}
                style={styles.exploreButtonGradient}
              >
                <Icon name="search" size={20} color="#fff" />
                <Text style={styles.exploreButtonText}>Explorar música</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        </LinearGradient>
      </BlurView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#0a0a0a', '#000000', '#000000']}
        style={styles.gradient}
      >
        {/* Header animado */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <BlurView intensity={30} tint="dark" style={styles.headerBlur}>
            <LinearGradient
              colors={['rgba(29, 185, 84, 0.2)', 'rgba(0, 0, 0, 0.8)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.headerContent}>
                <View>
                  <Text style={styles.headerTitle}>Mi Biblioteca</Text>
                  <Text style={styles.headerSubtitle}>
                    {items.length} {items.length === 1 ? 'elemento' : 'elementos'}
                    {activeTab === 'favorites' && (
                      <Text style={{ color: favoriteFilter === 'local' ? '#ff9800' : '#1DB954' }}>
                        {' '}• {favoriteFilter === 'local' ? 'Locales' : 'Streaming'}
                      </Text>
                    )}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={handleFilterToggle}
                  disabled={activeTab !== 'favorites'}
                >
                  <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                    <Icon name={getFilterIcon() as any} size={24} color={getFilterColor()} />
                  </BlurView>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </BlurView>
        </Animated.View>

        {/* Tab Bar */}
        {renderTabBar()}

        {/* Content */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {items.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
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
  header: {
    marginTop: 10,
  },
  headerBlur: {
    overflow: 'hidden',
    borderRadius: 20,
    marginHorizontal: 16,
  },
  headerGradient: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  headerButton: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  headerButtonBlur: {
    padding: 12,
  },
  tabBarContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  tabBarBlur: {
    overflow: 'hidden',
    borderRadius: 20,
    marginHorizontal: 16,
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    overflow: 'hidden',
    borderRadius: 16,
    marginRight: 8,
  },
  tabActive: {
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: '#1DB954',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    marginBottom: 12,
  },
  itemBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  itemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  itemImageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  itemImageCircle: {
    borderRadius: 40,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    overflow: 'hidden',
    borderRadius: 12,
  },
  typeBadgeBlur: {
    padding: 6,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  itemSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  countText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  removeButton: {
    marginLeft: 4,
  },
  actionButtonBlur: {
    padding: 12,
  },
  emptyState: {
    flex: 1,
    margin: 16,
    overflow: 'hidden',
    borderRadius: 20,
  },
  emptyStateBlur: {
    flex: 1,
  },
  emptyStateGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  exploreButtonBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    overflow: 'hidden',
    borderRadius: 12,
  },
  sectionGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1DB954',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default LibraryScreen;
