import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: number;
  email: string;
  display_name: string;
  subscription: any;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    login(state, action: PayloadAction<{ email: string; name: string }>) {
      state.isAuthenticated = true;
      state.user = {
        id: 0,
        email: action.payload.email,
        display_name: action.payload.name,
        subscription: null
      };
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.loading = false;
    },
  },
});

export const { setUser, setToken, setLoading, login, logout } = authSlice.actions;
export default authSlice.reducer;
