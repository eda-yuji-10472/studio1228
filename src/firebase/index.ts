'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// --- Singleton Initialization ---
// This pattern ensures that Firebase is initialized only once.

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;

// On the server, we use the server-side environment variables.
// On the client, we use the explicit client-side config.
// This is the recommended pattern for App Hosting.
if (typeof window === 'undefined' && process.env.FIREBASE_CONFIG) {
    // Server-side initialization
    firebaseApp = initializeApp(JSON.parse(process.env.FIREBASE_CONFIG));
} else if (!getApps().length) {
    // Client-side initialization (only if no apps are initialized)
    firebaseApp = initializeApp(firebaseConfig);
} else {
    // Get the already-initialized app on the client
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
export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './errors';
export * from './error-emitter';