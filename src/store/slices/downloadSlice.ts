import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Track } from '../../services/qobuz/types';
import { DownloadManager } from '../../services/DownloadManager';

export interface DownloadItem {
  id: string;
  track: Track;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  error?: string;
  localPath?: string;
  quality: string; // '5' = MP3 320kbps, '6' = FLAC 16/44.1, '7' = FLAC 24/96, '27' = FLAC 24/192
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface DownloadSliceState {
  downloads: DownloadItem[];
  queue: string[]; // IDs de tracks en cola
  isDownloading: boolean;
  currentDownloadId: string | null;
  settings: {
    maxConcurrent: number;
    autoDownload: boolean;
    wifiOnly: boolean;
    defaultQuality: string;
  };
  stats: {
    totalDownloaded: number;
    totalSize: number;
    successCount: number;
    errorCount: number;
  };
}

const initialState: DownloadSliceState = {
  downloads: [],
  queue: [],
  isDownloading: false,
  currentDownloadId: null,
  settings: {
    maxConcurrent: 3,
    autoDownload: true,
    wifiOnly: false,
    defaultQuality: '27', // FLAC 24/192 por defecto
  },
  stats: {
    totalDownloaded: 0,
    totalSize: 0,
    successCount: 0,
    errorCount: 0,
  },
};

// Thunk para cargar descargas desde AsyncStorage
export const loadDownloads = createAsyncThunk(
  'download/loadDownloads',
  async () => {
    try {
      console.log('[loadDownloads] 🔄 Iniciando carga desde AsyncStorage...');
      const downloadsJson = await AsyncStorage.getItem('downloads');
      const statsJson = await AsyncStorage.getItem('downloads_stats');
      
      console.log('[loadDownloads] 📦 downloadsJson length:', downloadsJson?.length || 0);
      
      if (downloadsJson) {
        const downloads = JSON.parse(downloadsJson);
        const stats = statsJson ? JSON.parse(statsJson) : initialState.stats;
        console.log('[loadDownloads] ✅ Recibidas desde AsyncStorage:', downloads.length, 'downloads');
        console.log('[loadDownloads] 📋 Tracks cargados:', downloads.map((d: DownloadItem) => d.track.title));
        return { downloads, stats };
      }
      
      console.log('[loadDownloads] ⚠️ No hay descargas en AsyncStorage');
      return { downloads: [], stats: initialState.stats };
    } catch (error) {
      console.error('[downloadSlice] Error cargando descargas:', error);
      return { downloads: [], stats: initialState.stats };
    }
  }
);

// Thunk para guardar descargas en AsyncStorage
export const saveDownloads = createAsyncThunk(
  'download/saveDownloads',
  async (_, { getState }) => {
    try {
      const state = getState() as { download: DownloadSliceState };
      
      console.log('[saveDownloads] 🔍 Estado actual antes de guardar:');
      console.log('[saveDownloads] 📊 Total downloads en estado:', state.download.downloads.length);
      console.log('[saveDownloads] 📊 Por status:', {
        completed: state.download.downloads.filter(d => d.status === 'completed').length,
        downloading: state.download.downloads.filter(d => d.status === 'downloading').length,
        paused: state.download.downloads.filter(d => d.status === 'paused').length,
        error: state.download.downloads.filter(d => d.status === 'error').length,
      });
      
      // 🔧 FIX: Cargar descargas existentes desde AsyncStorage primero
      let existingDownloads: DownloadItem[] = [];
      try {
        const downloadsJson = await AsyncStorage.getItem('downloads');
        if (downloadsJson) {
          existingDownloads = JSON.parse(downloadsJson);
          console.log('[saveDownloads] 📥 Descargas existentes en AsyncStorage:', existingDownloads.length);
          console.log('[saveDownloads] 📋 Tracks existentes:', existingDownloads.map(d => d.track.title));
        }
      } catch (error) {
        console.error('[saveDownloads] ⚠️ Error cargando descargas existentes:', error);
      }
      
      // Solo tomar descargas completadas del estado actual
      const newCompletedDownloads = state.download.downloads.filter(d => d.status === 'completed');
      
      // Combinar: usar Map para evitar duplicados (la clave es localPath o id)
      const downloadsMap = new Map<string, DownloadItem>();
      
      // Agregar existentes primero
      existingDownloads.forEach(d => {
        const key = d.localPath || d.id;
        downloadsMap.set(key, d);
      });
      
      // Sobrescribir/agregar nuevos
      newCompletedDownloads.forEach(d => {
        const key = d.localPath || d.id;
        downloadsMap.set(key, d);
      });
      
      const mergedDownloads = Array.from(downloadsMap.values());
      
      console.log('[saveDownloads] 💾 Guardando', mergedDownloads.length, 'descargas completadas (merged)');
      console.log('[saveDownloads] 📋 Tracks finales a guardar:', mergedDownloads.map(d => d.track.title));
      
      await AsyncStorage.setItem('downloads', JSON.stringify(mergedDownloads));
      await AsyncStorage.setItem('downloads_stats', JSON.stringify(state.download.stats));
      
      console.log('[saveDownloads] ✅ Descargas guardadas en AsyncStorage:', mergedDownloads.length, 'tracks');
      return true;
    } catch (error) {
      console.error('[downloadSlice] ❌ Error guardando descargas:', error);
      return false;
    }
  }
);

// Thunk para escanear automáticamente el directorio de descargas al iniciar
export const autoScanDownloads = createAsyncThunk(
  'download/autoScan',
  async (params: { authToken: string }, { getState, dispatch }) => {
    try {
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      
      if (!dirInfo.exists) {
        return { syncedCount: 0, errorCount: 0 };
      }
      
      const files = await FileSystem.readDirectoryAsync(downloadsDir);
      
      if (files.length === 0) {
        return { syncedCount: 0, errorCount: 0 };
      }
      
      // Cargar descargas existentes desde AsyncStorage
      let existingDownloads: DownloadItem[] = [];
      try {
        const downloadsJson = await AsyncStorage.getItem('downloads');
        if (downloadsJson) {
          existingDownloads = JSON.parse(downloadsJson);
        }
      } catch (error) {
        console.error('[autoScanDownloads] Error cargando descargas:', error);
      }
      
      // Importar QobuzAPI
      const { QobuzAPI } = await import('../../services/qobuz/QobuzAPI');
      const qobuzAPI = new QobuzAPI();
      qobuzAPI.setAuthToken(params.authToken);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      // Procesar archivo por archivo Y GUARDAR INMEDIATAMENTE
      for (const filename of files) {
        try {
          const filePath = `${downloadsDir}${filename}`;
          
          // Verificar si ya existe
          const alreadyExists = existingDownloads.some(d => d.localPath === filePath);
          if (alreadyExists) {
            continue;
          }
          
          // Extraer artista y título del nombre del archivo
          const nameWithoutExt = filename.replace(/\.(flac|mp3)$/i, '');
          const [artist, title] = nameWithoutExt.split(' - ');
          
          if (!artist || !title) {
            console.log('[autoScanDownloads] ⚠️ No se pudo parsear:', filename);
            errorCount++;
            continue;
          }
          
          console.log('[autoScanDownloads] 🔍 Buscando metadatos:', artist, '-', title);
          
          // Buscar en Qobuz
          const searchQuery = `${artist} ${title}`;
          const searchResults = await qobuzAPI.searchTracks(searchQuery, 5);
          
          if (searchResults && searchResults.length > 0) {
            const track = searchResults[0];
            const extension = filename.toLowerCase().endsWith('.mp3') ? 'mp3' : 'flac';
            const quality = extension === 'mp3' ? '5' : '27';
            
            console.log('[autoScanDownloads] ✅ Metadatos encontrados:', track.title);
            
            // Obtener tamaño del archivo
            let fileSize = 0;
            try {
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              if (fileInfo.exists && 'size' in fileInfo) {
                fileSize = fileInfo.size;
              }
            } catch (error) {
              console.error('[autoScanDownloads] ❌ Error obteniendo tamaño:', error);
            }
            
            // Crear DownloadItem
            const downloadId = `synced-${track.id}-${Date.now()}`;
            const now = Date.now();
            
            const newDownload: DownloadItem = {
              id: downloadId,
              track: track,
              status: 'completed',
              progress: 100,
              downloadedBytes: fileSize,
              totalBytes: fileSize,
              speed: 0,
              timeRemaining: 0,
              quality: quality,
              localPath: filePath,
              addedAt: now,
              startedAt: now,
              completedAt: now,
            };
            
            // AGREGAR A ARRAY Y GUARDAR INMEDIATAMENTE EN ASYNCSTORAGE
            existingDownloads.push(newDownload);
            await AsyncStorage.setItem('downloads', JSON.stringify(existingDownloads));
            
            console.log('[autoScanDownloads] � Guardado en AsyncStorage:', track.title, '- Total:', existingDownloads.length);
            
            syncedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('[autoScanDownloads] Error procesando', filename, ':', error);
          errorCount++;
        }
      }
      
      // Recargar Redux si hay nuevos archivos
      console.log('[autoScanDownloads] 🔄 Verificando si recargar Redux - syncedCount:', syncedCount);
      if (syncedCount > 0) {
        console.log('[autoScanDownloads] 🔄 Recargando Redux con', existingDownloads.length, 'descargas...');
        await dispatch(loadDownloads());
        console.log('[autoScanDownloads] ✅ Redux recargado');
      } else {
        console.log('[autoScanDownloads] ⏭️ No hay archivos nuevos, saltando recarga');
      }
      
      console.log('[autoScanDownloads] 📊 Resumen final: Sincronizados:', syncedCount, '| Errores:', errorCount);
      return { syncedCount, errorCount };
    } catch (error) {
      console.error('[autoScanDownloads] Error en escaneo:', error);
      return { syncedCount: 0, errorCount: 0 };
    }
  }
);

// Thunk para agregar descarga ya completada (sync manual)
export const addSyncedDownload = createAsyncThunk(
  'download/addSynced',
  async (params: {
    track: Track;
    localPath: string;
    quality: string;
  }, { getState, dispatch }) => {
    console.log('[addSyncedDownload] 🔄 Adding synced download:', params.track.title);
    
    const state = getState() as { download: DownloadSliceState };
    
    // Verificar si ya existe
    const exists = state.download.downloads.find(d => d.track.id === params.track.id);
    if (exists) {
      console.log('[addSyncedDownload] ⚠️ Download already exists, skipping');
      return null;
    }
    
    const downloadId = `synced-${params.track.id}-${Date.now()}`;
    const now = Date.now();
    
    // Obtener el tamaño del archivo
    let fileSize = 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(params.localPath);
      if (fileInfo.exists && 'size' in fileInfo) {
        fileSize = fileInfo.size;
      }
    } catch (error) {
      console.error('[addSyncedDownload] ❌ Error getting file size:', error);
    }
    
    const syncedDownload: DownloadItem = {
      id: downloadId,
      track: params.track,
      status: 'completed',
      progress: 100,
      downloadedBytes: fileSize,
      totalBytes: fileSize,
      speed: 0,
      timeRemaining: 0,
      quality: params.quality,
      localPath: params.localPath,
      addedAt: now,
      startedAt: now,
      completedAt: now,
    };
    
    console.log('[addSyncedDownload] ✅ Created synced download entry');
    return syncedDownload;
  }
);

// Thunk para eliminar descarga Y archivo físico
export const deleteDownloadWithFile = createAsyncThunk(
  'download/deleteWithFile',
  async (downloadId: string, { getState }) => {
    console.log('[deleteDownloadWithFile] 🔥 Starting deletion for ID:', downloadId);
    const state = getState() as { download: DownloadSliceState };
    const download = state.download.downloads.find(d => d.id === downloadId);
    console.log('[deleteDownloadWithFile] 📦 Download found:', download ? 'YES' : 'NO');
    console.log('[deleteDownloadWithFile] 📁 Local path:', download?.localPath);
    
    if (download?.localPath) {
      try {
        const downloadManager = DownloadManager.getInstance();
        const deleted = await downloadManager.deleteDownloadedFile(download.localPath);
        console.log('[deleteDownloadWithFile] 🗑️ File deleted:', deleted, 'Path:', download.localPath);
      } catch (error) {
        console.error('[deleteDownloadWithFile] ❌ Error deleting file:', error);
      }
    } else {
      console.log('[deleteDownloadWithFile] ⚠️ No local path, skipping file deletion');
    }
    
    return { downloadId, download };
  }
);

const downloadSlice = createSlice({
  name: 'download',
  initialState,
  reducers: {
    addDownload(state, action: PayloadAction<{ track: Track; quality?: string }>) {
      const { track, quality } = action.payload;
      const downloadId = `${track.id}_${Date.now()}`;
      
      console.log('[addDownload] 🎯 ESTADO ANTES de agregar:');
      console.log('[addDownload] 📊 Total downloads en estado:', state.downloads.length);
      console.log('[addDownload] 📋 Tracks en estado:', state.downloads.map(d => d.track.title).slice(0, 5));
      console.log('[addDownload] ➕ Agregando nuevo track:', track.title);
      
      // Verificar si ya existe
      const exists = state.downloads.find(d => d.track.id === track.id);
      if (exists) {
        console.log('[addDownload] ⚠️ Track ya existe, saltando:', track.title);
        return;
      }

      const newDownload: DownloadItem = {
        id: downloadId,
        track,
        status: 'pending',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        timeRemaining: 0,
        quality: quality || state.settings.defaultQuality,
        addedAt: Date.now(),
      };

      state.downloads.unshift(newDownload);
      state.queue.push(downloadId);
      
      console.log('[addDownload] ✅ ESTADO DESPUÉS de agregar:');
      console.log('[addDownload] 📊 Total downloads en estado:', state.downloads.length);
    },

    removeDownload(state, action: PayloadAction<string>) {
      const downloadId = action.payload;
      
      // Encontrar la descarga antes de eliminarla para actualizar stats
      const download = state.downloads.find(d => d.id === downloadId);
      
      // Actualizar estadísticas si la descarga estaba completada o tenía error
      if (download) {
        if (download.status === 'completed' && download.downloadedBytes > 0) {
          // Restar del tamaño total y del contador de éxitos
          state.stats.totalSize = Math.max(0, state.stats.totalSize - download.downloadedBytes);
          state.stats.successCount = Math.max(0, state.stats.successCount - 1);
          console.log('[downloadSlice] 📊 Stats updated after deletion - Size:', state.stats.totalSize, 'Success count:', state.stats.successCount);
        } else if (download.status === 'error') {
          // Restar del contador de errores
          state.stats.errorCount = Math.max(0, state.stats.errorCount - 1);
          console.log('[downloadSlice] 📊 Error count updated after deletion:', state.stats.errorCount);
        }
      }
      
      // Eliminar la descarga
      state.downloads = state.downloads.filter(d => d.id !== downloadId);
      state.queue = state.queue.filter(id => id !== downloadId);
      
      if (state.currentDownloadId === downloadId) {
        state.currentDownloadId = null;
        state.isDownloading = false;
      }
    },

    updateDownloadProgress(state, action: PayloadAction<{
      id: string;
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
      speed: number;
      timeRemaining: number;
    }>) {
      const download = state.downloads.find(d => d.id === action.payload.id);
      if (download) {
        download.progress = action.payload.progress;
        download.downloadedBytes = action.payload.downloadedBytes;
        download.totalBytes = action.payload.totalBytes;
        download.speed = action.payload.speed;
        download.timeRemaining = action.payload.timeRemaining;
      }
    },

    setDownloadStatus(state, action: PayloadAction<{
      id: string;
      status: DownloadItem['status'];
      error?: string;
      localPath?: string;
    }>) {
      const download = state.downloads.find(d => d.id === action.payload.id);
      if (download) {
        download.status = action.payload.status;
        
        if (action.payload.status === 'downloading' && !download.startedAt) {
          download.startedAt = Date.now();
        }
        
        if (action.payload.status === 'completed') {
          download.completedAt = Date.now();
          download.progress = 100;
          download.localPath = action.payload.localPath;
          state.stats.successCount++;
          state.stats.totalDownloaded++;
          state.stats.totalSize += download.totalBytes;
          
          // Auto-guardar cuando se completa una descarga
          console.log('[downloadSlice] 💾 Auto-guardando descarga completada...');
        }
        
        if (action.payload.status === 'error') {
          download.error = action.payload.error;
          state.stats.errorCount++;
        }
      }
    },

    startDownload(state, action: PayloadAction<string>) {
      const downloadId = action.payload;
      const download = state.downloads.find(d => d.id === downloadId);
      
      if (download) {
        download.status = 'downloading';
        state.currentDownloadId = downloadId;
        state.isDownloading = true;
      }
    },

    pauseDownload(state, action: PayloadAction<string>) {
      const download = state.downloads.find(d => d.id === action.payload);
      if (download) {
        download.status = 'paused';
      }
    },

    resumeDownload(state, action: PayloadAction<string>) {
      const download = state.downloads.find(d => d.id === action.payload);
      if (download) {
        download.status = 'pending';
        if (!state.queue.includes(action.payload)) {
          state.queue.push(action.payload);
        }
      }
    },

    retryDownload(state, action: PayloadAction<string>) {
      const download = state.downloads.find(d => d.id === action.payload);
      if (download) {
        download.status = 'pending';
        download.progress = 0;
        download.downloadedBytes = 0;
        download.error = undefined;
        if (!state.queue.includes(action.payload)) {
          state.queue.push(action.payload);
        }
      }
    },

    clearCompleted(state) {
      state.downloads = state.downloads.filter(d => d.status !== 'completed');
    },

    clearAll(state) {
      state.downloads = [];
      state.queue = [];
      state.currentDownloadId = null;
      state.isDownloading = false;
    },

    setIsDownloading(state, action: PayloadAction<boolean>) {
      state.isDownloading = action.payload;
    },

    updateSettings(state, action: PayloadAction<Partial<DownloadSliceState['settings']>>) {
      console.log('[downloadSlice] 🔧 Updating settings:', action.payload);
      console.log('[downloadSlice] 📊 Previous settings:', state.settings);
      state.settings = { ...state.settings, ...action.payload };
      console.log('[downloadSlice] ✅ New settings:', state.settings);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDownloads.pending, (state) => {
        console.log('[downloadSlice] ⏳ loadDownloads.pending - Iniciando carga...');
      })
      .addCase(loadDownloads.fulfilled, (state, action) => {
        console.log('=================================================');
        console.log('🚨🚨🚨 REDUCER loadDownloads.fulfilled EJECUTÁNDOSE 🚨🚨🚨');
        console.log('=================================================');
        console.log('[downloadSlice] 🔵 ==================== loadDownloads.fulfilled EJECUTÁNDOSE ====================');
        console.log('[downloadSlice] 🔵 Payload recibido:', JSON.stringify(action.payload, null, 2));
        console.log('[downloadSlice] 🔵 Estado ANTES de actualizar:', {
          downloadsLength: state.downloads.length,
          firstDownload: state.downloads[0]?.track?.title || 'N/A'
        });
        
        const { downloads, stats } = action.payload;
        console.log('[downloadSlice] 🔵 Recibidas desde AsyncStorage:', downloads.length, 'downloads');
        console.log('[downloadSlice] 🔵 TODAS las tracks:', downloads.map((d: DownloadItem) => d.track.title));
        console.log('[downloadSlice] 🔵 Por status:', {
          completed: downloads.filter((d: DownloadItem) => d.status === 'completed').length,
          downloading: downloads.filter((d: DownloadItem) => d.status === 'downloading').length,
          pending: downloads.filter((d: DownloadItem) => d.status === 'pending').length
        });
        
        // 🔧 FIX: Preservar downloads activos (pending, downloading, paused, error)
        // Solo reemplazar los completados con los de AsyncStorage
        const activeDownloads = state.downloads.filter((d: DownloadItem) => 
          d.status !== 'completed'
        );
        
        console.log('[downloadSlice] 🔵 Preservando downloads activos:', activeDownloads.length);
        console.log('[downloadSlice] 🔵 Active tracks:', activeDownloads.map((d: DownloadItem) => `${d.track.title} (${d.status})`));
        
        // Combinar: downloads completados de AsyncStorage + downloads activos de Redux
        state.downloads = [...downloads, ...activeDownloads];
        state.stats = stats;
        
        console.log('[downloadSlice] 🔵 Estado DESPUÉS de actualizar:', {
          downloadsLength: state.downloads.length,
          completedCount: state.downloads.filter((d: DownloadItem) => d.status === 'completed').length,
          tracks: state.downloads.map((d: DownloadItem) => `${d.track.title} (${d.status})`).slice(0, 5)
        });
        console.log('[downloadSlice] ✅ Estado de descargas restaurado - Total en estado:', state.downloads.length);
        console.log('[downloadSlice] 🔵 ==================== FIN loadDownloads.fulfilled ====================');
      })
      .addCase(loadDownloads.rejected, (state, action) => {
        console.error('[downloadSlice] ❌ loadDownloads.rejected:', action.error);
      })
      .addCase(addSyncedDownload.fulfilled, (state, action) => {
        if (action.payload) {
          const syncedDownload = action.payload;
          state.downloads.unshift(syncedDownload);
          state.stats.successCount++;
          state.stats.totalDownloaded++;
          state.stats.totalSize += syncedDownload.downloadedBytes;
          console.log('[downloadSlice] ✅ Synced download added:', syncedDownload.track.title);
        }
      })
      .addCase(deleteDownloadWithFile.fulfilled, (state, action) => {
        const { downloadId, download } = action.payload;
        
        // Actualizar estadísticas si la descarga estaba completada o tenía error
        if (download) {
          if (download.status === 'completed' && download.downloadedBytes > 0) {
            state.stats.totalSize = Math.max(0, state.stats.totalSize - download.downloadedBytes);
            state.stats.successCount = Math.max(0, state.stats.successCount - 1);
            console.log('[downloadSlice] 📊 Stats updated after file deletion - Size:', state.stats.totalSize, 'Success count:', state.stats.successCount);
          } else if (download.status === 'error') {
            state.stats.errorCount = Math.max(0, state.stats.errorCount - 1);
          }
        }
        
        // Eliminar de la lista
        state.downloads = state.downloads.filter(d => d.id !== downloadId);
        state.queue = state.queue.filter(id => id !== downloadId);
        
        if (state.currentDownloadId === downloadId) {
          state.currentDownloadId = null;
          state.isDownloading = false;
        }
        
        // Auto-guardar después de eliminar
        console.log('[downloadSlice] 💾 Auto-guardando después de eliminación...');
      });
  },
});

export const {
  addDownload,
  removeDownload,
  updateDownloadProgress,
  setDownloadStatus,
  startDownload,
  pauseDownload,
  resumeDownload,
  retryDownload,
  clearCompleted,
  clearAll,
  setIsDownloading,
  updateSettings,
} = downloadSlice.actions;

export default downloadSlice.reducer;
