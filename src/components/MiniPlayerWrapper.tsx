import React, { useState, useEffect, useRef } from 'react';
import MiniPlayer from '../components/MiniPlayer';
import { usePlayerContext } from '../contexts/PlayerContext';

const MiniPlayerWrapper: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    sound, 
    setIsPlaying,
    setMiniPlayerVisible,
    setFullPlayerVisible,
    isLocalFile,
  } = usePlayerContext();

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Actualizar posición y duración
  useEffect(() => {
    if (sound && isPlaying) {
      // Limpiar intervalo anterior
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      // Actualizar cada 100ms
      updateIntervalRef.current = setInterval(async () => {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            setPosition(status.positionMillis / 1000);
            setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          }
        } catch (error) {
          console.error('[MiniPlayerWrapper] Error getting status:', error);
        }
      }, 100);
    } else if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [sound, isPlaying]);

  const handlePlayPause = async () => {
    if (!sound) {
      return;
    }

    try {
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
    } catch (error) {
      console.error('[MiniPlayerWrapper] ❌ Error toggling play/pause:', error);
    }
  };

  const handleSeek = async (percentage: number) => {
    if (!sound || !duration) return;

    try {
      const seekPosition = percentage * duration * 1000;
      await sound.setPositionAsync(seekPosition);
      setPosition(seekPosition / 1000);
    } catch (error) {
      console.error('[MiniPlayerWrapper] Error seeking:', error);
    }
  };

  const handleRewind = async () => {
    if (!sound) return;
    
    try {
      const newPosition = Math.max(0, position - 10);
      await sound.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
    } catch (error) {
      console.error('[MiniPlayerWrapper] Error rewinding:', error);
    }
  };

  const handleForward = async () => {
    if (!sound || !duration) return;
    
    try {
      const newPosition = Math.min(duration, position + 10);
      await sound.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
    } catch (error) {
      console.error('[MiniPlayerWrapper] Error forwarding:', error);
    }
  };

  const handleClose = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (error) {
        console.error('[MiniPlayerWrapper] Error stopping sound:', error);
      }
    }
    setMiniPlayerVisible(false);
    setIsPlaying(false);
  };

  const handleOpenFullPlayer = () => {
    setFullPlayerVisible(true);
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <MiniPlayer
      onOpenFullPlayer={handleOpenFullPlayer}
      onPlayPause={handlePlayPause}
      onClose={handleClose}
      onRewind={handleRewind}
      onForward={handleForward}
      position={position}
      duration={duration}
      onSeek={handleSeek}
    />
  );
};

export default MiniPlayerWrapper;
