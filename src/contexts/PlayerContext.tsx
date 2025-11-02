import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Audio } from 'expo-av';

export interface Track {
  id: number;
  title: string;
  performer?: {
    name: string;
  };
  album?: {
    image?: {
      small?: string;
      thumbnail?: string;
      large?: string;
    };
  };
  duration?: number;
  [key: string]: any;
}

interface PlayerContextType {
  fullPlayerVisible: boolean;
  setFullPlayerVisible: (visible: boolean) => void;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  sound: Audio.Sound | null;
  setSound: (sound: Audio.Sound | null) => void;
  miniPlayerVisible: boolean;
  setMiniPlayerVisible: (visible: boolean) => void;
  isLocalFile: boolean;
  setIsLocalFile: (isLocal: boolean) => void;
  queue: Track[];
  setQueue: (queue: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  isShuffleEnabled: boolean;
  setIsShuffleEnabled: (enabled: boolean) => void;
  repeatMode: 'off' | 'all' | 'one';
  setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  const addToQueue = (tracks: Track[]) => {
    setQueue(prevQueue => [...prevQueue, ...tracks]);
  };

  const playNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Si repeat all está activado, volver al inicio
      setCurrentIndex(0);
    }
  };

  const playPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Si repeat all está activado, ir al final
      setCurrentIndex(queue.length - 1);
    }
  };

  return (
    <PlayerContext.Provider value={{ 
      fullPlayerVisible, 
      setFullPlayerVisible,
      currentTrack,
      setCurrentTrack,
      isPlaying,
      setIsPlaying,
      sound,
      setSound,
      miniPlayerVisible,
      setMiniPlayerVisible,
      isLocalFile,
      setIsLocalFile,
      queue,
      setQueue,
      addToQueue,
      currentIndex,
      setCurrentIndex,
      playNext,
      playPrevious,
      isShuffleEnabled,
      setIsShuffleEnabled,
      repeatMode,
      setRepeatMode,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext debe usarse dentro de PlayerProvider');
  }
  return context;
};
