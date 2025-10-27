import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DownloadState } from '../../types/download';

interface DownloadSliceState {
  downloads: DownloadState[];
  isDownloading: boolean;
}

const initialState: DownloadSliceState = {
  downloads: [],
  isDownloading: false,
};

const downloadSlice = createSlice({
  name: 'download',
  initialState,
  reducers: {
    addDownload(state, action: PayloadAction<DownloadState>) {
      state.downloads.push(action.payload);
    },
    removeDownload(state, action: PayloadAction<string>) {
      state.downloads = state.downloads.filter(download => download.id !== action.payload);
    },
    updateDownloadProgress(state, action: PayloadAction<{ id: string; progress: number }>) {
      const download = state.downloads.find(download => download.id === action.payload.id);
      if (download) {
        download.progress = action.payload.progress;
      }
    },
    setIsDownloading(state, action: PayloadAction<boolean>) {
      state.isDownloading = action.payload;
    },
  },
});

export const { addDownload, removeDownload, updateDownloadProgress, setIsDownloading } = downloadSlice.actions;

export default downloadSlice.reducer;