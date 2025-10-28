import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Thunk para cargar la biblioteca desde AsyncStorage
export const loadLibrary = createAsyncThunk(
  'library/loadLibrary',
  async () => {
    try {
      const [albumsJson, artistsJson] = await Promise.all([
        AsyncStorage.getItem('@qobuz_library_albums'),
        AsyncStorage.getItem('@qobuz_library_artists'),
      ]);
      
      return {
        albums: albumsJson ? JSON.parse(albumsJson) : [],
        artists: artistsJson ? JSON.parse(artistsJson) : [],
      };
    } catch (error) {
      console.error('[LibrarySlice] Error loading library:', error);
      return { albums: [], artists: [] };
    }
  }
);

// Thunk para guardar la biblioteca en AsyncStorage
export const saveLibrary = createAsyncThunk(
  'library/saveLibrary',
  async (state: { albums: Album[]; artists: Artist[] }) => {
    try {
      await Promise.all([
        AsyncStorage.setItem('@qobuz_library_albums', JSON.stringify(state.albums)),
        AsyncStorage.setItem('@qobuz_library_artists', JSON.stringify(state.artists)),
      ]);
      console.log('[LibrarySlice] ✅ Biblioteca guardada en AsyncStorage');
    } catch (error) {
      console.error('[LibrarySlice] Error saving library:', error);
    }
  }
);

// Thunk para agregar metadatos y persistir con información completa del artista
export const addMetadataFromTrackAsync = createAsyncThunk(
  'library/addMetadataFromTrackAsync',
  async (track: Track, { dispatch, getState }) => {
    // Primero agregar a la store con los datos básicos
    dispatch(librarySlice.actions.addMetadataFromTrack(track));
    
    // Si el track tiene performer con ID, intentar obtener info completa del artista
    const state = getState() as any;
    const authToken = state.auth?.token;
    
    console.log('[LibrarySlice] 🔍 Verificando datos del performer:', {
      hasPerformer: !!track.performer,
      performerName: track.performer?.name,
      performerId: track.performer?.id,
      hasAuthToken: !!authToken
    });
    
    if (track.performer?.id && authToken) {
      try {
        console.log('[LibrarySlice] 🌐 Solicitando info del artista desde Qobuz, ID:', track.performer.id);
        const artistInfo = await dispatch(fetchArtistInfo({
          artistId: track.performer.id,
          authToken: authToken,
        }));
        
        console.log('[LibrarySlice] 📦 Respuesta de fetchArtistInfo:', {
          hasPayload: !!artistInfo.payload,
          hasPicture: !!(artistInfo.payload as any)?.picture,
          picture: (artistInfo.payload as any)?.picture
        });
        
        // Si obtuvimos la info con imagen, actualizar el artista usando el reducer
        if (artistInfo.payload && (artistInfo.payload as any).picture) {
          dispatch(librarySlice.actions.updateArtistPicture({
            artistName: track.performer?.name || '',
            picture: (artistInfo.payload as any).picture
          }));
        }
      } catch (error) {
        console.log('[LibrarySlice] ⚠️ No se pudo obtener imagen del artista desde Qobuz:', error);
        console.log('[LibrarySlice] 📸 Usando imagen del álbum como fallback');
      }
    } else {
      if (!track.performer?.id) {
        console.log('[LibrarySlice] ⚠️ Track no tiene performer.id, no se puede obtener imagen de Qobuz');
        console.log('[LibrarySlice] 📋 Performer data:', track.performer);
      }
      if (!authToken) {
        console.log('[LibrarySlice] ⚠️ No hay authToken, no se puede obtener imagen de Qobuz');
      }
    }
    
    // Luego persistir
    const finalState = getState() as any;
    await dispatch(saveLibrary({
      albums: finalState.library.albums,
      artists: finalState.library.artists,
    }));
  }
);

