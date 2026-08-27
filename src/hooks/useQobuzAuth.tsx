import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '../store';
import { setUser, setToken, logout as logoutAction, setLoading } from '../store/slices/authSlice';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

const qobuzAPI = new QobuzAPI();

export const useQobuzAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading } = useSelector(
    (state: RootState) => state.auth
  );

  const loadAuthState = async () => {
    try {
      dispatch(setLoading(true));
      const savedToken = await AsyncStorage.getItem('qobuz_token');
      const savedUser = await AsyncStorage.getItem('qobuz_user');
      
      if (savedToken && savedUser) {
        dispatch(setToken(savedToken));
        dispatch(setUser(JSON.parse(savedUser)));
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch(setLoading(true));
      
      const loginResult = await qobuzAPI.login(email, password);
      
      if (loginResult && loginResult.user_auth_token) {
        const userData = {
          id: loginResult.user?.id || 0,
          email: email,
          display_name: loginResult.user?.display_name || email,
          subscription: loginResult.user?.subscription || null
        };
        
        // Save to storage
        await AsyncStorage.setItem('qobuz_token', loginResult.user_auth_token);
        await AsyncStorage.setItem('qobuz_user', JSON.stringify(userData));
        
        // Update Redux state
        dispatch(setToken(loginResult.user_auth_token));
        dispatch(setUser(userData));
        
        return loginResult;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    } finally {
      dispatch(setLoading(false));
    }
  };

  const logout = async () => {
    try {
      // Clear storage
      await AsyncStorage.removeItem('qobuz_token');
      await AsyncStorage.removeItem('qobuz_user');
      
      // Clear Redux state
      dispatch(logoutAction());
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const checkAuthStatus = async () => {
    if (!token) return false;
    
    try {
      // Here you could verify token with API if needed
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      await logout();
      return false;
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    checkAuthStatus,
    loadAuthState,
  };
};
