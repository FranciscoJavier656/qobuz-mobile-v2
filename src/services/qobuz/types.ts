export interface Track {
  id: number;
  title: string;
  track_number?: number;
  performer?: {
    name: string;
    id?: number; // ID del artista para obtener su info completa desde Qobuz
  };
  album?: {
    image?: {
      small?: string;
      thumbnail?: string;
      large?: string;
    };
    title?: string;
    release_date_original?: string;
  };
  duration?: number;
  streamable?: boolean;
  version?: string;
  previewable?: boolean;
  preview_url?: string;
  sample_url?: string;
}

export interface Album {
  id: number;
  title: string;
  artist?: {
    name: string;
  };
  image?: {
    small?: string;
    thumbnail?: string;
    large?: string;
  };
  release_date_original?: string;
  tracks_count?: number;
  duration?: number;
}

export interface Artist {
  id: number;
  name: string;
  picture?: string;
  albums_count?: number;
}

export interface QobuzLoginResponse {
  user_auth_token: string;
  user?: {
    id: number;
    display_name?: string;
    email?: string;
    subscription?: {
      offer: string;
      start_date: string;
      end_date: string;
      periodicity: string;
      is_canceled: boolean;
      household_size_max: number;
    };
  };
}

export interface QobuzSearchResult {
  tracks?: {
    items: Track[];
    total: number;
  };
}
