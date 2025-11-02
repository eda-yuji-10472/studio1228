'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useUser } from '@/firebase/auth/use-user';
import { storage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Beaker, Loader2, Image as ImageIcon, Link as LinkIcon, AlertCircle } from 'lucide-react';
import Image from 'next/image';

// A simple 1x1 transparent PNG as a base64 data URL
const TEST_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export default function StorageTestPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ url?: string; path?: string; error?: string }>({});
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  const handleStorageTest = async () => {
    if (isUserLoading || !user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please wait for authentication to complete.' });
      return;
    }

    setIsTesting(true);
    setResult({});
    
    const imagePath = `test/test.png`;
    const storageRef = ref(storage, imagePath);

    try {
      // 1. Upload the test PNG
      await uploadString(storageRef, TEST_PNG_DATA_URL, 'data_url');
      toast({ 
        title: 'Upload Successful', 
        description: `Test PNG uploaded to ${storageRef.fullPath}. Now attempting getDownloadURL...` 
      });

      // 2. Attempt to get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      setResult({ url: downloadURL, path: storageRef.fullPath });
      toast({
        title: 'getDownloadURL Successful',
        description: 'Download URL has been retrieved.',
      });

    } catch (error: any) {
      console.error('Storage Test Error:', error);
      setResult({ error: error.message || 'An unknown error occurred.', path: storageRef.fullPath });
      toast({
        variant: 'destructive',
        title: 'Storage Test Failed',
        description: `Failed at path ${storageRef.fullPath}. Error: ${error.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Storage Test"
        description="Use this page to test writing files and getting a download URL from Firebase Storage."
      />
      <main className="flex-1 p-6 pt-0">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage getDownloadURL Test</CardTitle>
              <CardDescription>
                Uploads a test PNG to <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/test/test.png</code>, 
                then attempts to retrieve its public URL using the SDK's `getDownloadURL` method.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleStorageTest} disabled={isTesting || isUserLoading}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Beaker className="mr-2" />
                    Run getDownloadURL Test
                  </>
                )}
              </Button>
              {result.path && (
                 <div className="space-y-2 rounded-md border p-4">
                    <h4 className="font-medium">Test Results</h4>
                    <div className="flex items-center gap-2 text-sm">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <p>Attempted Path:</p>
                        <code className="bg-muted px-1 py-0.5 rounded-sm">{result.path}</code>
                    </div>
                    {result.url && (
                        <div className="flex items-start gap-2 text-sm">
                            <LinkIcon className="h-4 w-4 text-muted-foreground mt-1" />
                            <p>Download URL:</p>
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{result.url}</a>
                        </div>
                    )}
                     {result.error && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-1" />
                            <p>Error:</p>
                            <p className="font-mono">{result.error}</p>
                        </div>
                    )}
                 </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
