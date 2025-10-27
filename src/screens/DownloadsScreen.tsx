import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { Audio } from 'expo-av';
import type { RootState, AppDispatch } from '../store';
import {
  removeDownload,
  pauseDownload,
  resumeDownload,
  retryDownload,
  clearCompleted,
  clearAll,
  deleteDownloadWithFile,
  type DownloadItem,
  type DownloadSliceState,
} from '../slices/downloadSlice';
import { usePlayerContext } from '../contexts/PlayerContext';

// Selectores memoizados
const selectDownloadsByStatus = createSelector(
  [(state: RootState) => state.download.downloads],
  (downloads) => ({
    downloading: downloads.filter(d => d.status === 'downloading'),
    pending: downloads.filter(d => d.status === 'pending'),
    completed: downloads.filter(d => d.status === 'completed'),
    paused: downloads.filter(d => d.status === 'paused'),
    error: downloads.filter(d => d.status === 'error'),
  })
);

const selectDownloadStats = createSelector(
  [(state: RootState) => state.download as DownloadSliceState],
  (download: DownloadSliceState) => {
    // CALCULAR estadísticas dinámicamente desde las descargas actuales
    const downloads = download.downloads ?? [];
    
    // Solo contar descargas con status === 'completed'
    const completedDownloads = downloads.filter(d => d.status === 'completed');
    const errorDownloads = downloads.filter(d => d.status === 'error');
    const activeDownloads = downloads.filter(d => 
      d.status === 'downloading' || d.status === 'pending'
    );
    
    // Calcular tamaño total SOLO de descargas completadas
    // Usar totalBytes para descargas completadas (tamaño final del archivo)
    const totalSize = completedDownloads.reduce((sum, d) => {
      const size = d.totalBytes || 0;
      return sum + size;
    }, 0);
    
    return {
      totalDownloads: downloads.length,
      activeDownloads: activeDownloads.length,
      completedDownloads: completedDownloads.length,
      totalSize: totalSize,
      errors: errorDownloads.length,
    };
  }
);

const DownloadsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const [filter, setFilter] = useState<'all' | 'downloading' | 'completed' | 'error'>('all');
  
  const downloadsByStatus = useSelector(selectDownloadsByStatus);
  const stats = useSelector(selectDownloadStats);
  
  // Obtener el contexto del player
  const playerContext = usePlayerContext();

  // Función para reproducir archivo local descargado
  const handlePlayDownloadedTrack = async (download: DownloadItem) => {
    if (!download.localPath) {
      Alert.alert('Error', 'No se encontró el archivo de audio');
      return;
    }

    try {
      console.log('[DownloadsScreen] 🎵 Playing local file:', download.localPath);
      
      // Detener y limpiar sonido anterior si existe
      if (playerContext.sound) {
        try {
          const status = await playerContext.sound.getStatusAsync();
          if (status.isLoaded) {
            await playerContext.sound.stopAsync();
          }
          await playerContext.sound.unloadAsync();
        } catch (cleanupError) {
          console.log('[DownloadsScreen] ⚠️ Error cleaning up previous sound:', cleanupError);
          // Continuar de todos modos
        }
        playerContext.setSound(null);
      }
      
      // Configurar el modo de audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Crear y reproducir el sonido desde el archivo local
      const { sound } = await Audio.Sound.createAsync(
        { uri: download.localPath },
        { shouldPlay: true }
      );

      // Configurar callback de actualización de estado
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          playerContext.setIsPlaying(status.isPlaying);
        }
      });

      // Crear track con localUri incluido para favoritos
      const trackWithLocalUri = {
        ...download.track,
        localUri: download.localPath,
        local_file_uri: download.localPath, // Alias por compatibilidad
      };

      // Actualizar el contexto del player
      playerContext.setSound(sound);
      playerContext.setCurrentTrack(trackWithLocalUri); // Usar track con localUri
      playerContext.setIsPlaying(true);
      playerContext.setMiniPlayerVisible(true);
      playerContext.setIsLocalFile(true);

      console.log('[DownloadsScreen] ✅ Playing local track:', download.track.title);
      console.log('[DownloadsScreen] 📁 Local URI saved in track:', download.localPath);
      
    } catch (error) {
      console.error('[DownloadsScreen] ❌ Error playing local track:', error);
      Alert.alert('Error', 'No se pudo reproducir el archivo de audio');
    }
  };

  // Función para formatear bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Obtener descargas filtradas
  const filteredDownloads = useMemo(() => {
    switch (filter) {
      case 'downloading':
        return [...downloadsByStatus.downloading, ...downloadsByStatus.pending, ...downloadsByStatus.paused];
      case 'completed':
        return downloadsByStatus.completed;
      case 'error':
        return downloadsByStatus.error;
      default:
        return [
          ...downloadsByStatus.downloading,
          ...downloadsByStatus.pending,
          ...downloadsByStatus.paused,
          ...downloadsByStatus.completed,
          ...downloadsByStatus.error,
        ];
    }
  }, [filter, downloadsByStatus]);

  const handleExploreMusic = () => {
    navigation.navigate('Search' as never);
  };

  // Renderizar estado vacío
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <BlurView intensity={20} tint="dark" style={styles.emptyStateBlur}>
        <LinearGradient
          colors={['rgba(29, 185, 84, 0.1)', 'rgba(29, 185, 84, 0.05)']}
          style={styles.emptyStateGradient}
        >
          <MaterialIcons name="file-download" size={80} color="rgba(29, 185, 84, 0.3)" />
          <Text style={styles.emptyStateTitle}>Sin descargas</Text>
          <Text style={styles.emptyStateText}>
            Descarga música para escucharla sin conexión
          </Text>
          <TouchableOpacity style={styles.exploreButton} onPress={handleExploreMusic}>
            <BlurView intensity={40} tint="dark" style={styles.exploreButtonBlur}>
              <LinearGradient
                colors={['rgba(29, 185, 84, 0.4)', 'rgba(29, 185, 84, 0.2)']}
                style={styles.exploreButtonGradient}
              >
                <MaterialIcons name="search" size={20} color="#fff" />
                <Text style={styles.exploreButtonText}>Explorar música</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        </LinearGradient>
      </BlurView>
    </View>
  );

  // Obtener icono de estado
  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading':
        return 'downloading';
      case 'completed':
        return 'check-circle';
      case 'error':
        return 'error';
      case 'paused':
        return 'pause-circle-filled';
      case 'pending':
        return 'schedule';
      default:
        return 'help-outline';
    }
  };

  // Obtener color de estado
  const getStatusColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading':
        return '#1E90FF';
      case 'completed':
        return '#1DB954';
      case 'error':
        return '#FF4444';
      case 'paused':
        return '#FFA500';
      case 'pending':
        return '#9B59B6';
      default:
        return 'rgba(255,255,255,0.4)';
    }
  };

  // Renderizar card de descarga
  const renderDownloadCard = ({ item, index }: { item: DownloadItem; index: number }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <View style={styles.downloadCard}>
        <BlurView intensity={15} tint="dark" style={styles.downloadCardBlur}>
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
            style={styles.downloadCardGradient}
          >
            {/* Album Art */}
            <Image
              source={{
                uri: item.track.album?.image?.large || 'https://via.placeholder.com/80',
              }}
              style={styles.albumArt}
            />

            {/* Info */}
            <View style={styles.downloadInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.track.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {item.track.performer?.name || 'Unknown Artist'}
              </Text>

              {/* Barra de progreso */}
              {(item.status === 'downloading' || item.status === 'paused' || item.status === 'pending') ? (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {item.status === 'pending' ? 'En cola' : `${Math.round(item.progress)}%`}
                  </Text>
                </View>
              ) : null}

              {/* Info adicional */}
              <View style={styles.additionalInfo}>
                {item.status === 'pending' && (
                  <Text style={styles.infoText}>
                    Esperando para descargar...
                  </Text>
                )}
                {item.status === 'downloading' && (
                  <>
                    <Text style={styles.infoText}>
                      {formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}
                    </Text>
                    <Text style={styles.infoText}>•</Text>
                    <Text style={styles.infoText}>
                      {formatBytes(item.speed)}/s
                    </Text>
                  </>
                )}
                {item.status === 'completed' && (
                  <Text style={styles.infoText}>
                    {formatBytes(item.totalBytes)}
                  </Text>
                )}
                {item.status === 'error' && item.error && (
                  <Text style={[styles.infoText, { color: '#FF4444' }]} numberOfLines={1}>
                    {item.error}
                  </Text>
                )}
              </View>
            </View>

            {/* Controles */}
            <View style={styles.controls}>
              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <MaterialIcons name={statusIcon} size={16} color={statusColor} />
              </View>

              {/* Botones de acción */}
              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => dispatch(deleteDownloadWithFile(item.id))}
                >
                  <MaterialIcons name="cancel" size={20} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}

              {item.status === 'downloading' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => dispatch(pauseDownload(item.id))}
                >
                  <MaterialIcons name="pause" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {item.status === 'paused' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => dispatch(resumeDownload(item.id))}
                >
                  <MaterialIcons name="play-arrow" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {item.status === 'error' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => dispatch(retryDownload(item.id))}
                >
                  <MaterialIcons name="refresh" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {item.status === 'completed' && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => handlePlayDownloadedTrack(item)}
                >
                  <MaterialIcons name="play-arrow" size={20} color="#1DB954" />
                </TouchableOpacity>
              )}

              {/* Botón eliminar */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => dispatch(deleteDownloadWithFile(item.id))}
              >
                <MaterialIcons name="delete" size={20} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    );
  };

  // Renderizar header con estadísticas
  const renderHeader = () => (
    <BlurView intensity={20} tint="dark" style={styles.headerBlur}>
      <LinearGradient
        colors={['rgba(29, 185, 84, 0.15)', 'rgba(0, 0, 0, 0.3)']}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Descargas</Text>
            <Text style={styles.headerSubtitle}>
              {stats.totalDownloads} {stats.totalDownloads === 1 ? 'archivo' : 'archivos'}
            </Text>
          </View>
          
          {stats.totalDownloads > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => dispatch(clearAll())}
            >
              <LinearGradient
                colors={['rgba(255,68,68,0.3)', 'rgba(255,68,68,0.1)']}
                style={styles.clearButtonGradient}
              >
                <MaterialIcons name="delete-sweep" size={20} color="#FF4444" />
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <BlurView intensity={15} tint="dark" style={styles.statCardBlur}>
              <MaterialIcons name="downloading" size={24} color="#1E90FF" />
              <Text style={styles.statValue}>{stats.activeDownloads}</Text>
              <Text style={styles.statLabel}>Activas</Text>
            </BlurView>
          </View>
          
          <View style={styles.statCard}>
            <BlurView intensity={15} tint="dark" style={styles.statCardBlur}>
              <MaterialIcons name="check-circle" size={24} color="#1DB954" />
              <Text style={styles.statValue}>{stats.completedDownloads}</Text>
              <Text style={styles.statLabel}>Completadas</Text>
            </BlurView>
          </View>
          
          <View style={styles.statCard}>
            <BlurView intensity={15} tint="dark" style={styles.statCardBlur}>
              <MaterialIcons name="storage" size={24} color="#FFA500" />
              <Text style={styles.statValue}>{formatBytes(stats.totalSize)}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </BlurView>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'downloading' && styles.filterButtonActive]}
            onPress={() => setFilter('downloading')}
          >
            <Text style={[styles.filterButtonText, filter === 'downloading' && styles.filterButtonTextActive]}>
              Descargando
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterButtonText, filter === 'completed' && styles.filterButtonTextActive]}>
              Completadas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'error' && styles.filterButtonActive]}
            onPress={() => setFilter('error')}
          >
            <Text style={[styles.filterButtonText, filter === 'error' && styles.filterButtonTextActive]}>
              Errores
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </BlurView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#0a0a0a', '#000000', '#000000']}
        style={styles.gradient}
      >
        {stats.totalDownloads > 0 ? (
          <>
            <View style={styles.header}>
              {renderHeader()}
            </View>
            <FlatList
              data={filteredDownloads}
              renderItem={renderDownloadCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          <View style={styles.content}>
            {renderEmptyState()}
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  header: {
    marginBottom: 8,
  },
  headerBlur: {
    overflow: 'hidden',
    borderRadius: 24,
    margin: 16,
  },
  headerGradient: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  clearButton: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  clearButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  clearButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
  statCardBlur: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterButtonActive: {
    backgroundColor: '#1DB954',
  },
  filterButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyStateGradient: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 8,
  },
  exploreButton: {
    overflow: 'hidden',
    borderRadius: 24,
    marginTop: 8,
  },
  exploreButtonBlur: {
    overflow: 'hidden',
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 10,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadCard: {
    marginBottom: 12,
  },
  downloadCardBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  downloadCardGradient: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  downloadInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trackArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  additionalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DownloadsScreen;
