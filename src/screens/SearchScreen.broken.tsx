import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Types
import { Track } from '../services/qobuz/types';
import { RootState } from '../store';

// Actions
import { playTrack } from '../store/slices/playerSlice';
import { addDownload } from '../store/slices/downloadSlice';

// Services
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const qobuzAPI = new QobuzAPI();

// Componente separado para cada item de track
const TrackItem = ({ 
  item, 
  index, 
  isPlaying, 
  onPlay 
}: { 
  item: Track; 
  index: number; 
  isPlaying: boolean; 
  onPlay: () => void;
}) => {
  const itemAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.trackItemWrapper,
        {
          opacity: itemAnim,
          transform: [
            {
              translateY: itemAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <BlurView intensity={20} tint="dark" style={styles.trackItem}>
        <LinearGradient
          colors={isPlaying ? ['rgba(29, 185, 84, 0.3)', 'rgba(29, 185, 84, 0.05)'] : ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        
        {/* Album Cover with Glow Effect */}
        <View style={styles.albumCoverContainer}>
          {isPlaying && (
            <View style={styles.glowEffect}>
              <LinearGradient
                colors={['rgba(29, 185, 84, 0.6)', 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          )}
          <Image
            source={{
              uri: item.album?.image?.large || item.album?.image?.small || 'https://via.placeholder.com/120',
            }}
            style={[styles.albumCover, isPlaying && styles.albumCoverPlaying]}
          />
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <View style={[styles.bar, styles.bar1]} />
              <View style={[styles.bar, styles.bar2]} />
              <View style={[styles.bar, styles.bar3]} />
            </View>
          )}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.performer?.name || 'Unknown Artist'}
          </Text>
          <View style={styles.trackMetadata}>
            <View style={styles.qualityBadge}>
              <Icon name="high-quality" size={12} color="#1DB954" />
              <Text style={styles.qualityText}>Hi-Res</Text>
            </View>
            {item.duration && (
              <Text style={styles.duration}>
                {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
              </Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.playButton, isPlaying && styles.playButtonActive]}
            onPress={onPlay}
          >
            <LinearGradient
              colors={isPlaying ? ['#1DB954', '#1ed760'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              <Icon
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={28}
                color={isPlaying ? '#000' : '#fff'}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const { isAuthenticated, token } = auth as any;

  // Set auth token when available
  useEffect(() => {
    if (token) {
      qobuzAPI.setAuthToken(token);
    }
  }, [token]);

  // Configure audio and cleanup
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
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !isAuthenticated) return;

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
      const searchResults = await qobuzAPI.searchTracks(query, 50);
      setResults(searchResults || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, isAuthenticated]);

  const handlePlay = async (track: Track) => {
    try {
      console.log('[SearchScreen] Playing track:', track.id, track.title);
      
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      if (playingTrackId === track.id) {
        setPlayingTrackId(null);
        return;
      }

      if (!track.previewable) {
        Alert.alert('Preview no disponible', 'Esta canción no tiene preview disponible');
        return;
      }

      setPlayingTrackId(track.id);

      // Obtener la URL de streaming con la firma MD5 correcta
      let previewUrl: string | null = null;
      
      try {
        console.log('[SearchScreen] Getting preview URL with signature...');
        previewUrl = await qobuzAPI.getTrackFileUrl(track.id, 'stream');
        console.log('[SearchScreen] Preview URL obtained:', previewUrl);
      } catch (error) {
        console.log('[SearchScreen] getTrackFileUrl failed:', error);
        
        try {
          const trackInfo = await qobuzAPI.getTrackInfo(track.id);
          console.log('[SearchScreen] Track info received, checking for sample URL');
          
          if (trackInfo.sample_url) {
            previewUrl = trackInfo.sample_url;
            console.log('[SearchScreen] Found sample_url:', previewUrl);
          } else if (trackInfo.preview_url) {
            previewUrl = trackInfo.preview_url;
            console.log('[SearchScreen] Found preview_url:', previewUrl);
          }
        } catch (infoError) {
          console.log('[SearchScreen] Could not get track info:', infoError);
        }
      }

      if (!previewUrl) {
        Alert.alert('Error', 'No se pudo obtener la URL de preview');
        setPlayingTrackId(null);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingTrackId(null);
          }
        }
      );

      setSound(newSound);

      setTimeout(async () => {
        try {
          await newSound.stopAsync();
          setPlayingTrackId(null);
        } catch (e) {
          console.error('Error stopping preview:', e);
        }
      }, 30000);

    } catch (error) {
      console.error('Error playing preview:', error);
      setPlayingTrackId(null);
      Alert.alert('Error', 'No se pudo reproducir el preview');
    }
  };

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => {
    const isPlaying = playingTrackId === item.id;
    const itemAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.trackItemWrapper,
          {
            opacity: itemAnim,
            transform: [
              {
                translateY: itemAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView intensity={20} tint="dark" style={styles.trackItem}>
          <LinearGradient
            colors={isPlaying ? ['rgba(29, 185, 84, 0.3)', 'rgba(29, 185, 84, 0.05)'] : ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Album Cover with Glow Effect */}
          <View style={styles.albumCoverContainer}>
            {isPlaying && (
              <View style={styles.glowEffect}>
                <LinearGradient
                  colors={['rgba(29, 185, 84, 0.6)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            )}
            <Image
              source={{
                uri: item.album?.image?.large || item.album?.image?.small || 'https://via.placeholder.com/120',
              }}
              style={[styles.albumCover, isPlaying && styles.albumCoverPlaying]}
            />
            {isPlaying && (
              <View style={styles.playingIndicator}>
                <View style={[styles.bar, styles.bar1]} />
                <View style={[styles.bar, styles.bar2]} />
                <View style={[styles.bar, styles.bar3]} />
              </View>
            )}
          </View>

          {/* Track Info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.performer?.name || 'Unknown Artist'}
            </Text>
            <View style={styles.trackMetadata}>
              <View style={styles.qualityBadge}>
                <Icon name="high-quality" size={12} color="#1DB954" />
                <Text style={styles.qualityText}>Hi-Res</Text>
              </View>
              {item.duration && (
                <Text style={styles.duration}>
                  {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.playButton, isPlaying && styles.playButtonActive]}
              onPress={() => handlePlay(item)}
            >
              <LinearGradient
                colors={isPlaying ? ['#1DB954', '#1ed760'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playButtonGradient}
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play-arrow'}
                  size={28}
                  color={isPlaying ? '#000' : '#fff'}
                />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => {
                dispatch(addDownload({
                  id: item.id.toString(),
                  title: item.title,
                  artist: item.performer?.name || 'Unknown',
                  progress: 0,
                  status: 'pending' as const,
                }));
                Alert.alert('Añadido', `${item.title} añadido a descargas`);
              }}
            >
              <Icon name="download" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Animated Background Gradient */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#0f0f0f']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header with Glassmorphism */}
          <BlurView intensity={80} tint="dark" style={styles.header}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.headerTitle}>Discover Music</Text>
            <Text style={styles.headerSubtitle}>High-Resolution Audio Streaming</Text>
          </BlurView>

          {/* Search Bar with Animation */}
          <Animated.View style={[styles.searchContainer, { transform: [{ scale: searchBarScale }] }]}>
            <BlurView intensity={60} tint="dark" style={styles.searchBar}>
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Icon name="search" size={24} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tracks, artists, albums..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                  <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>

          {/* Results */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1DB954" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTrackItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : query.length > 0 ? (
            <View style={styles.emptyState}>
              <Icon name="music-note" size={80} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyStateTitle}>No results found</Text>
              <Text style={styles.emptyStateSubtitle}>Try a different search term</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="search" size={80} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyStateTitle}>Start Searching</Text>
              <Text style={styles.emptyStateSubtitle}>Discover millions of high-quality tracks</Text>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  trackItemWrapper: {
    marginBottom: 12,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  albumCoverContainer: {
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 50,
  },
  albumCover: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  albumCoverPlaying: {
    transform: [{ scale: 1.05 }],
  },
  playingIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bar: {
    width: 3,
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  bar1: {
    height: 8,
  },
  bar2: {
    height: 12,
  },
  bar3: {
    height: 6,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  trackArtist: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    fontWeight: '500',
  },
  trackMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  qualityText: {
    fontSize: 11,
    color: '#1DB954',
    fontWeight: '700',
  },
  duration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  playButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SearchScreen;
