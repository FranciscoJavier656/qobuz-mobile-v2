import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PlayerContextType {
  fullPlayerVisible: boolean;
  setFullPlayerVisible: (visible: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);

  return (
    <PlayerContext.Provider value={{ fullPlayerVisible, setFullPlayerVisible }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext debe usarse dentro de PlayerProvider');
  }
  return context;
};
