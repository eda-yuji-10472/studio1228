'use client';

import { useContext } from 'react';
import { FirebaseContext } from '@/firebase/provider';

/**
 * Custom hook that provides access to the core Firebase context.
 * Throws an error if used outside of a FirebaseProvider.
 * @returns The Firebase context state.
 */
function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

/**
 * Hook for accessing the Firebase Auth service instance.
 * @returns The Firebase Auth instance, or null if not available.
 */
export function useAuth() {
  return useFirebase().auth;
}

/**
 * Hook for accessing the Firestore service instance.
 * @returns The Firestore instance, or null if not available.
 */
export function useFirestore() {
  return useFirebase().firestore;
}

/**
 * Hook for accessing the Firebase Storage service instance.
 * @returns The Firebase Storage instance, or null if not available.
 */
export function useStorage() {
    return useFirebase().storage;
}

/**
 * Hook for accessing the user's authentication state.
 * @returns An object with `user`, `isUserLoading`, and `userError`.
 */
export function useUser() {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
}
