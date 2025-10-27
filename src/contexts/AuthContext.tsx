import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

interface User {
  id: number;
  email: string;
  display_name: string;
  subscription: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const qobuzAPI = new QobuzAPI();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar estado de autenticación al iniciar
  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('qobuz_token');
      const savedUser = await AsyncStorage.getItem('qobuz_user');
      
      console.log('[AuthContext] Auth guardado:', { hasToken: !!savedToken, hasUser: !!savedUser });
      
      if (savedToken && savedUser) {
        const userData = JSON.parse(savedUser);
        console.log('[AuthContext] Datos a restaurar:', { token: savedToken.substring(0, 20) + '...', userData });
        
        setToken(savedToken);
        setUser(userData);
        console.log('[AuthContext] Sesión restaurada');
      }
    } catch (error) {
      console.error('[AuthContext] Error cargando auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Intentando login...');
      const loginResult = await qobuzAPI.login(email, password);
      
      if (loginResult && loginResult.user_auth_token) {
        const userData: User = {
          id: loginResult.user?.id || 0,
          email: email,
          display_name: loginResult.user?.display_name || email,
          subscription: loginResult.user?.subscription || null
        };
        
        // Guardar en storage
        await AsyncStorage.setItem('qobuz_token', loginResult.user_auth_token);
        await AsyncStorage.setItem('qobuz_user', JSON.stringify(userData));
        
        // Actualizar estado
        setToken(loginResult.user_auth_token);
        setUser(userData);
        
        console.log('[AuthContext] Login exitoso');
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      console.log('[AuthContext] Cerrando sesión...');
      
      // Limpiar storage
      await AsyncStorage.removeItem('qobuz_token');
      await AsyncStorage.removeItem('qobuz_user');
      
      // Limpiar estado
      setToken(null);
      setUser(null);
      
      console.log('[AuthContext] Sesión cerrada');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
