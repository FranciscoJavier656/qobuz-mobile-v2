import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import Icon from '@expo/vector-icons/MaterialIcons';

// Types & Store
import { RootState } from '../store';
import { removeDownload } from '../store/slices/downloadSlice';

const DownloadsScreen = () => {
  const dispatch = useDispatch();
  const downloads = useSelector((state: RootState) => state.download.downloads) || [];

  const handleRemove = (trackId: string) => {
    dispatch(removeDownload(trackId));
  };

  const handleRetry = (trackId: string) => {
    // TODO: Implementar retry
    console.log('Retry download:', trackId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Icon name="check-circle" size={24} color="#1DB954" />;
      case 'downloading':
        return <Icon name="download" size={24} color="#FFA500" />;
      case 'error':
        return <Icon name="error" size={24} color="#FF4444" />;
      default:
        return <Icon name="schedule" size={24} color="#666" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'downloading':
        return 'Descargando...';
      case 'error':
        return 'Error';
      default:
        return 'En cola';
    }
  };

  const renderDownloadItem = ({ item }: { item: any }) => (
    <View style={styles.downloadItem}>
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {item.artist}
        </Text>
        <View style={styles.statusContainer}>
          {getStatusIcon(item.status)}
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
        {item.progress > 0 && (
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${item.progress}%` }]} 
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {item.status === 'error' && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleRetry(item.id)}
          >
            <Icon name="refresh" size={20} color="#FFA500" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleRemove(item.id)}
        >
          <Icon name="close" size={20} color="#FF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#1DB954';
      case 'downloading':
        return '#FFA500';
      case 'error':
        return '#FF4444';
      default:
        return '#666';
    }
  };

  const getQueueStats = () => {
    const completed = downloads.filter(item => item.status === 'completed').length;
    const downloading = downloads.filter(item => item.status === 'downloading').length;
    const failed = downloads.filter(item => item.status === 'error').length;
    const pending = downloads.filter(item => item.status === 'pending').length;

    return { completed, downloading, failed, pending };
  };

  const stats = getQueueStats();

  return (
    <SafeAreaView style={styles.container}>
      {downloads.length > 0 ? (
        <>
          {/* Stats Header */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completadas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.downloading}</Text>
              <Text style={styles.statLabel}>Descargando</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.failed}</Text>
              <Text style={styles.statLabel}>Errores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>En cola</Text>
            </View>
          </View>

          {/* Downloads List */}
          <FlatList
            data={downloads}
            renderItem={renderDownloadItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="download" size={64} color="#333" />
          <Text style={styles.emptyText}>
            No hay descargas en cola
          </Text>
          <Text style={styles.emptySubtext}>
            Busca música y agrégala a la cola de descargas
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  downloadItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 15,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  trackArtist: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  progressBar: {
    backgroundColor: '#333',
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  progressFill: {
    backgroundColor: '#1DB954',
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DownloadsScreen;
