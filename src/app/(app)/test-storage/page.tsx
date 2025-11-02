'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useUser } from '@/firebase/auth/use-user';
import { storage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Beaker, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

// A simple 1x1 transparent PNG as a base64 data URL
const TEST_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export default function StorageTestPage() {
  const [isWriteLoading, setIsWriteLoading] = useState(false);
  const [isPngLoading, setIsPngLoading] = useState(false);
  const [retrievedImageUrl, setRetrievedImageUrl] = useState<string | null>(null);
  const [imagePathForDebug, setImagePathForDebug] = useState<string | null>(null);
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  const handleTestUpload = async () => {
    if (isUserLoading) {
      toast({ variant: 'destructive', title: 'Please wait', description: 'Authentication is still in progress.' });
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to perform this action.' });
      return;
    }

    setIsWriteLoading(true);
    const testContent = `This is a test file generated at ${new Date().toISOString()}. User ID: ${user.uid}`;
    const storageRef = ref(storage, `users/${user.uid}/test/test-${Date.now()}.txt`);

    try {
      await uploadString(storageRef, testContent, 'raw');
      toast({
        title: 'Upload Successful',
        description: `Test file was successfully written to: ${storageRef.fullPath}`,
      });
    } catch (error: any) {
      console.error('Storage Write Test Error:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'An unknown error occurred.' });
    } finally {
      setIsWriteLoading(false);
    }
  };

  const handlePngTest = async () => {
    if (isUserLoading || !user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please wait for authentication to complete.' });
      return;
    }

    setIsPngLoading(true);
    setRetrievedImageUrl(null);
    setImagePathForDebug(null);
    
    const imagePath = `test/test.png`;
    const storageRef = ref(storage, imagePath);

    try {
      // 1. Upload the test PNG
      const uploadResult = await uploadString(storageRef, TEST_PNG_DATA_URL, 'data_url');
      toast({ 
        title: 'Upload Successful', 
        description: `Test PNG uploaded to ${storageRef.fullPath}. Now attempting to get URL...` 
      });
      console.log(`Test PNG uploaded to ${uploadResult.ref.fullPath}`);

      // 2. Attempt to get the download URL
      const url = await getDownloadURL(storageRef);
      setRetrievedImageUrl(url);
      toast({
        title: 'URL Retrieval Successful',
        description: 'Image should be visible below.',
      });

    } catch (error: any) {
      console.error('Storage PNG Test Error:', error);
      toast({
        variant: 'destructive',
        title: 'PNG Test Failed',
        description: error.message || 'Could not upload or retrieve the test PNG.',
      });
      // Set the path for debugging purposes even if getDownloadURL fails
      setImagePathForDebug(storageRef.toString()); // This will be gs://...
    } finally {
      setIsPngLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Storage Test"
        description="Use this page to test writing and reading files to/from Firebase Storage."
      />
      <main className="flex-1 p-6 pt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Storage Write Test (.txt)</CardTitle>
              <CardDescription>
                Attempts to write a small text file to{' '}
                <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/users/&#123;uid&#125;/test/</code>.
                This verifies basic write permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleTestUpload} disabled={isWriteLoading || isUserLoading}>
                {isWriteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Beaker className="mr-2" />
                    Run Write Test (.txt)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage R/W Test (.png)</CardTitle>
              <CardDescription>
                Attempts to upload a small PNG to{' '}
                <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/test/test.png</code>{' '}
                and then retrieve its public URL to display it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handlePngTest} disabled={isPngLoading || isUserLoading}>
                {isPngLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing R/W...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2" />
                    Run R/W Test (.png)
                  </>
                )}
              </Button>
              {retrievedImageUrl && (
                 <div>
                    <p className="text-sm font-medium">Image retrieved successfully:</p>
                    <div className="mt-2 w-24 h-24 border rounded-md p-2">
                      <Image src={retrievedImageUrl} alt="Test PNG" width={96} height={96} />
                    </div>
                    <p className="text-xs text-muted-foreground break-all mt-1">URL: {retrievedImageUrl}</p>
                 </div>
              )}
              {imagePathForDebug && !retrievedImageUrl && (
                <div>
                  <p className="text-sm font-medium text-destructive">Failed to get URL, but file should exist at this path:</p>
                  <code className="text-xs text-muted-foreground break-all mt-1">{imagePathForDebug}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
