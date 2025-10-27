import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Track, Album, Artist } from '../../services/qobuz/types';

interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  image?: string;
  createdAt: number;
}

interface LibraryState {
  favorites: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  recentlyPlayed: Track[];
}

const initialState: LibraryState = {
  favorites: [],
  albums: [],
  artists: [],
  playlists: [],
  recentlyPlayed: [],
};

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    // Favoritos
    addFavorite: (state, action: PayloadAction<Track>) => {
      const exists = state.favorites.find(t => t.id === action.payload.id);
      if (!exists) {
        state.favorites.unshift(action.payload);
      }
    },
    removeFavorite: (state, action: PayloadAction<number>) => {
      state.favorites = state.favorites.filter(t => t.id !== action.payload);
    },
    setFavorites: (state, action: PayloadAction<Track[]>) => {
      state.favorites = action.payload;
    },

    // Álbumes
    addAlbum: (state, action: PayloadAction<Album>) => {
      const exists = state.albums.find(a => a.id === action.payload.id);
      if (!exists) {
        state.albums.unshift(action.payload);
      }
    },
    removeAlbum: (state, action: PayloadAction<string | number>) => {
      state.albums = state.albums.filter(a => a.id.toString() !== action.payload.toString());
    },
    setAlbums: (state, action: PayloadAction<Album[]>) => {
      state.albums = action.payload;
    },

    // Artistas
    addArtist: (state, action: PayloadAction<Artist>) => {
      const exists = state.artists.find(a => a.id === action.payload.id);
      if (!exists) {
        state.artists.unshift(action.payload);
      }
    },
    removeArtist: (state, action: PayloadAction<number>) => {
      state.artists = state.artists.filter(a => a.id !== action.payload);
    },
    setArtists: (state, action: PayloadAction<Artist[]>) => {
      state.artists = action.payload;
    },

    // Playlists
    createPlaylist: (state, action: PayloadAction<{ name: string }>) => {
      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name: action.payload.name,
        tracks: [],
        createdAt: Date.now(),
      };
      state.playlists.unshift(newPlaylist);
    },
    deletePlaylist: (state, action: PayloadAction<string>) => {
      state.playlists = state.playlists.filter(p => p.id !== action.payload);
    },
    addTrackToPlaylist: (state, action: PayloadAction<{ playlistId: string; track: Track }>) => {
      const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
      if (playlist) {
        const exists = playlist.tracks.find(t => t.id === action.payload.track.id);
        if (!exists) {
          playlist.tracks.push(action.payload.track);
        }
      }
    },
    removeTrackFromPlaylist: (state, action: PayloadAction<{ playlistId: string; trackId: number }>) => {
      const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
      if (playlist) {
        playlist.tracks = playlist.tracks.filter(t => t.id !== action.payload.trackId);
      }
    },
    setPlaylists: (state, action: PayloadAction<Playlist[]>) => {
      state.playlists = action.payload;
    },

    // Recently Played
    addToRecentlyPlayed: (state, action: PayloadAction<Track>) => {
      // Remover si ya existe
      state.recentlyPlayed = state.recentlyPlayed.filter(t => t.id !== action.payload.id);
      // Agregar al inicio
      state.recentlyPlayed.unshift(action.payload);
      // Mantener solo los últimos 50
      if (state.recentlyPlayed.length > 50) {
        state.recentlyPlayed = state.recentlyPlayed.slice(0, 50);
      }
    },
    setRecentlyPlayed: (state, action: PayloadAction<Track[]>) => {
      state.recentlyPlayed = action.payload;
    },

    // Clear all
    clearLibrary: (state) => {
      state.favorites = [];
      state.albums = [];
      state.artists = [];
      state.playlists = [];
      state.recentlyPlayed = [];
    },
  },
});

export const {
  addFavorite,
  removeFavorite,
  setFavorites,
  addAlbum,
  removeAlbum,
  setAlbums,
  addArtist,
  removeArtist,
  setArtists,
  createPlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  setPlaylists,
  addToRecentlyPlayed,
  setRecentlyPlayed,
  clearLibrary,
} = librarySlice.actions;

export default librarySlice.reducer;
