// src/types/download.ts

export interface DownloadItem {
    id: string;
    title: string;
    artist: string;
    url: string;
    progress: number; // Percentage of download completion
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

export interface DownloadQueue {
    items: DownloadItem[];
    total: number;
    completed: number;
    failed: number;
}