'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useUser } from '@/firebase/auth/use-user';
import { storage } from '@/firebase';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Beaker, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

// A simple 1x1 transparent PNG as a base64 data URL
const TEST_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export default function StorageTestPage() {
  const [isPngLoading, setIsPngLoading] = useState(false);
  const [retrievedImageUrl, setRetrievedImageUrl] = useState<string | null>(null);
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

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
        description: `Test PNG uploaded to ${storageRef.fullPath}. Now attempting to get data via SDK...` 
      });

      // 2. Attempt to get the file's content as bytes (ArrayBuffer) using the SDK
      const bytes = await getBytes(storageRef);
      
      // 3. Convert bytes to a Blob and create a local URL for display
      const blob = new Blob([bytes], { type: 'image/png' });
      const localUrl = URL.createObjectURL(blob);
      
      setRetrievedImageUrl(localUrl);
      toast({
        title: 'Data Retrieval Successful',
        description: 'Image fetched via SDK should be visible below.',
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

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Firebase Storage Test"
        description="Use this page to test writing and reading files to/from Firebase Storage."
      />
      <main className="flex-1 p-6 pt-0">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>SDK R/W Test (.png)</CardTitle>
              <CardDescription>
                Uploads a PNG to <code className="bg-muted px-1 py-0.5 rounded-sm text-sm">/test/test.png</code>, 
                then retrieves its data using the SDK's `getBytes` method. This verifies if security rules are correct.
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
                    Run SDK R/W Test
                  </>
                )}
              </Button>
              {retrievedImageUrl && (
                 <div>
                    <p className="text-sm font-medium">Image retrieved via SDK:</p>
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
