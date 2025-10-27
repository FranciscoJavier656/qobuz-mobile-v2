import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import downloadReducer from './slices/downloadSlice';
import playerReducer from './slices/playerSlice';
import libraryReducer from './store/slices/librarySlice';
import favoritesReducer from './store/slices/favoritesSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    download: downloadReducer,
    player: playerReducer,
    library: libraryReducer,
    favorites: favoritesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;