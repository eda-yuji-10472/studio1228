'use client';

import type { MediaItem, PromptItem } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MAX_IMAGE_ITEMS = 10;
const MAX_PROMPT_ITEMS = 10;

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
        // We only store images now
        const images = JSON.parse(storedMedia).filter((item: MediaItem) => item.type === 'image');
        setMediaItems(images);
      }
      const storedPrompts = localStorage.getItem('promptHistory');
      if (storedPrompts) {
        setPromptHistory(JSON.parse(storedPrompts));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
      // If parsing fails, clear the storage to prevent future errors
      localStorage.removeItem('mediaItems');
      localStorage.removeItem('promptHistory');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        // Only persist images to local storage
        const imagesToStore = mediaItems.filter(item => item.type === 'image').slice(0, MAX_IMAGE_ITEMS);
        localStorage.setItem('mediaItems', JSON.stringify(imagesToStore));
      } catch (error) {
        console.error("Failed to save mediaItems to localStorage", error);
      }
    }
  }, [mediaItems, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
        const itemsToStore = promptHistory.slice(0, MAX_PROMPT_ITEMS);
        localStorage.setItem('promptHistory', JSON.stringify(itemsToStore));
    }
  }, [promptHistory, isHydrated]);

  const addMediaItem = useCallback((item: Omit<MediaItem, 'id' | 'createdAt'>) => {
    const newItem = { ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() };
    
    // Videos are added to state for immediate viewing but not persisted long-term
    if (item.type === 'video') {
       setMediaItems(prev => [newItem, ...prev.filter(i => i.type === 'image')].slice(0, MAX_IMAGE_ITEMS + 1));
       return;
    }

    // Images are added and will be persisted
    setMediaItems(prev => [newItem, ...prev].slice(0, MAX_IMAGE_ITEMS));
  }, []);

  const addPromptItem = useCallback((item: Omit<PromptItem, 'id' | 'createdAt'>) => {
    setPromptHistory(prev => {
        // Avoid adding duplicate prompts
        if (prev.some(p => p.text === item.text)) {
            return prev;
        }
        return [{ ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() }, ...prev].slice(0, MAX_PROMPT_ITEMS);
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
