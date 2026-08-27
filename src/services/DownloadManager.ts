import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { QobuzAPI } from './qobuz/QobuzAPI';
import type { Track } from './qobuz/types';
import type { DownloadItem } from '../store/slices/downloadSlice';

interface DownloadResumable {
  downloadAsync: () => Promise<FileSystem.FileSystemDownloadResult | undefined>;
  pauseAsync: () => Promise<FileSystem.DownloadPauseState>;
  resumeAsync: () => Promise<FileSystem.FileSystemDownloadResult | undefined>;
}

export class DownloadManager {
  private static instance: DownloadManager;
  private qobuzAPI: QobuzAPI;
  private activeDownloads: Map<string, DownloadResumable> = new Map();

  private constructor() {
    this.qobuzAPI = new QobuzAPI();
  }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  public setAuthToken(token: string) {
    this.qobuzAPI.setAuthToken(token);
  }

  /**
   * Inicia la descarga de un track
   */
  public async startDownload(
    download: DownloadItem,
    onProgress: (data: {
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
      speed: number;
      timeRemaining: number;
    }) => void,
    onComplete: (localPath: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      console.log('[DownloadManager] 📥 Starting download for:', download.track.title);
      console.log('[DownloadManager] 📊 Quality requested:', download.quality);
      
      // Usar getTrackFileUrl que respeta el format_id correctamente
      // Convertir quality string a number
      const formatId = parseInt(download.quality, 10);
      
      const streamUrl = await this.qobuzAPI.getTrackFileUrl(
        download.track.id,
        formatId,
        'stream' // Usar 'stream' porque downloadable=false en estas canciones
      );

      if (!streamUrl) {
        throw new Error('No se pudo obtener la URL de streaming');
      }
      
      console.log('[DownloadManager] ✅ Stream URL obtained, starting file download...');

      // Preparar directorio y nombre de archivo
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });

      const sanitizedTitle = this.sanitizeFileName(download.track.title);
      const sanitizedArtist = this.sanitizeFileName(download.track.performer?.name || 'Unknown');
      const extension = this.getExtensionForQuality(download.quality);
      const fileName = `${sanitizedArtist} - ${sanitizedTitle}.${extension}`;
      const fileUri = `${downloadsDir}${fileName}`;

      // Crear callback de progreso
      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
        const speed = this.calculateSpeed(downloadProgress.totalBytesWritten, download.startedAt || Date.now());
        const timeRemaining = this.calculateTimeRemaining(
          downloadProgress.totalBytesExpectedToWrite - downloadProgress.totalBytesWritten,
          speed
        );

        onProgress({
          progress: Math.min(99, Math.round(progress)),
          downloadedBytes: downloadProgress.totalBytesWritten,
          totalBytes: downloadProgress.totalBytesExpectedToWrite,
          speed,
          timeRemaining,
        });
      };

      // Crear resumable download con headers
      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        fileUri,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        },
        callback
      );

      // Guardar la descarga activa
      this.activeDownloads.set(download.id, downloadResumable as DownloadResumable);

      // Iniciar descarga
      const result = await downloadResumable.downloadAsync();

      if (result) {
        onComplete(result.uri);
        this.activeDownloads.delete(download.id);
      }
    } catch (error: any) {
      console.error('[DownloadManager] Error:', error);
      this.activeDownloads.delete(download.id);
      onError(error.message || 'Error desconocido');
    }
  }

  /**
   * Pausa una descarga activa
   */
  public async pauseDownload(downloadId: string): Promise<boolean> {
    try {
      const downloadResumable = this.activeDownloads.get(downloadId);
      if (downloadResumable) {
        await downloadResumable.pauseAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DownloadManager] Pause error:', error);
      return false;
    }
  }

  /**
   * Reanuda una descarga pausada
   */
  public async resumeDownload(downloadId: string): Promise<boolean> {
    try {
      const downloadResumable = this.activeDownloads.get(downloadId);
      if (downloadResumable) {
        await downloadResumable.resumeAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DownloadManager] Resume error:', error);
      return false;
    }
  }

  /**
   * Cancela y elimina una descarga
   */
  public async cancelDownload(downloadId: string): Promise<boolean> {
    try {
      const downloadResumable = this.activeDownloads.get(downloadId);
      if (downloadResumable) {
        await downloadResumable.pauseAsync();
        this.activeDownloads.delete(downloadId);
      }
      return true;
    } catch (error) {
      console.error('[DownloadManager] Cancel error:', error);
      return false;
    }
  }

  /**
   * Elimina un archivo descargado
   */
  public async deleteDownloadedFile(localPath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DownloadManager] Delete error:', error);
      return false;
    }
  }

  /**
   * Obtiene información de un archivo descargado
   */
  public async getDownloadedFileInfo(localPath: string): Promise<FileSystem.FileInfo | null> {
    try {
      return await FileSystem.getInfoAsync(localPath);
    } catch (error) {
      console.error('[DownloadManager] Get file info error:', error);
      return null;
    }
  }

  /**
   * Verifica si hay suficiente espacio en disco
   */
  public async hasEnoughSpace(requiredBytes: number): Promise<boolean> {
    try {
      const freeDiskSpace = await FileSystem.getFreeDiskStorageAsync();
      return freeDiskSpace > requiredBytes + (100 * 1024 * 1024); // +100MB de buffer
    } catch (error) {
      console.error('[DownloadManager] Check space error:', error);
      return true; // Asumir que hay espacio si falla la verificación
    }
  }

  // Utilidades privadas

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // Limitar longitud
  }

  private getExtensionForQuality(quality: string): string {
    switch (quality) {
      case '5':
        return 'mp3';
      case '6':
      case '7':
      case '27':
        return 'flac';
      default:
        return 'mp3';
    }
  }

  private calculateSpeed(bytesDownloaded: number, startTime: number): number {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    return elapsedSeconds > 0 ? bytesDownloaded / elapsedSeconds : 0;
  }

  private calculateTimeRemaining(bytesRemaining: number, speed: number): number {
    return speed > 0 ? Math.round(bytesRemaining / speed) : 0;
  }

  /**
   * Formatea bytes a formato legible
   */
  public static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Formatea velocidad de descarga
   */
  public static formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }

  /**
   * Formatea tiempo restante
   */
  public static formatTimeRemaining(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  /**
   * Obtiene el nombre de calidad legible
   */
  public static getQualityName(quality: string): string {
    const qualities: Record<string, string> = {
      '5': 'MP3 320kbps',
      '6': 'FLAC 16/44.1',
      '7': 'FLAC 24/96',
      '27': 'FLAC 24/192',
    };
    return qualities[quality] || 'Unknown';
  }
}
