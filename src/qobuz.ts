// src/types/qobuz.ts

export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number; // Duration in seconds
    releaseDate: string; // ISO date string
    coverArt: string; // URL to cover art
    streamUrl: string; // URL for streaming
}

export interface Album {
    id: string;
    title: string;
    artist: string;
    releaseDate: string; // ISO date string
    coverArt: string; // URL to cover art
    tracks: Track[];
}

export interface Artist {
    id: string;
    name: string;
    albums: Album[];
}

export interface SearchResult {
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
}

export interface QobuzApiResponse<T> {
    status: string;
    data: T;
    error?: string; // Optional error message
}