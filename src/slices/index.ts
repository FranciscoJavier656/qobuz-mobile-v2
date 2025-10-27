import { authSlice } from './authSlice';
import { downloadSlice } from './downloadSlice';
import { playerSlice } from './playerSlice';

export const rootReducer = {
  auth: authSlice.reducer,
  download: downloadSlice.reducer,
  player: playerSlice.reducer,
};