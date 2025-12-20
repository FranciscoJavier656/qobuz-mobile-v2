import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MiniPlayerProps {
  onOpenFullPlayer: () => void;
  onPlayPause: () => void;
  onClose: () => void;
  onRewind?: () => void;
  onForward?: () => void;
  position: number;
  duration: number;
  onSeek: (value: number) => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  onOpenFullPlayer,
  onPlayPause,
  onClose,
  onRewind,
  onForward,
  position,
  duration,
  onSeek,
}) => {
  const { currentTrack, isPlaying, miniPlayerVisible, fullPlayerVisible } = usePlayerContext();
  const [isSeeking, setIsSeeking] = useState(false);
  const [localPosition, setLocalPosition] = useState(position);
  const insets = useSafeAreaInsets();

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!miniPlayerVisible || !currentTrack || fullPlayerVisible) {
    return null;
  }

  // Calcular la posición: altura de la tab bar + el safe area bottom
  const tabBarHeight = 49; // Altura estándar de la tab bar
  const bottomPosition = tabBarHeight + insets.bottom;

  return (
    <View style={[styles.container, { bottom: bottomPosition }]}>
      {/* Progress Bar */}
      <Slider
        style={styles.slider}
        value={isSeeking ? localPosition : position}
        minimumValue={0}
        maximumValue={duration || 1}
        minimumTrackTintColor="#1DB954"
        maximumTrackTintColor="rgba(255,255,255,0.12)"
        thumbTintColor="transparent"
        onSlidingStart={() => setIsSeeking(true)}
        onSlidingComplete={(value) => {
          onSeek(value / (duration || 1));
          setIsSeeking(false);
        }}
        onValueChange={(value) => {
          if (isSeeking) {
            setLocalPosition(value);
          }
        }}
      />

      {/* Content */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onOpenFullPlayer}
        style={styles.content}
      >
        {/* Album Art */}
        <Image
          source={{ uri: currentTrack.album?.image?.thumbnail || currentTrack.album?.image?.small }}
          style={styles.albumArt}
        />

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <View style={styles.trackMetadata}>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.performer?.name || 'Artista Desconocido'}
            </Text>
            <Text style={styles.trackTime}>
              {formatTime(position)} / {formatTime(duration)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {onRewind && (
            <TouchableOpacity 
              onPress={onRewind}
              style={styles.controlButton}
              activeOpacity={0.7}
            >
              <BlurView intensity={30} tint="dark" style={styles.controlButtonInner}>
                <Icon name="replay-10" size={20} color="rgba(255,255,255,0.8)" />
              </BlurView>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={onPlayPause}
            style={styles.playButton}
            activeOpacity={0.8}
          >
            <BlurView intensity={35} tint="dark" style={styles.playButtonInner}>
              <Icon
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={24}
                color="#1DB954"
              />
            </BlurView>
          </TouchableOpacity>

          {onForward && (
            <TouchableOpacity 
              onPress={onForward}
              style={styles.controlButton}
              activeOpacity={0.7}
            >
              <BlurView intensity={30} tint="dark" style={styles.controlButtonInner}>
                <Icon name="forward-10" size={20} color="rgba(255,255,255,0.8)" />
              </BlurView>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <BlurView intensity={30} tint="dark" style={styles.controlButtonInner}>
              <Icon name="close" size={18} color="rgba(255,255,255,0.7)" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // bottom se establece dinámicamente en el componente
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.98)',
    zIndex: 999999,
    borderTopWidth: 1,
    borderTopColor: 'rgba(29, 185, 84, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  slider: {
    width: '100%',
    height: 20,
    marginTop: -5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#1a1a1a',
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    flex: 1,
  },
  trackTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  controlButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  playButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
});

export default MiniPlayer;
