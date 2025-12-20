// src/services/qobuz/types.ts

export interface QobuzTrack {
    id: number;
    title: string;
    artist: string;
    album: string;
    duration: number; // in seconds
    format: string; // e.g., 'FLAC', 'MP3'
    url: string; // streaming URL
}

export interface QobuzAlbum {
    id: number;
    title: string;
    artist: string;
    releaseDate: string; // ISO format
    tracks: QobuzTrack[];
}

export interface QobuzSearchResult {
    tracks: QobuzTrack[];
    albums: QobuzAlbum[];
}

export interface QobuzApiResponse<T> {
    status: string;
    data: T;
    error?: string; // optional error message
}