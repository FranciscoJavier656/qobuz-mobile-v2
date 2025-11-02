import { configureStore, Middleware } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import downloadReducer from './slices/downloadSlice';
import playerReducer from './slices/playerSlice';
import libraryReducer from './slices/librarySlice';
import favoritesReducer from './slices/favoritesSlice';

// Logger middleware temporal para debug
const actionLogger: Middleware = () => (next) => (action: any) => {
  if (action.type && action.type.includes('download')) {
    console.log('[STORE] 🎯 ==================== ACCIÓN REDUX ====================');
    console.log('[STORE] 🎯 Tipo:', action.type);
    console.log('[STORE] 🎯 Payload:', action.payload ? JSON.stringify(action.payload, null, 2).substring(0, 500) : 'undefined');
    console.log('[STORE] 🎯 =======================================================');
  }
  const result = next(action);
  if (action.type && action.type.includes('loadDownloads')) {
    // Obtener el estado DESPUÉS de procesar la acción
    const state = (global as any).store?.getState();
    console.log('[STORE] 📊 Estado DESPUÉS de acción', action.type);
    console.log('[STORE] 📊 download.downloads.length:', state?.download?.downloads?.length || 0);
  }
  return result;
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    download: downloadReducer,
    player: playerReducer,
    library: libraryReducer,
    favorites: favoritesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(actionLogger),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
