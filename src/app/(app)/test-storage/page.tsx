'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useStorage, useUser } from '@/firebase';
import { ref, uploadString } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Beaker, Loader2 } from 'lucide-react';

export default function StorageTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, isUserLoading } = useUser();
  const storage = useStorage();
  const { toast } = useToast();

  const handleTestUpload = async () => {
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

    const testContent = `This is a test file generated at ${new Date().toISOString()}. User ID: ${user.uid}`;
    const storageRef = ref(storage, `users/${user.uid}/test/test-${Date.now()}.txt`);

    try {
      await uploadString(storageRef, testContent, 'raw');
      toast({
        title: 'Upload Successful',
        description: `Test file was successfully written to: ${storageRef.fullPath}`,
      });
    } catch (error: any) {
      console.error('Storage Test Error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Storage Test"
        description="Use this page to test writing a file to Firebase Storage."
      />
      <main className="flex-1 p-6 pt-0">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Storage Write Test</CardTitle>
            <CardDescription>
              Clicking the button below will attempt to write a small text file to{' '}
              <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/users/&#123;your-user-id&#125;/test/</code>{' '}
              in your Firebase Storage bucket. Check the browser console and toast messages for error details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestUpload} disabled={isLoading || isUserLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Beaker className="mr-2" />
                  Run Storage Write Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
