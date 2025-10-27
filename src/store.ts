import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import downloadReducer from './slices/downloadSlice';
import playerReducer from './slices/playerSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    download: downloadReducer,
    player: playerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;