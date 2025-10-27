import { configureStore } from '@reduxjs/toolkit';

// Import reducers
import authSlice from './slices/authSlice';
import downloadSlice from './slices/downloadSlice';
import playerSlice from './slices/playerSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    download: downloadSlice,
    player: playerSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
