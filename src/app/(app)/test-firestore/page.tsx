
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useFirestore, useUser } from '@/firebase/auth/use-user';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Flame, Loader2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export default function FirestoreTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleTestWrite = async () => {
    if (isUserLoading) {
      toast({
        variant: 'destructive',
        title: 'Please wait',
        description: 'Authentication is still in progress.',
      });
      return;
    }
      
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to perform this action.',
      });
      return;
    }

    setIsLoading(true);

    const testDocRef = doc(collection(firestore, 'users', user.uid, 'tests'));
    const testContent = {
      message: `This is a test document written at ${new Date().toISOString()}`,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(testDocRef, testContent).catch(error => {
        // The global error handler doesn't catch promise rejections automatically,
        // so we need to explicitly emit the permission error here.
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: testDocRef.path,
            operation: 'create',
            requestResourceData: testContent,
          })
        );
        // Re-throw to ensure the try-catch block catches it.
        throw error;
      });

      toast({
        title: 'Write Successful',
        description: `Test document was successfully written to: ${testDocRef.path}`,
      });
    } catch (error: any) {
      console.error('Firestore Test Error:', error);
      // The toast will be shown by the global error handler if it's a permission error.
      // We only show a generic one here for other types of errors.
      if (error.name !== 'FirebaseError') {
        toast({
          variant: 'destructive',
          title: 'Write Failed',
          description: error.message || 'An unknown error occurred.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Firestore Test"
        description="Use this page to test writing a document to Firestore."
      />
      <main className="flex-1 p-6 pt-0">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Firestore Write Test</CardTitle>
            <CardDescription>
              Clicking the button below will attempt to write a small document to{' '}
              <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/users/&#123;your-user-id&#125;/tests/&#123;doc-id&#125;</code>{' '}
              in your Firestore database. Check your browser's developer console and toast messages for any errors. This is useful for verifying if your security rules are working as expected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestWrite} disabled={isLoading || isUserLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Flame className="mr-2" />
                  Run Firestore Write Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
