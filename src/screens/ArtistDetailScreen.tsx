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
import type { RootState } from '../store';
import type { Track } from '../services/qobuz/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteParams {
  artistId: string;
  artistName: string;
  artistImage?: string;
}

const ArtistDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { artistId, artistName, artistImage } = route.params as RouteParams;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [scrollY] = useState(new Animated.Value(0));

  // Obtener tracks descargadas del artista
  const downloads = useSelector((state: RootState) => state.download.downloads);
  const albums = useSelector((state: RootState) => state.library.albums);

  useEffect(() => {
    loadArtistTracks();
  }, [artistId]);

  const loadArtistTracks = () => {
    setLoading(true);
    
    // Filtrar tracks de este artista desde las descargas
    const artistTracks = downloads
      .filter(download => 
        download.status === 'completed' && 
        download.track.performer?.id?.toString() === artistId
      )
      .map(download => download.track);

    // Ordenar por álbum y track number
    const sortedTracks = artistTracks.sort((a, b) => {
      // Primero por álbum
      const albumCompare = (a.album?.title || '').localeCompare(b.album?.title || '');
      if (albumCompare !== 0) return albumCompare;
      // Luego por track number
      return (a.track_number || 0) - (b.track_number || 0);
    });

    setTracks(sortedTracks);
    setLoading(false);
  };

  const handlePlayTrack = (trackId: string) => {
    if (currentPlayingId === trackId) {
      setCurrentPlayingId(null);
    } else {
      setCurrentPlayingId(trackId);
      // Aquí integrarás con tu reproductor actual
      console.log('Playing track:', trackId);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setCurrentPlayingId(tracks[0].id.toString());
      console.log('Playing all tracks starting from:', tracks[0].title);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    const isPlaying = currentPlayingId === item.id.toString();
    const isFirstOfAlbum = index === 0 || item.album?.title !== tracks[index - 1]?.album?.title;

    return (
      <>
        {isFirstOfAlbum && item.album && (
          <View style={styles.albumHeader}>
            <Image
              source={{ uri: item.album.image?.small || 'https://via.placeholder.com/50' }}
              style={styles.albumHeaderImage}
            />
            <View style={styles.albumHeaderInfo}>
              <Text style={styles.albumHeaderTitle} numberOfLines={1}>
                {item.album.title}
              </Text>
              <Text style={styles.albumHeaderYear}>
                {item.album.release_date_original 
                  ? new Date(item.album.release_date_original).getFullYear()
                  : 'Unknown'}
              </Text>
            </View>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.trackItem, isPlaying && styles.trackItemPlaying]}
          onPress={() => handlePlayTrack(item.id.toString())}
          activeOpacity={0.7}
        >
          <View style={styles.trackLeft}>
            <View style={styles.trackNumberContainer}>
              {isPlaying ? (
                <MaterialIcons name="equalizer" size={20} color="#1DB954" />
              ) : (
                <Text style={styles.trackNumber}>{item.track_number || index + 1}</Text>
              )}
            </View>
            <View style={styles.trackInfo}>
              <Text style={[styles.trackTitle, isPlaying && styles.trackTitlePlaying]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.trackDuration}>
                {formatDuration(item.duration || 0)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.playButton}
            onPress={() => handlePlayTrack(item.id.toString())}
          >
            <MaterialIcons
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={24}
              color={isPlaying ? '#1DB954' : '#fff'}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#000']}
          style={styles.gradient}
        >
          <ActivityIndicator size="large" color="#1DB954" style={styles.loader} />
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
        {/* Header con imagen del artista */}
        <Animated.View
          style={[
            styles.header,
            {
              height: headerHeight,
            },
          ]}
        >
          <Animated.Image
            source={{ uri: artistImage || 'https://via.placeholder.com/300' }}
            style={[
              styles.artistImage,
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
            <Text style={styles.artistName}>{artistName}</Text>
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
                Descarga música de este artista para verla aquí
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
  artistImage: {
    width: SCREEN_WIDTH,
    height: '100%',
    position: 'absolute',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
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
  artistName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  trackCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  playAllButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  playAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
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
    paddingBottom: 100,
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  albumHeaderImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  albumHeaderInfo: {
    flex: 1,
  },
  albumHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  albumHeaderYear: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
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
    gap: 12,
  },
  trackNumberContainer: {
    width: 30,
    alignItems: 'center',
  },
  trackNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: '#1DB954',
  },
  trackDuration: {
    fontSize: 12,
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

export default ArtistDetailScreen;
