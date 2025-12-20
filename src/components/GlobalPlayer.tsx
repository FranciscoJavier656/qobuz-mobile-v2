import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { Audio } from 'expo-av';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootState } from '../store';
import {
  pauseTrack,
  resumeTrack,
  stopTrack,
  setPosition,
  setDuration,
  toggleFullPlayer,
} from '../store/slices/playerSlice';

const GlobalPlayer = () => {
  const dispatch = useDispatch();
  const playerState = useSelector((state: RootState) => state.player);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Cargar y reproducir el track cuando cambia
  useEffect(() => {
    if (playerState.currentTrack && playerState.isPlaying) {
      loadAndPlayTrack();
    } else if (!playerState.isPlaying && sound) {
      sound.pauseAsync();
    }

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [playerState.currentTrack?.uri, playerState.isPlaying]);

  // Animar la entrada del mini player
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: playerState.miniPlayerVisible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [playerState.miniPlayerVisible]);

  const loadAndPlayTrack = async () => {
    try {
      // Descargar el sonido anterior si existe
      if (sound) {
        await sound.unloadAsync();
      }

      console.log('[GlobalPlayer] 🎵 Loading track:', playerState.currentTrack?.track.title);
      console.log('[GlobalPlayer] 📍 Source:', playerState.currentTrack?.source);
      console.log('[GlobalPlayer] 🔗 URI:', playerState.currentTrack?.uri);

      // Configurar el modo de audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Crear el sonido
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playerState.currentTrack!.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      console.log('[GlobalPlayer] ✅ Track loaded and playing');
    } catch (error) {
      console.error('[GlobalPlayer] ❌ Error loading track:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      dispatch(setPosition(status.positionMillis || 0));
      dispatch(setDuration(status.durationMillis || 0));

      // Si llegó al final, detener
      if (status.didJustFinish) {
        dispatch(stopTrack());
      }
    }
  };

  const handlePlayPause = async () => {
    if (playerState.isPlaying) {
      dispatch(pauseTrack());
      if (sound) await sound.pauseAsync();
    } else {
      dispatch(resumeTrack());
      if (sound) await sound.playAsync();
    }
  };

  const handleStop = async () => {
    dispatch(stopTrack());
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!playerState.miniPlayerVisible || !playerState.currentTrack) {
    return null;
  }

  const progress = playerState.duration > 0 
    ? (playerState.position / playerState.duration) * 100 
    : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.miniPlayer}
        onPress={() => dispatch(toggleFullPlayer())}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#1a1a1a', '#0a0a0a']}
          style={styles.gradient}
        >
          {/* Barra de progreso */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.content}>
            {/* Artwork */}
            <Image
              source={{ uri: playerState.currentTrack.track.album.image.small }}
              style={styles.artwork}
            />

            {/* Info */}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {playerState.currentTrack.track.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {playerState.currentTrack.track.performer.name}
              </Text>
              <Text style={styles.source}>
                {playerState.currentTrack.source === 'local' ? '📁 Local' : '🌐 Streaming'}
              </Text>
            </View>

            {/* Controles */}
            <View style={styles.controls}>
              <TouchableOpacity onPress={handlePlayPause} style={styles.button}>
                <MaterialIcons
                  name={playerState.isPlaying ? 'pause' : 'play-arrow'}
                  size={32}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleStop} style={styles.button}>
                <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60, // Encima del tab bar
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  miniPlayer: {
    marginHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    padding: 12,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  artwork: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 2,
  },
  source: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    padding: 4,
    marginLeft: 8,
  },
});

export default GlobalPlayer;
