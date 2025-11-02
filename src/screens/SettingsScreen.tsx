import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';
import * as FileSystem from 'expo-file-system/legacy';

// Store
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { updateSettings, addSyncedDownload, saveDownloads } from '../store/slices/downloadSlice';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';

const QUALITY_OPTIONS = [
  { id: '5', label: 'MP3 320kbps', subtitle: 'Alta calidad, menor tamaño' },
  { id: '6', label: 'FLAC CD (16-bit/44.1kHz)', subtitle: 'Calidad CD sin pérdida' },
  { id: '7', label: 'FLAC Hi-Res (24-bit/96kHz)', subtitle: 'Alta resolución' },
  { id: '27', label: 'FLAC Studio (24-bit/192kHz)', subtitle: 'Máxima calidad disponible' },
];

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { settings } = useSelector((state: RootState) => state.download);
  const authToken = useSelector((state: RootState) => state.auth.token);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleQualityChange = (qualityId: string) => {
    console.log('[SettingsScreen] 🎯 Changing quality to:', qualityId);
    dispatch(updateSettings({ defaultQuality: qualityId }));
    setShowQualityModal(false);
  };

  const handleListDownloadFiles = async () => {
    try {
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      console.log('[SettingsScreen] 📂 Listando archivos en:', downloadsDir);
      
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      
      if (!dirInfo.exists) {
        Alert.alert('Directorio vacío', 'No existe el directorio de descargas aún.');
        return;
      }
      
      const files = await FileSystem.readDirectoryAsync(downloadsDir);
      
      console.log('[SettingsScreen] 📁 Archivos encontrados:', files.length);
      
      if (files.length === 0) {
        Alert.alert('Sin archivos', 'No hay archivos descargados en el directorio.');
        return;
      }
      
      // Obtener información detallada de cada archivo
      const filesInfo = await Promise.all(
        files.map(async (filename) => {
          const filePath = `${downloadsDir}${filename}`;
          const info = await FileSystem.getInfoAsync(filePath);
          return {
            filename,
            size: (info as any).size ? `${((info as any).size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown',
            path: filePath,
          };
        })
      );
      
      console.log('[SettingsScreen] 📋 Detalles de archivos:', filesInfo);
      
      const filesList = filesInfo.map((f, i) => 
        `${i + 1}. ${f.filename}\n   Tamaño: ${f.size}\n   Ruta: ${f.path}`
      ).join('\n\n');
      
      Alert.alert(
        `Archivos Descargados (${files.length})`,
        filesList,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      console.error('[SettingsScreen] ❌ Error listando archivos:', error);
      Alert.alert('Error', `No se pudo listar los archivos: ${error}`);
    }
  };

  const handleSyncDownloads = async () => {
    if (isSyncing) {
      Alert.alert('Sincronizando', 'Ya hay una sincronización en progreso...');
      return;
    }

    if (!authToken) {
      Alert.alert('Error', 'No hay token de autenticación. Por favor inicia sesión nuevamente.');
      return;
    }

    Alert.alert(
      'Sincronizar Descargas',
      '¿Deseas sincronizar los archivos descargados con la biblioteca? Esto buscará los metadatos en Qobuz y los agregará a tus descargas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar',
          onPress: async () => {
            setIsSyncing(true);
            try {
              const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
              const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
              
              if (!dirInfo.exists) {
                Alert.alert('Sin archivos', 'No hay directorio de descargas.');
                setIsSyncing(false);
                return;
              }
              
              const files = await FileSystem.readDirectoryAsync(downloadsDir);
              console.log('[SettingsScreen] 🔄 Sincronizando', files.length, 'archivos...');
              
              if (files.length === 0) {
                Alert.alert('Sin archivos', 'No hay archivos para sincronizar.');
                setIsSyncing(false);
                return;
              }
              
              const qobuzAPI = new QobuzAPI();
              qobuzAPI.setAuthToken(authToken);
              
              let syncedCount = 0;
              let errorCount = 0;
              
              for (const filename of files) {
                try {
                  // Extraer artista y título del nombre del archivo
                  const nameWithoutExt = filename.replace(/\.(flac|mp3)$/i, '');
                  const [artist, title] = nameWithoutExt.split(' - ');
                  
                  if (!artist || !title) {
                    console.log('[SettingsScreen] ⚠️ No se pudo parsear:', filename);
                    errorCount++;
                    continue;
                  }
                  
                  console.log('[SettingsScreen] 🔍 Buscando:', artist, '-', title);
                  
                  // Buscar en Qobuz
                  const searchQuery = `${artist} ${title}`;
                  const searchResults = await qobuzAPI.searchTracks(searchQuery, 5);
                  
                  if (searchResults && searchResults.length > 0) {
                    // Tomar el primer resultado
                    const track = searchResults[0];
                    const filePath = `${downloadsDir}${filename}`;
                    
                    // Determinar calidad basado en extensión
                    const extension = filename.toLowerCase().endsWith('.mp3') ? 'mp3' : 'flac';
                    const quality = extension === 'mp3' ? '5' : '27'; // MP3 320kbps o FLAC Studio
                    
                    console.log('[SettingsScreen] ✅ Track encontrado:', track.title, 'by', track.performer?.name);
                    
                    // Agregar como descarga completada
                    await dispatch(addSyncedDownload({
                      track,
                      localPath: filePath,
                      quality
                    }) as any);
                    
                    syncedCount++;
                  } else {
                    console.log('[SettingsScreen] ❌ No se encontró en Qobuz:', searchQuery);
                    errorCount++;
                  }
                } catch (error) {
                  console.error('[SettingsScreen] ❌ Error procesando', filename, ':', error);
                  errorCount++;
                }
              }
              
              // Guardar descargas en AsyncStorage
              await dispatch(saveDownloads() as any);
              
              Alert.alert(
                'Sincronización Completa',
                `✅ Sincronizados: ${syncedCount}\n❌ Errores: ${errorCount}\n\nLos tracks sincronizados ahora aparecen en "Descargas". Puedes agregarlos a favoritos manualmente si lo deseas.`,
                [{ text: 'OK' }]
              );
              
              console.log('[SettingsScreen] 🎉 Sincronización completada:', syncedCount, 'éxitos,', errorCount, 'errores');
            } catch (error) {
              console.error('[SettingsScreen] ❌ Error en sincronización:', error);
              Alert.alert('Error', `No se pudo completar la sincronización: ${error}`);
            } finally {
              setIsSyncing(false);
            }
          }
        }
      ]
    );
  };

  const getQualityLabel = () => {
    const quality = QUALITY_OPTIONS.find(q => q.id === settings.defaultQuality);
    return quality?.label || 'FLAC Studio (24-bit/192kHz)';
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
          subtitle={getQualityLabel()}
          onPress={() => setShowQualityModal(true)}
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
          icon="sync"
          title="Sincronizar Descargas"
          subtitle={isSyncing ? "Sincronizando..." : "Obtener metadatos de archivos descargados"}
          onPress={handleSyncDownloads}
        />
        
        <SettingItem
          icon="list"
          title="Listar Archivos Descargados"
          subtitle="Ver archivos en el directorio"
          onPress={handleListDownloadFiles}
        />
        
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

      {/* Modal de Selección de Calidad */}
      <Modal
        visible={showQualityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQualityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calidad de Audio</Text>
              <TouchableOpacity onPress={() => setShowQualityModal(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={QUALITY_OPTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.qualityOption,
                    settings.defaultQuality === item.id && styles.qualityOptionSelected
                  ]}
                  onPress={() => handleQualityChange(item.id)}
                >
                  <View style={styles.qualityInfo}>
                    <Text style={[
                      styles.qualityLabel,
                      settings.defaultQuality === item.id && styles.qualityLabelSelected
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={styles.qualitySubtitle}>{item.subtitle}</Text>
                  </View>
                  {settings.defaultQuality === item.id && (
                    <Icon name="check" size={24} color="#1DB954" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  qualityOptionSelected: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  qualityInfo: {
    flex: 1,
  },
  qualityLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  qualityLabelSelected: {
    color: '#1DB954',
  },
  qualitySubtitle: {
    color: '#666',
    fontSize: 14,
  },
});

export default SettingsScreen;
