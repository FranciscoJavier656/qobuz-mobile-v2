import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      console.log('[downloadSlice] 📂 Cargando descargas desde AsyncStorage...');
      const downloadsJson = await AsyncStorage.getItem('downloads');
      const statsJson = await AsyncStorage.getItem('downloads_stats');
      
      if (downloadsJson) {
        const downloads = JSON.parse(downloadsJson);
        const stats = statsJson ? JSON.parse(statsJson) : initialState.stats;
        console.log('[downloadSlice] ✅ Descargas cargadas:', downloads.length, 'tracks');
        console.log('[downloadSlice] 📊 Stats:', stats);
        return { downloads, stats };
      }
      
      console.log('[downloadSlice] ℹ️ No hay descargas guardadas');
      return { downloads: [], stats: initialState.stats };
    } catch (error) {
      console.error('[downloadSlice] ❌ Error cargando descargas:', error);
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
      
      // Solo guardar descargas completadas para evitar inconsistencias
      const completedDownloads = state.download.downloads.filter(d => d.status === 'completed');
      
      await AsyncStorage.setItem('downloads', JSON.stringify(completedDownloads));
      await AsyncStorage.setItem('downloads_stats', JSON.stringify(state.download.stats));
      
      console.log('[downloadSlice] ✅ Descargas guardadas en AsyncStorage:', completedDownloads.length, 'tracks');
      return true;
    } catch (error) {
      console.error('[downloadSlice] ❌ Error guardando descargas:', error);
      return false;
    }
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
      
      // Verificar si ya existe
      const exists = state.downloads.find(d => d.track.id === track.id);
      if (exists) return;

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
      .addCase(loadDownloads.fulfilled, (state, action) => {
        const { downloads, stats } = action.payload;
        state.downloads = downloads;
        state.stats = stats;
        console.log('[downloadSlice] ✅ Estado de descargas restaurado');
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
