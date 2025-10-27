import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export default favoritesSlice.reducer;
