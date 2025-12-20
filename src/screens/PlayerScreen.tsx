import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';

// Types & Store
import { RootState } from '../store';

const PlayerScreen = () => {
  const { isPlaying, currentTrackId } = useSelector(
    (state: RootState) => state.player
  );

  if (!currentTrackId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Icon name="music-note" size={64} color="#333" />
          <Text style={styles.emptyText}>
            Selecciona una canción para reproducir
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Icon name={isPlaying ? "pause-circle-filled" : "play-circle-filled"} size={100} color="#1DB954" />
        <Text style={styles.trackId}>Track ID: {currentTrackId}</Text>
        <Text style={styles.status}>
          {isPlaying ? 'Reproduciendo...' : 'Pausado'}
        </Text>
        <Text style={styles.note}>
          Reproductor en desarrollo
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
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
    textAlign: 'center',
  },
  trackId: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  status: {
    color: '#1DB954',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  note: {
    color: '#666',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});

export default PlayerScreen;
