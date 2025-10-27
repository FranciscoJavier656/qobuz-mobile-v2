import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PlayerState {
  isPlaying: boolean;
  currentTrackId: string | null;
  volume: number;
}

const initialState: PlayerState = {
  isPlaying: false,
  currentTrackId: null,
  volume: 100,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    playTrack(state, action: PayloadAction<string>) {
      state.isPlaying = true;
      state.currentTrackId = action.payload;
    },
    pauseTrack(state) {
      state.isPlaying = false;
    },
    stopTrack(state) {
      state.isPlaying = false;
      state.currentTrackId = null;
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = action.payload;
    },
  },
});

export const { playTrack, pauseTrack, stopTrack, setVolume } = playerSlice.actions;

export default playerSlice.reducer;