'use client';

import { firestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface LogErrorOptions {
  userId?: string | null;
  context: string;
}

/**
 * Logs an error to the 'errors' collection in Firestore.
 * @param error The error object to log.
 * @param options Additional context for the error.
 */
export async function logError(error: any, options: LogErrorOptions): Promise<void> {
  try {
    const errorCollection = collection(firestore, 'errors');
    
    // Ensure we don't log errors from the logger itself to prevent infinite loops.
    if (error.stack && error.stack.includes('logError')) {
      console.error("Recursive error in logger detected. Aborting log.", error);
      return;
    }

    await addDoc(errorCollection, {
      userId: options.userId || null,
      context: options.context,
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      createdAt: serverTimestamp(),
    });
  } catch (loggingError) {
    // If logging to Firestore fails, log to the console as a fallback.
    console.error('Failed to log error to Firestore:', loggingError);
    console.error('Original error:', error);
  }
}

    