import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';

// Types
import { Track } from '../services/qobuz/types';
import { RootState } from '../store';

// Actions
import { playTrack } from '../store/slices/playerSlice';
import { addDownload } from '../store/slices/downloadSlice';

// Services
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

const qobuzAPI = new QobuzAPI();

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
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

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !isAuthenticated) return;

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
      
      // Si ya hay algo reproduciéndose, detenerlo
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      // Si es la misma pista, solo detenerla
      if (playingTrackId === track.id) {
        setPlayingTrackId(null);
        return;
      }

      // Verificar si es previewable
      if (!track.previewable) {
        Alert.alert('Preview no disponible', 'Esta canción no tiene preview disponible');
        return;
      }

      setPlayingTrackId(track.id);

      // Obtener la URL de streaming con la firma MD5 correcta
      let previewUrl: string | null = null;
      
      try {
        // Primero intentar obtener URL de streaming con firma MD5
        console.log('[SearchScreen] Getting preview URL with signature...');
        previewUrl = await qobuzAPI.getTrackFileUrl(track.id, 'stream');
        console.log('[SearchScreen] Preview URL obtained:', previewUrl);
      } catch (error) {
        console.log('[SearchScreen] getTrackFileUrl failed:', error);
        
        // Fallback: intentar obtener información completa del track
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

      // Si no hay URL, mostrar error
      if (!previewUrl) {
        Alert.alert('Error', 'No se pudo obtener la URL de preview');
        setPlayingTrackId(null);
        return;
      }

      // Crear y reproducir el preview
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true },
        (status) => {
          // Cuando termine el preview, resetear
          if (status.isLoaded && status.didJustFinish) {
            setPlayingTrackId(null);
          }
        }
      );

      setSound(newSound);
      
      // Detener automáticamente después de 30 segundos
      setTimeout(async () => {
        try {
          await newSound.stopAsync();
          await newSound.unloadAsync();
          setPlayingTrackId(null);
          setSound(null);
        } catch (error) {
          console.error('Error stopping preview:', error);
        }
      }, 30000);

    } catch (error: any) {
      console.error('Error playing preview:', error);
      Alert.alert('Error', 'No se pudo reproducir el preview: ' + error.message);
      setPlayingTrackId(null);
    }
  };

  const handleDownload = (track: Track) => {
    dispatch(addDownload({
      id: track.id.toString(),
      title: track.title,
      artist: track.performer?.name || 'Unknown',
      progress: 0,
      status: 'pending'
    }));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTrack = ({ item }: { item: Track }) => (
    <View style={styles.trackItem}>
      <Image
        source={{ uri: item.album?.image?.small }}
        style={styles.albumArt}
        defaultSource={require('../../assets/placeholder.png')}
      />
      
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {item.performer?.name} • {item.album?.title}
        </Text>
        <Text style={styles.trackDuration}>
          {formatDuration(item.duration || 0)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handlePlay(item)}
        >
          <Icon 
            name={playingTrackId === item.id ? "pause" : "play-arrow"} 
            size={24} 
            color={playingTrackId === item.id ? "#FFA500" : "#1DB954"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDownload(item)}
        >
          <Icon name="download" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar canciones, artistas, álbumes..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="clear" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.searchButton, !query.trim() && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!query.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="search" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderTrack}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Icon name="music-note" size={64} color="#333" />
          <Text style={styles.emptyText}>
            {loading ? 'Buscando...' : 'Busca tu música favorita'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#1DB954',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  listContent: {
    paddingBottom: 100,
  },
  trackItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 15,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  trackArtist: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  trackDuration: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 15,
  },
});

export default SearchScreen;
