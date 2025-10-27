import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';

// Store
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: () => dispatch(logout())
        },
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Icon name={icon as any} size={24} color="#1DB954" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightComponent || (
        onPress && <Icon name="chevron-right" size={24} color="#666" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* User Info */}
      <View style={styles.userSection}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={32} color="#1DB954" />
          </View>
          <View>
            <Text style={styles.userName}>{user?.display_name || 'Usuario'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'email@ejemplo.com'}</Text>
          </View>
        </View>
      </View>

      {/* Settings Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audio</Text>
        
        <SettingItem
          icon="headset"
          title="Calidad de Audio"
          subtitle="Alta (320kbps)"
          onPress={() => {}}
        />
        
        <SettingItem
          icon="volume-up"
          title="Reproducción en Background"
          rightComponent={<Switch value={true} onValueChange={() => {}} />}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descargas</Text>
        
        <SettingItem
          icon="folder"
          title="Carpeta de Descargas"
          subtitle="/storage/emulated/0/Music"
          onPress={() => {}}
        />
        
        <SettingItem
          icon="wifi"
          title="Solo Wi-Fi"
          subtitle="Descargar solo con Wi-Fi"
          rightComponent={<Switch value={false} onValueChange={() => {}} />}
        />
        
        <SettingItem
          icon="storage"
          title="Gestionar Almacenamiento"
          subtitle="Ver espacio usado"
          onPress={() => {}}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        
        <SettingItem
          icon="palette"
          title="Tema"
          subtitle="Oscuro"
          onPress={() => {}}
        />
        
        <SettingItem
          icon="language"
          title="Idioma"
          subtitle="Español"
          onPress={() => {}}
        />
        
        <SettingItem
          icon="info"
          title="Acerca de"
          subtitle="Versión 2.0.0"
          onPress={() => {}}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        
        <SettingItem
          icon="sync"
          title="Sincronizar"
          subtitle="Última sincronización: hace 2 horas"
          onPress={() => {}}
        />
        
        <SettingItem
          icon="help"
          title="Ayuda y Soporte"
          onPress={() => {}}
        />
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color="#FF4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  userSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingBottom: 10,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 20,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 15,
  },
});

export default SettingsScreen;
