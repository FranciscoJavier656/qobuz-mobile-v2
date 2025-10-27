import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addDownload, removeDownload, selectDownloadQueue } from '../store/slices/downloadSlice';
import { DownloadItem } from '../types/download';

const useDownloadQueue = () => {
  const dispatch = useDispatch();
  const downloadQueue = useSelector(selectDownloadQueue);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (downloadQueue.length > 0 && !isDownloading) {
      setIsDownloading(true);
      // Start downloading the first item in the queue
      const currentDownload = downloadQueue[0];
      downloadFile(currentDownload);
    }
  }, [downloadQueue, isDownloading]);

  const downloadFile = async (item: DownloadItem) => {
    try {
      // Simulate file download
      console.log(`Downloading: ${item.title}`);
      // Here you would implement the actual download logic
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate a delay
      console.log(`Downloaded: ${item.title}`);
      dispatch(removeDownload(item.id));
    } catch (error) {
      console.error(`Failed to download ${item.title}:`, error);
    } finally {
      setIsDownloading(false);
    }
  };

  const addToQueue = (item: DownloadItem) => {
    dispatch(addDownload(item));
  };

  return {
    downloadQueue,
    addToQueue,
  };
};

export default useDownloadQueue;