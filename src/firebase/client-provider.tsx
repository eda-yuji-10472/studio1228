'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseApp, auth, firestore, storage } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Provides Firebase SDK instances to the application.
 * This client component ensures that the Firebase context is available throughout the app.
 */
export function FirebaseClientProvider({
  children,
}: FirebaseClientProviderProps) {
  // The SDK instances are now imported directly as singletons.
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
      storage={storage}
    >
      {children}
    </FirebaseProvider>
  );
}
