import React, { useState, useEffect, useRef } from 'react';
import { usePlayerContext } from '../contexts/PlayerContext';
import FullPlayer from './AudioPlayer/FullPlayer';

const FullPlayerWrapper: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    sound,
    fullPlayerVisible,
    setFullPlayerVisible,
    setMiniPlayerVisible,
    setIsPlaying,
    setSound,
    isLocalFile,
  } = usePlayerContext();

  const handleClose = () => {
    setFullPlayerVisible(false);
  };

  const handlePlayPause = async () => {
    if (!sound) return;

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
      console.error('[FullPlayerWrapper] Error toggling play/pause:', error);
    }
  };

  // No renderizar si no está visible o no hay track
  if (!fullPlayerVisible || !currentTrack) {
    return null;
  }

  return (
    <FullPlayer
      track={currentTrack}
      isPlaying={isPlaying}
      sound={sound}
      onClose={handleClose}
      onPlayPause={handlePlayPause}
      visible={fullPlayerVisible}
      isLocalFile={isLocalFile}
    />
  );
};

export default FullPlayerWrapper;
