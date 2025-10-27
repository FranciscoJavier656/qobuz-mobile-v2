import { useEffect, useState } from 'react';
import { QobuzAPI } from '../services/qobuz/QobuzAPI';
import { Track } from '../types/audio';

const useAudioPlayer = (track: Track | null) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = new Audio();

  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (track) {
        const qobuzAPI = new QobuzAPI();
        const url = await qobuzAPI.getTrackStreamUrl(track.id);
        setAudioUrl(url);
      }
    };

    fetchAudioUrl();

    return () => {
      audioRef.pause();
      audioRef.src = '';
    };
  }, [track]);

  const play = () => {
    if (audioUrl) {
      audioRef.src = audioUrl;
      audioRef.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    audioRef.pause();
    setIsPlaying(false);
  };

  return {
    isPlaying,
    play,
    pause,
  };
};

export default useAudioPlayer;