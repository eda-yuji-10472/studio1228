'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useUser } from '@/firebase/auth/use-user';
import { storage } from '@/firebase';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Beaker, Loader2, Image as ImageIcon, Link as LinkIcon, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';

// A simple 1x1 transparent PNG as a base64 data URL
const TEST_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export default function StorageTestPage() {
  const [isWriteLoading, setIsWriteLoading] = useState(false);
  const [isPngLoading, setIsPngLoading] = useState(false);
  const [retrievedImageUrl, setRetrievedImageUrl] = useState<string | null>(null);
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  // State for the new Direct URL Fetch test
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [testUrl, setTestUrl] = useState('https://firebasestorage.googleapis.com/v0/b/striped-proxy-187410.firebasestorage.app/o/test%2Ftest.png?alt=media&token=70e64276-754d-48eb-baf5-2718ccdead5d');
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | null>(null);
  const [testUrlError, setTestUrlError] = useState<string | null>(null);


  const handlePngTest = async () => {
    if (isUserLoading || !user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please wait for authentication to complete.' });
      return;
    }

    setIsPngLoading(true);
    setRetrievedImageUrl(null);
    
    const imagePath = `test/test.png`;
    const storageRef = ref(storage, imagePath);

    try {
      // 1. Upload the test PNG
      await uploadString(storageRef, TEST_PNG_DATA_URL, 'data_url');
      toast({ 
        title: 'Upload Successful', 
        description: `Test PNG uploaded to ${storageRef.fullPath}. Now attempting to get data...` 
      });

      // 2. Attempt to get the file's content as bytes (ArrayBuffer)
      const bytes = await getBytes(storageRef);
      
      // 3. Convert bytes to a Blob and create a local URL for display
      const blob = new Blob([bytes], { type: 'image/png' });
      const localUrl = URL.createObjectURL(blob);
      
      setRetrievedImageUrl(localUrl);
      toast({
        title: 'Data Retrieval Successful',
        description: 'Image should be visible below.',
      });

    } catch (error: any) {
      console.error('Storage PNG Test Error:', error);
      toast({
        variant: 'destructive',
        title: 'PNG Test Failed',
        description: `Failed at path ${storageRef.fullPath}. Error: ${error.message}`,
      });
    } finally {
      setIsPngLoading(false);
    }
  };
  
  const handleUrlTest = async () => {
    if (!testUrl) {
      setTestUrlError('Please enter a URL to test.');
      return;
    }
    setIsUrlLoading(true);
    setFetchedImageUrl(null);
    setTestUrlError(null);
    try {
        const response = await fetch(testUrl);
        if (response.ok) {
            // We got the image, let's turn it into a blob URL to display
            const blob = await response.blob();
            const localUrl = URL.createObjectURL(blob);
            setFetchedImageUrl(localUrl);
            toast({ title: 'Success', description: 'The URL was fetched successfully.'});
        } else {
            // The server responded with an error status (e.g., 403, 404)
            const errorText = await response.text();
            setTestUrlError(`Fetch failed: Server responded with status ${response.status}. Response: ${errorText}`);
            toast({ variant: 'destructive', title: 'Fetch Error', description: `Server responded with status ${response.status}`});
        }
    } catch (error: any) {
        console.error("Direct URL Fetch Error:", error);
        setTestUrlError(`Fetch failed: ${error.message}. This is likely a CORS issue or network problem. Check the browser console for more details.`);
        toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
        setIsUrlLoading(false);
    }
  };


  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Storage Test"
        description="Use this page to test writing and reading files to/from Firebase Storage."
      />
      <main className="flex-1 p-6 pt-0">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">

          <Card>
            <CardHeader>
              <CardTitle>Direct URL Fetch Test</CardTitle>
              <CardDescription>
                Paste a Firebase Storage URL (with token) to test if it can be fetched directly by the browser. This helps diagnose CORS or network issues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Input 
                   type="url"
                   value={testUrl}
                   onChange={(e) => setTestUrl(e.target.value)}
                   placeholder="Enter Firebase Storage URL"
                   disabled={isUrlLoading}
                 />
                 <Button onClick={handleUrlTest} disabled={isUrlLoading || isUserLoading}>
                  {isUrlLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2" />
                      Test URL Fetch
                    </>
                  )}
                </Button>
               </div>
               
              {fetchedImageUrl && (
                 <div>
                    <p className="text-sm font-medium">Image fetched successfully:</p>
                    <div className="mt-2 w-24 h-24 border rounded-md p-2">
                      <Image src={fetchedImageUrl} alt="Fetched from URL" width={96} height={96} unoptimized/>
                    </div>
                 </div>
              )}
               {testUrlError && (
                 <div className="p-3 rounded-md bg-destructive/10 text-destructive-foreground border border-destructive/50 text-sm flex items-start gap-3">
                   <AlertCircle className="h-5 w-5 shrink-0" />
                   <p>{testUrlError}</p>
                 </div>
               )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Storage R/W Test (.png)</CardTitle>
              <CardDescription>
                Attempts to upload a small PNG to{' '}
                <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/test/test.png</code>,{' '}
                then retrieve its data using the SDK's `getBytes` method and display it.
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
                      <Image src={retrievedImageUrl} alt="Test PNG" width={96} height={96} unoptimized/>
                    </div>
                 </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
