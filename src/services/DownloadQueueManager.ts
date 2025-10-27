import store from '../store';
import { DownloadManager } from './DownloadManager';
import {
  updateDownloadProgress,
  setDownloadStatus,
  startDownload as startDownloadAction,
  type DownloadItem,
} from '../slices/downloadSlice';
import { addMetadataFromTrack } from '../store/slices/librarySlice';

/**
 * Gestor de cola de descargas
 * Procesa las descargas pendientes de forma automática
 */
export class DownloadQueueManager {
  private static instance: DownloadQueueManager;
  private downloadManager: DownloadManager;
  private isProcessing = false;
  private maxConcurrentDownloads = 3;
  private currentDownloads = 0;

  private constructor() {
    this.downloadManager = DownloadManager.getInstance();
    this.startQueueProcessor();
  }

  public static getInstance(): DownloadQueueManager {
    if (!DownloadQueueManager.instance) {
      DownloadQueueManager.instance = new DownloadQueueManager();
    }
    return DownloadQueueManager.instance;
  }

  /**
   * Configura el token de autenticación
   */
  public setAuthToken(token: string) {
    this.downloadManager.setAuthToken(token);
  }

  /**
   * Configura el número máximo de descargas concurrentes
   */
  public setMaxConcurrentDownloads(max: number) {
    this.maxConcurrentDownloads = max;
  }

  /**
   * Inicia el procesador de cola
   */
  private startQueueProcessor() {
    // Verificar la cola cada 2 segundos
    setInterval(() => {
      this.processQueue();
    }, 2000);
  }

  /**
   * Procesa la cola de descargas pendientes
   */
  private async processQueue() {
    if (this.isProcessing) return;

    const state = store.getState();
    const { downloads, settings } = state.download;

    // Obtener descargas pendientes
    const pendingDownloads = downloads.filter((d: DownloadItem) => d.status === 'pending');
    
    // Obtener descargas activas
    const activeDownloads = downloads.filter((d: DownloadItem) => d.status === 'downloading');
    this.currentDownloads = activeDownloads.length;

    // Si no hay descargas pendientes o ya llegamos al límite, no hacer nada
    if (pendingDownloads.length === 0 || this.currentDownloads >= (settings.maxConcurrent || this.maxConcurrentDownloads)) {
      return;
    }

    // Iniciar la siguiente descarga
    const nextDownload = pendingDownloads[0];
    await this.startDownload(nextDownload);
  }

  /**
   * Inicia una descarga individual
   */
  private async startDownload(download: DownloadItem) {
    this.isProcessing = true;

    try {
      console.log(`[DownloadQueue] Iniciando descarga: ${download.track.title}`);

      // Actualizar estado a "downloading"
      store.dispatch(startDownloadAction(download.id));

      // Iniciar la descarga
      await this.downloadManager.startDownload(
        download,
        // onProgress
        (progressData) => {
          store.dispatch(updateDownloadProgress({
            id: download.id,
            ...progressData,
          }));
        },
        // onComplete
        (localPath) => {
          console.log(`[DownloadQueue] Descarga completada: ${download.track.title}`);
          store.dispatch(setDownloadStatus({
            id: download.id,
            status: 'completed',
            localPath,
          }));
          
          // Agregar metadatos del track a la biblioteca
          console.log('[DownloadQueue] Agregando metadatos a biblioteca...');
          store.dispatch(addMetadataFromTrack(download.track));
          
          this.currentDownloads--;
          this.processQueue(); // Procesar siguiente
        },
        // onError
        (error) => {
          console.error(`[DownloadQueue] Error en descarga: ${download.track.title}`, error);
          store.dispatch(setDownloadStatus({
            id: download.id,
            status: 'error',
            error,
          }));
          this.currentDownloads--;
          this.processQueue(); // Procesar siguiente
        }
      );
    } catch (error) {
      console.error('[DownloadQueue] Error iniciando descarga:', error);
      store.dispatch(setDownloadStatus({
        id: download.id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido',
      }));
      this.currentDownloads--;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Pausa una descarga activa
   */
  public async pauseDownload(downloadId: string) {
    try {
      await this.downloadManager.pauseDownload(downloadId);
      this.currentDownloads--;
      this.processQueue(); // Procesar siguiente si hay espacio
    } catch (error) {
      console.error('[DownloadQueue] Error pausando descarga:', error);
    }
  }

  /**
   * Reanuda una descarga pausada
   */
  public async resumeDownload(downloadId: string) {
    try {
      const state = store.getState();
      const download = state.download.downloads.find((d: DownloadItem) => d.id === downloadId);
      
      if (!download) return;

      // Si hay espacio, reanudar inmediatamente
      if (this.currentDownloads < this.maxConcurrentDownloads) {
        await this.startDownload(download);
      }
      // Si no hay espacio, simplemente cambiar a pending y esperar
    } catch (error) {
      console.error('[DownloadQueue] Error reanudando descarga:', error);
    }
  }

  /**
   * Cancela una descarga
   */
  public async cancelDownload(downloadId: string) {
    try {
      await this.downloadManager.cancelDownload(downloadId);
      this.currentDownloads--;
      this.processQueue(); // Procesar siguiente si hay espacio
    } catch (error) {
      console.error('[DownloadQueue] Error cancelando descarga:', error);
    }
  }

  /**
   * Fuerza el procesamiento de la cola
   */
  public forceProcessQueue() {
    this.processQueue();
  }
}

// Exportar instancia singleton
export const downloadQueueManager = DownloadQueueManager.getInstance();
