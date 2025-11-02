'use client';

import React, { createContext, useContext } from 'react';
import { firebaseApp, auth, firestore, storage } from './index';

// Define the shape of the context value
interface FirebaseContextValue {
  firebaseApp: typeof firebaseApp;
  auth: typeof auth;
  firestore: typeof firestore;
  storage: typeof storage;
}

// Create the context with an initial undefined value
const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

/**
 * Provider component that makes Firebase SDK instances available to the rest of the app.
 */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const value = { firebaseApp, auth, firestore, storage };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Custom hooks to easily access the Firebase instances from the context
export const useFirebaseApp = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  }
  return context.firebaseApp;
};

export const useAuth = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
};

export const useFirestore = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context.firestore;
};

export const useStorage = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useStorage must be used within a FirebaseProvider');
    }
    return context.storage;
};
