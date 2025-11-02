'use client';

import type { PromptItem } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MAX_PROMPT_ITEMS = 20;

interface AppContextType {
  promptHistory: PromptItem[];
  addPromptItem: (item: Omit<PromptItem, 'id' | 'createdAt'>) => void;
  isHydrated: boolean;
  addMediaItem: (id: string, type: 'video' | 'image') => void;
  mediaItems: { id: string; type: 'video' | 'image' }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promptHistory, setPromptHistory] = useState<PromptItem[]>([]);
  const [mediaItems, setMediaItems] = useState<{ id: string; type: 'video' | 'image' }[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedPrompts = localStorage.getItem('promptHistory');
      if (storedPrompts) {
        setPromptHistory(JSON.parse(storedPrompts));
      }
      const storedMedia = localStorage.getItem('mediaItems');
      if (storedMedia) {
        setMediaItems(JSON.parse(storedMedia));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage, clearing for safety.", error);
      localStorage.removeItem('promptHistory');
      localStorage.removeItem('mediaItems');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        const promptsToStore = promptHistory.slice(0, MAX_PROMPT_ITEMS);
        localStorage.setItem('promptHistory', JSON.stringify(promptsToStore));
        localStorage.setItem('mediaItems', JSON.stringify(mediaItems));
      } catch (error) {
        console.error("Failed to save to localStorage", error);
      }
    }
  }, [promptHistory, mediaItems, isHydrated]);

  const addPromptItem = useCallback((item: Omit<PromptItem, 'id' | 'createdAt'>) => {
    setPromptHistory(prev => {
      if (prev.some(p => p.text === item.text)) {
        return prev;
      }
      const newItem = { ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() };
      return [newItem, ...prev].slice(0, MAX_PROMPT_ITEMS);
    });
  }, []);

  const addMediaItem = useCallback((id: string, type: 'video' | 'image') => {
    setMediaItems(prev => [{ id, type }, ...prev]);
  }, []);

  const value = { promptHistory, addPromptItem, isHydrated, addMediaItem, mediaItems };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
