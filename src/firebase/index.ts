'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// --- Singleton Initialization ---
// This pattern ensures that Firebase is initialized only once, always using the explicit config.

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
  // Always initialize with the explicit config for consistent client-side behavior.
  firebaseApp = initializeApp(firebaseConfig);
} else {
  // If already initialized, get the existing app instance.
  firebaseApp = getApp();
}

// Get the SDK service instances from the initialized app.
auth = getAuth(firebaseApp);
firestore = getFirestore(firebaseApp);
storage = getStorage(firebaseApp);

// Export the singleton instances for direct use in the application.
export { firebaseApp, auth, firestore, storage };

// --- Exports for Hooks and Providers ---
// These allow components to easily access Firebase contexts and utilities.

export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
export * from './provider';
