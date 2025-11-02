import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Store
import store from './src/store';
import type { RootState, AppDispatch } from './src/store';
import { setUser, setToken } from './src/store/slices/authSlice';
import { loadFavorites, validateLocalFavorites } from './src/store/slices/favoritesSlice';
import { loadDownloads, autoScanDownloads } from './src/store/slices/downloadSlice';
import { loadLibrary } from './src/store/slices/librarySlice';

// Exponer store globalmente para debug
(global as any).store = store;

// Services
import { downloadQueueManager } from './src/services/DownloadQueueManager';

// Screens
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import ArtistDetailScreen from './src/screens/ArtistDetailScreen';
import AlbumDetailScreen from './src/screens/AlbumDetailScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';

// Components
import MiniPlayerWrapper from './src/components/MiniPlayerWrapper';
import FullPlayerWrapper from './src/components/FullPlayerWrapper';

// Hooks
import { useSelector, useDispatch } from 'react-redux';

// Context
import { PlayerProvider, usePlayerContext } from './src/contexts/PlayerContext';

// Typed hooks
const useAppDispatch = () => useDispatch<AppDispatch>();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const MainTabs = () => {
  const { fullPlayerVisible } = usePlayerContext();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: 'search' | 'library-music' | 'file-download' | 'settings';

          if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Library') {
            iconName = 'library-music';
          } else if (route.name === 'Downloads') {
            iconName = 'file-download';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          } else {
            iconName = 'search';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: fullPlayerVisible ? { display: 'none' } : {
          backgroundColor: '#000',
          borderTopColor: '#333',
          elevation: 0,
        },
        headerShown: !fullPlayerVisible, // Ocultar header cuando full player está visible
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{ title: 'Buscar' }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{ title: 'Biblioteca' }}
      />
      <Tab.Screen 
        name="Downloads" 
        component={DownloadsScreen}
        options={{ title: 'Descargas' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Configuración' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const authToken = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Cargar estado de autenticación al iniciar
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('qobuz_token');
        const savedUser = await AsyncStorage.getItem('qobuz_user');
        
        if (savedToken && savedUser) {
          const userData = JSON.parse(savedUser);
          dispatch(setToken(savedToken));
          dispatch(setUser(userData));
        }
        
        // Cargar favoritos y validar
        await dispatch(loadFavorites() as any);
        await dispatch(validateLocalFavorites() as any);
        
        // Cargar biblioteca (albums, artists, playlists)
        await dispatch(loadLibrary() as any);
        
        // Cargar descargas y escanear archivos
        await dispatch(loadDownloads());
        
        if (savedToken) {
          await dispatch(autoScanDownloads({ authToken: savedToken }) as any);
        }
      } catch (error) {
        console.error('[AppNavigator] Error cargando auth:', error);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    
    loadAuthState();
  }, [dispatch]);

  // Inicializar DownloadQueueManager cuando hay autenticación
  useEffect(() => {
    if (isAuthenticated && authToken) {
      downloadQueueManager.setAuthToken(authToken);
      downloadQueueManager.forceProcessQueue();
    }
  }, [isAuthenticated, authToken]);

  // Mostrar loading mientras se carga la autenticación
  if (isLoadingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#000" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  console.log('[App] Iniciando aplicación...');
  
  return (
    <Provider store={store}>
      <PlayerProvider>
        <SafeAreaProvider>
          <AppNavigator />
          <MiniPlayerWrapper />
          <FullPlayerWrapper />
        </SafeAreaProvider>
      </PlayerProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
