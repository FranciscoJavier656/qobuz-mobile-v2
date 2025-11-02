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
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    playNext,
    playPrevious,
    playNextTrack,
    setCurrentTrack,
    isShuffleEnabled,
    setIsShuffleEnabled,
    repeatMode,
    setRepeatMode,
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

  const handleNext = () => {
    console.log('[FullPlayerWrapper] 🎵 Next track - usando playNextTrack()');
    playNextTrack();
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      console.log('[FullPlayerWrapper] 🎵 Previous track');
      playPrevious();
    }
  };

  const handleShuffleToggle = () => {
    const newShuffleState = !isShuffleEnabled;
    console.log('[FullPlayerWrapper] 🔀 Shuffle:', newShuffleState ? 'ON' : 'OFF');
    setIsShuffleEnabled(newShuffleState);
    
    if (newShuffleState && queue.length > 0) {
      // Mezclar la cola (excepto la canción actual)
      const currentTrackInQueue = queue[currentIndex];
      const otherTracks = queue.filter((_, idx) => idx !== currentIndex);
      
      // Algoritmo Fisher-Yates para mezclar
      const shuffled = [...otherTracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Poner la canción actual al principio
      const newQueue = [currentTrackInQueue, ...shuffled];
      setQueue(newQueue);
      setCurrentIndex(0);
      console.log('[FullPlayerWrapper] 🔀 Cola mezclada');
    }
  };

  const handleRepeatToggle = () => {
    // Ciclo: off -> all -> one -> off
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    
    console.log('[FullPlayerWrapper] 🔁 Repeat mode:', nextMode);
    setRepeatMode(nextMode);
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
      queue={queue}
      onQueueUpdate={setQueue}
      onNext={handleNext}
      onPrevious={queue.length > 0 && currentIndex > 0 ? handlePrevious : undefined}
      isShuffleEnabled={isShuffleEnabled}
      onShuffleToggle={handleShuffleToggle}
      repeatMode={repeatMode}
      onRepeatToggle={handleRepeatToggle}
    />
  );
};

export default FullPlayerWrapper;
