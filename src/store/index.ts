import { configureStore } from '@reduxjs/toolkit';

// Import reducers
import authSlice from './slices/authSlice';
import downloadSlice from './slices/downloadSlice';
import playerSlice from './slices/playerSlice';
import librarySlice from './slices/librarySlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    download: downloadSlice,
    player: playerSlice,
    library: librarySlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
