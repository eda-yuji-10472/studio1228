'use client';

import type { MediaItem, PromptItem } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AppContextType {
  mediaItems: MediaItem[];
  promptHistory: PromptItem[];
  addMediaItem: (item: Omit<MediaItem, 'id' | 'createdAt'>) => void;
  addPromptItem: (item: Omit<PromptItem, 'id' | 'createdAt'>) => void;
  isHydrated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedMedia = localStorage.getItem('mediaItems');
      if (storedMedia) {
        setMediaItems(JSON.parse(storedMedia));
      }
      const storedPrompts = localStorage.getItem('promptHistory');
      if (storedPrompts) {
        setPromptHistory(JSON.parse(storedPrompts));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('mediaItems', JSON.stringify(mediaItems));
    }
  }, [mediaItems, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('promptHistory', JSON.stringify(promptHistory));
    }
  }, [promptHistory, isHydrated]);

  const addMediaItem = useCallback((item: Omit<MediaItem, 'id' | 'createdAt'>) => {
    setMediaItems(prev => [{ ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() }, ...prev]);
  }, []);

  const addPromptItem = useCallback((item: Omit<PromptItem, 'id' | 'createdAt'>) => {
    setPromptHistory(prev => {
        // Avoid adding duplicate prompts
        if (prev.some(p => p.text === item.text)) {
            return prev;
        }
        return [{ ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() }, ...prev]
    });
  }, []);

  const value = { mediaItems, promptHistory, addMediaItem, addPromptItem, isHydrated };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
