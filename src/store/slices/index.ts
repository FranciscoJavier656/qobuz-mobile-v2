import { authSlice } from './authSlice';
import { downloadSlice } from './downloadSlice';
import { playerSlice } from './playerSlice';
import libraryReducer from './librarySlice';

export const rootReducer = {
  auth: authSlice.reducer,
  download: downloadSlice.reducer,
  player: playerSlice.reducer,
  library: libraryReducer,
};