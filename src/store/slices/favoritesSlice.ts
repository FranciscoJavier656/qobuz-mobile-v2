import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Track } from '../../services/qobuz/types';

const FAVORITES_STORAGE_KEY = '@qobuz_favorites';

export interface FavoriteTrack extends Track {
  favoriteSource: 'local' | 'streaming';
  addedAt: string; // ISO timestamp
}

export interface FavoritesState {
  tracks: FavoriteTrack[];
  isLoading: boolean;
}

const initialState: FavoritesState = {
  tracks: [],
  isLoading: false,
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    setFavorites: (state, action: PayloadAction<FavoriteTrack[]>) => {
      state.tracks = action.payload;
    },
    addFavorite: (state, action: PayloadAction<{ track: Track; source: 'local' | 'streaming' }>) => {
      // Verificar si ya existe
      const exists = state.tracks.some(track => track.id === action.payload.track.id);
      if (!exists) {
        const favoriteTrack: FavoriteTrack = {
          ...action.payload.track,
          favoriteSource: action.payload.source,
          addedAt: new Date().toISOString(),
        };
        state.tracks.unshift(favoriteTrack); // Agregar al inicio
      }
    },
    removeFavorite: (state, action: PayloadAction<number>) => {
      state.tracks = state.tracks.filter(track => track.id !== action.payload);
    },
    clearFavorites: (state) => {
      state.tracks = [];
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
  setLoading,
} = favoritesSlice.actions;

// Thunk para cargar favoritos desde AsyncStorage
export const loadFavorites = () => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (favoritesJson) {
      const favorites = JSON.parse(favoritesJson);
      dispatch(setFavorites(favorites));
      console.log('[FavoritesSlice] ✅ Favoritos cargados:', favorites.length);
    }
  } catch (error) {
    console.error('[FavoritesSlice] ❌ Error loading favorites:', error);
  } finally {
    dispatch(setLoading(false));
  }
};

// Thunk para guardar favoritos en AsyncStorage
export const saveFavoritesToStorage = (tracks: FavoriteTrack[]) => async () => {
  try {
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(tracks));
    console.log('[FavoritesSlice] ✅ Favoritos guardados:', tracks.length);
  } catch (error) {
    console.error('[FavoritesSlice] ❌ Error saving favorites:', error);
  }
};

// Thunk para agregar a favoritos y guardar
export const addToFavorites = (track: Track, source: 'local' | 'streaming' = 'streaming') => async (dispatch: any, getState: any) => {
  dispatch(addFavorite({ track, source }));
  const { favorites } = getState();
  await dispatch(saveFavoritesToStorage(favorites.tracks));
  console.log(`[FavoritesSlice] ✅ Added to favorites as ${source}:`, track.title);
};

// Thunk para remover de favoritos y guardar
export const removeFromFavorites = (trackId: number) => async (dispatch: any, getState: any) => {
  dispatch(removeFavorite(trackId));
  const { favorites } = getState();
  await dispatch(saveFavoritesToStorage(favorites.tracks));
};

// Thunk para corregir la fuente de un favorito (de 'local' a 'streaming')
export const correctFavoriteSource = (trackId: number, newSource: 'local' | 'streaming') => async (dispatch: any, getState: any) => {
  const { favorites } = getState();
  const trackIndex = favorites.tracks.findIndex((t: FavoriteTrack) => t.id === trackId);
  
  if (trackIndex !== -1) {
    const updatedTracks = [...favorites.tracks];
    updatedTracks[trackIndex] = {
      ...updatedTracks[trackIndex],
      favoriteSource: newSource,
    };
    
    dispatch(setFavorites(updatedTracks));
    await dispatch(saveFavoritesToStorage(updatedTracks));
    console.log(`[FavoritesSlice] ✅ Corrected favorite source for track ${trackId} to ${newSource}`);
  }
};

// Thunk para validar favoritos locales y eliminar los que no tienen archivo
export const validateLocalFavorites = () => async (dispatch: any, getState: any) => {
  const { favorites } = getState();
  
  // Verificar que favorites.tracks existe y es un array
  if (!favorites?.tracks || !Array.isArray(favorites.tracks)) {
    console.log('[FavoritesSlice] ℹ️ No hay favoritos para validar');
    return;
  }
  
  const localFavorites = favorites.tracks.filter((t: FavoriteTrack) => t.favoriteSource === 'local');
  
  if (localFavorites.length === 0) {
    console.log('[FavoritesSlice] ℹ️ No hay favoritos locales para validar');
    return;
  }
  
  console.log('[FavoritesSlice] 🔍 Validando', localFavorites.length, 'favoritos locales...');
  
  const validatedTracks: FavoriteTrack[] = [];
  const invalidTracks: FavoriteTrack[] = [];
  
  for (const track of localFavorites) {
    // Construir la ruta esperada del archivo
    const sanitizeFilename = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '-');
    const artist = track.performer?.name || track.artist?.name || 'Unknown Artist';
    const title = track.title || 'Unknown Track';
    const filename = `${sanitizeFilename(artist)} - ${sanitizeFilename(title)}.flac`;
    const localPath = `${FileSystem.documentDirectory}downloads/${filename}`;
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists) {
        validatedTracks.push(track);
        console.log('[FavoritesSlice] ✅ Archivo existe:', filename);
      } else {
        invalidTracks.push(track);
        console.log('[FavoritesSlice] ❌ Archivo no existe:', filename);
      }
    } catch (error) {
      invalidTracks.push(track);
      console.log('[FavoritesSlice] ❌ Error verificando archivo:', filename, error);
    }
  }
  
  // Si hay tracks inválidos, eliminarlos de favoritos
  if (invalidTracks.length > 0) {
    console.log('[FavoritesSlice] 🗑️ Eliminando', invalidTracks.length, 'favoritos sin archivo local');
    
    // Mantener todos los favoritos excepto los locales inválidos
    const streamingFavorites = favorites.tracks.filter((t: FavoriteTrack) => t.favoriteSource === 'streaming');
    const updatedTracks = [...streamingFavorites, ...validatedTracks];
    
    dispatch(setFavorites(updatedTracks));
    await dispatch(saveFavoritesToStorage(updatedTracks));
    
    console.log('[FavoritesSlice] ✅ Favoritos actualizados. Total:', updatedTracks.length, 
                '(Streaming:', streamingFavorites.length, ', Local:', validatedTracks.length, ')');
  } else {
    console.log('[FavoritesSlice] ✅ Todos los favoritos locales tienen archivos válidos');
  }
};

export default favoritesSlice.reducer;
