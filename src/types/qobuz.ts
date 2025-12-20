export interface Track {
  id: string;
  title: string;
  performer?: {
    name: string;
  };
  album?: {
    image?: {
      small?: string;
      thumbnail?: string;
      large?: string;
    };
    title?: string;
  };
  duration?: number;
  streamable?: boolean;
  version?: string;
  localPath?: string; // Ruta local del archivo descargado
}

export interface Album {
  id: string;
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
  localTracks?: Track[]; // Array de tracks descargadas localmente
}

export interface Artist {
  id: string;
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
    };
  };
}
