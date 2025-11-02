'use client';

import type { MediaItem, PromptItem } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MAX_PROMPT_ITEMS = 20;

interface AppContextType {
  promptHistory: PromptItem[];
  addPromptItem: (item: Omit<PromptItem, 'id' | 'createdAt'>) => void;
  isHydrated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [promptHistory, setPromptHistory] = useState<PromptItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedPrompts = localStorage.getItem('promptHistory');
      if (storedPrompts) {
        setPromptHistory(JSON.parse(storedPrompts));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage, clearing for safety.", error);
      localStorage.removeItem('promptHistory');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        const itemsToStore = promptHistory.slice(0, MAX_PROMPT_ITEMS);
        localStorage.setItem('promptHistory', JSON.stringify(itemsToStore));
      } catch (error) {
        console.error("Failed to save promptHistory to localStorage", error);
      }
    }
  }, [promptHistory, isHydrated]);

  const addPromptItem = useCallback((item: Omit<PromptItem, 'id' | 'createdAt'>) => {
    setPromptHistory(prev => {
      if (prev.some(p => p.text === item.text)) {
        return prev;
      }
      const newItem = { ...item, id: new Date().toISOString(), createdAt: new Date().toISOString() };
      return [newItem, ...prev].slice(0, MAX_PROMPT_ITEMS);
    });
  }, []);

  const value = { promptHistory, addPromptItem, isHydrated };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
