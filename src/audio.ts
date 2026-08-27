// src/types/audio.ts

export interface AudioTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number; // Duration in seconds
    format: 'mp3' | 'flac' | 'wav'; // Supported audio formats
    url: string; // Streaming URL
}

export interface AudioPlayerState {
    currentTrack: AudioTrack | null;
    isPlaying: boolean;
    volume: number; // Volume level from 0 to 100
    playbackPosition: number; // Current playback position in seconds
}

export interface AudioQueue {
    tracks: AudioTrack[];
    currentTrackIndex: number;
}