// Thunk para obtener información completa del artista desde Qobuz
export const fetchArtistInfo = createAsyncThunk(
  'library/fetchArtistInfo',
  async ({ artistId, authToken }: { artistId: number; authToken: string }) => {
    try {
      console.log('[LibrarySlice] 🔍 Obteniendo info del artista desde Qobuz, ID:', artistId);
      const { QobuzAPI } = require('../../services/qobuz/QobuzAPI');
      const api = new QobuzAPI();
      api.setAuthToken(authToken);
      
      const artistInfo = await api.fetchArtist(artistId.toString());
      console.log('[LibrarySlice] ✅ Info del artista obtenida:', {
        name: artistInfo.name,
        hasPicture: !!artistInfo.picture,
        pictureUrl: artistInfo.picture,
        albumsCount: artistInfo.albums_count
      });
      
      return artistInfo;
    } catch (error) {
      console.error('[LibrarySlice] ❌ Error obteniendo info del artista:', error);
      throw error;
    }
  }
);

// Thunk para reprocesar descargas existentes
export const processExistingDownloads = createAsyncThunk(
  'library/processExistingDownloads',
  async (_, { dispatch, getState }) => {
    console.log('[LibrarySlice] 🔄 Reprocesando descargas existentes...');
    const state = getState() as any;
    const downloads = state.download?.downloads ?? [];
    const favorites = state.favorites?.tracks ?? [];
    const authToken = state.auth?.token;
    
    // Filtrar solo descargas completadas
    const completedDownloads = downloads.filter((d: any) => d.status === 'completed');
    console.log('[LibrarySlice] 📥 Descargas completadas encontradas:', completedDownloads.length);
    
    // Filtrar favoritos locales (tracks descargadas marcadas como favoritas)
    const localFavorites = favorites.filter((f: any) => f.favoriteSource === 'local');
    console.log('[LibrarySlice] 📥 Favoritos locales encontrados:', localFavorites.length);
    
    // Combinar ambas fuentes de tracks descargadas
    const allLocalTracks: any[] = [];
    
    // Agregar descargas completadas
    completedDownloads.forEach((d: any) => {
      if (d.track) allLocalTracks.push(d.track);
    });
    
    // Agregar favoritos locales (que son tracks descargadas)
    localFavorites.forEach((f: any) => {
      // Solo agregar si no está ya en la lista (evitar duplicados)
      if (!allLocalTracks.find(t => t.id === f.id)) {
        allLocalTracks.push(f);
      }
    });
    
    console.log('[LibrarySlice] 📊 Total de tracks locales a procesar:', allLocalTracks.length);
    
    // Si hay tracks, limpiar la biblioteca primero para reprocesar todo
    if (allLocalTracks.length > 0) {
      console.log('[LibrarySlice] 🧹 Limpiando biblioteca antes de reprocesar...');
      dispatch(librarySlice.actions.clearLibrary());
    }
    
    // Procesar cada track
    for (const track of allLocalTracks) {
      console.log('[LibrarySlice] ⚙️ Procesando track:', track.title);
      dispatch(librarySlice.actions.addMetadataFromTrack(track));
      
      // Si el track tiene performer con ID y tenemos auth token, obtener info completa del artista
      if (track.performer?.id && authToken) {
        console.log('[LibrarySlice] 🌐 Solicitando info del artista para reproceso, ID:', track.performer.id);
        const artistInfo = await dispatch(fetchArtistInfo({
          artistId: track.performer.id,
          authToken: authToken,
        }));
        
        // Si obtuvimos la info, actualizar el artista con la imagen real usando el reducer
        if (artistInfo.payload && (artistInfo.payload as any).picture) {
          dispatch(librarySlice.actions.updateArtistPicture({
            artistName: track.performer?.name || '',
            picture: (artistInfo.payload as any).picture
          }));
        }
      }
    }
    
    // Guardar en AsyncStorage
    const updatedState = getState() as any;
    await dispatch(saveLibrary({
      albums: updatedState.library.albums,
      artists: updatedState.library.artists,
    }));
    
    console.log('[LibrarySlice] ✅ Reprocesamiento completado');
    console.log('[LibrarySlice] 📊 Total: Albums:', updatedState.library.albums.length, 'Artists:', updatedState.library.artists.length);
  }
);

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

    // Agregar metadatos desde track descargado
    addMetadataFromTrack: (state, action: PayloadAction<Track>) => {
      const track = action.payload;
      // console.log('[LibrarySlice] 🔍 Procesando track:', track.title);
      // console.log('[LibrarySlice] 🔍 Track completo:', JSON.stringify(track, null, 2));
      
      // Variable para rastrear si se agregó un álbum nuevo
      let albumWasAdded = false;
      
      // Agregar álbum si existe y tiene título
      if (track.album?.title) {
        // console.log('[LibrarySlice] 📀 Procesando álbum:', track.album.title);
        // Generar ID numérico basado en hash del título del álbum
        const albumIdStr = `${track.album.title}-${track.performer?.name || 'unknown'}`;
        const albumId = Math.abs(albumIdStr.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0));
        const albumExists = state.albums.find(a => a.title === track.album?.title && a.artist?.name === track.performer?.name);
        
        if (!albumExists) {
          const newAlbum: Album = {
            id: albumId,
            title: track.album.title,
            artist: track.performer ? { name: track.performer.name } : undefined,
            image: track.album.image,
            tracks_count: 1,
            duration: track.duration,
          };
          state.albums.unshift(newAlbum);
          albumWasAdded = true;
          console.log('[LibrarySlice] ✅ Album agregado:', newAlbum.title);
          // console.log('[LibrarySlice] 📊 Total álbumes en biblioteca:', state.albums.length);
        }
      }
      
      // Agregar artista (performer) si existe
      if (track.performer?.name) {
        // console.log('[LibrarySlice] 🎤 Procesando artista:', track.performer.name);
        // Generar ID numérico basado en hash del nombre del artista
        const artistIdStr = track.performer.name;
        const artistId = Math.abs(artistIdStr.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0));
        const artistExists = state.artists.find(a => a.name === track.performer?.name);
        
        // Usar la imagen del álbum como miniatura del artista (temporal)
        const artistPicture = track.album?.image?.large || track.album?.image?.small || undefined;
        
        if (!artistExists) {
          // Contar álbumes de este artista
          const artistAlbumsCount = state.albums.filter(a => a.artist?.name === track.performer?.name).length;
          
          const newArtist: Artist = {
            id: artistId,
            name: track.performer.name,
            picture: artistPicture,
            albums_count: artistAlbumsCount,
          };
          state.artists.unshift(newArtist);
          console.log('[LibrarySlice] ✅ Artist agregado:', newArtist.name, 'con', artistAlbumsCount, 'álbumes');
          // console.log('[LibrarySlice] 📊 Total artistas en biblioteca:', state.artists.length);
        } else {
          // Si se agregó un álbum nuevo, actualizar el contador
          if (albumWasAdded) {
            const artistAlbumsCount = state.albums.filter(a => a.artist?.name === track.performer?.name).length;
            artistExists.albums_count = artistAlbumsCount;
            console.log('[LibrarySlice] 📀 Albums del artista actualizados:', artistExists.name, '->', artistAlbumsCount);
          }
          // Si el artista existe pero no tiene imagen y ahora sí la tenemos, actualizarla
          if (!artistExists.picture && artistPicture) {
            artistExists.picture = artistPicture;
            // console.log('[LibrarySlice] 🖼️ Imagen temporal del artista actualizada:', artistExists.name);
          }
        }
      }
      
      // console.log('[LibrarySlice] ✨ Proceso completado. Albums:', state.albums.length, 'Artists:', state.artists.length);
    },
    
    // Actualizar imagen real del artista desde Qobuz
    updateArtistPicture: (state, action: PayloadAction<{ artistName: string; picture: string }>) => {
      const artist = state.artists.find(a => a.name === action.payload.artistName);
      if (artist) {
        artist.picture = action.payload.picture;
        console.log('[LibrarySlice] 🖼️ Imagen REAL del artista actualizada desde Qobuz:', artist.name);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLibrary.fulfilled, (state, action) => {
        state.albums = action.payload.albums;
        state.artists = action.payload.artists;
        console.log('[LibrarySlice] ✅ Biblioteca cargada desde AsyncStorage');
        console.log('[LibrarySlice] 📊 Albums:', state.albums.length, 'Artists:', state.artists.length);
      });
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
  addMetadataFromTrack,
  updateArtistPicture,
} = librarySlice.actions;

export default librarySlice.reducer;
