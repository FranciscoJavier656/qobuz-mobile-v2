import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Track } from '../../services/qobuz/types';

export interface PlayerTrack {
  track: Track;
  source: 'streaming' | 'local'; // Diferenciar entre streaming y archivo local
  uri: string; // URL de streaming o path local
}

interface PlayerState {
  isPlaying: boolean;
  currentTrack: PlayerTrack | null;
  miniPlayerVisible: boolean;
  fullPlayerVisible: boolean;
  position: number; // Posición actual en ms
  duration: number; // Duración total en ms
  volume: number;
}

const initialState: PlayerState = {
  isPlaying: false,
  currentTrack: null,
  miniPlayerVisible: false,
  fullPlayerVisible: false,
  position: 0,
  duration: 0,
  volume: 100,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    playTrack(state, action: PayloadAction<PlayerTrack>) {
      state.isPlaying = true;
      state.currentTrack = action.payload;
      state.miniPlayerVisible = true;
      console.log('[playerSlice] 🎵 Playing track:', action.payload.track.title, 'Source:', action.payload.source);
    },
    pauseTrack(state) {
      state.isPlaying = false;
      console.log('[playerSlice] ⏸️ Track paused');
    },
    resumeTrack(state) {
      state.isPlaying = true;
      console.log('[playerSlice] ▶️ Track resumed');
    },
    stopTrack(state) {
      state.isPlaying = false;
      state.currentTrack = null;
      state.miniPlayerVisible = false;
      state.fullPlayerVisible = false;
      state.position = 0;
      state.duration = 0;
      console.log('[playerSlice] ⏹️ Track stopped');
    },
    togglePlayPause(state) {
      state.isPlaying = !state.isPlaying;
      console.log('[playerSlice] ⏯️ Toggle play/pause:', state.isPlaying);
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = action.payload;
    },
    setPosition(state, action: PayloadAction<number>) {
      state.position = action.payload;
    },
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },
    showMiniPlayer(state) {
      state.miniPlayerVisible = true;
      state.fullPlayerVisible = false;
    },
    showFullPlayer(state) {
      state.fullPlayerVisible = true;
    },
    hideFullPlayer(state) {
      state.fullPlayerVisible = false;
    },
    toggleFullPlayer(state) {
      state.fullPlayerVisible = !state.fullPlayerVisible;
    },
  },
});

export const {
  playTrack,
  pauseTrack,
  resumeTrack,
  stopTrack,
  togglePlayPause,
  setVolume,
  setPosition,
  setDuration,
  showMiniPlayer,
  showFullPlayer,
  hideFullPlayer,
  toggleFullPlayer,
} = playerSlice.actions;

export default playerSlice.reducer;