'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { PromptSuggestions } from '@/components/shared/prompt-suggestions';
import { useUser } from '@/firebase/auth/use-user';
import { storage, firestore } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { logError } from '@/lib/logger';

const formSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
});

export function TextToVideoForm() {
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addPromptItem } = useAppContext();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to generate videos.',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedVideo(null);

    const videosCollection = collection(firestore, 'users', user.uid, 'videos');
    const newVideoDocRef = doc(videosCollection);
    
    // Step 1: Create initial record in Firestore
    try {
      const initialVideoData = {
        id: newVideoDocRef.id,
        userId: user.uid,
        title: values.prompt,
        prompt: values.prompt,
        storageUrl: '',
        type: 'video' as const,
        status: 'processing',
        createdAt: serverTimestamp(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      await setDoc(newVideoDocRef, initialVideoData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newVideoDocRef.path, operation: 'create', requestResourceData: initialVideoData }));
        throw error;
      });
    } catch (error: any) {
        console.error('Failed to create initial Firestore document:', error);
        toast({
          variant: 'destructive',
          title: 'Firestore Error',
          description: `Could not create tracking document. ${error.message}`,
        });
        setIsGenerating(false);
        return; // Stop if we can't create the initial doc.
    }

    // Step 2-4: Generate, upload, and update.
    try {
      addPromptItem({ text: values.prompt });
      const result = await generateVideoFromText({ prompt: values.prompt });
      
      if (result.videoDataUri) {
        setGeneratedVideo(result.videoDataUri);
        
        const videoRef = ref(storage, `users/${user.uid}/videos/${newVideoDocRef.id}.mp4`);
        const uploadResult = await uploadString(videoRef, result.videoDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        const finalVideoData = {
          storageUrl: downloadURL,
          status: 'completed' as const,
          inputTokens: result.usage?.inputTokens || 0,
          outputTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        };

        await updateDoc(newVideoDocRef, finalVideoData).catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newVideoDocRef.path, operation: 'update', requestResourceData: finalVideoData }));
          throw error;
        });

        toast({
          title: 'Success!',
          description: 'Your video has been generated and saved to your library.',
        });
      } else {
        throw new Error('Video generation failed to return a video.');
      }
    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newVideoDocRef, errorData).catch(updateError => {
        console.error("Failed to update doc with error state:", updateError);
        logError(updateError, { context: 'TextToVideoForm.onSubmit.updateError', userId: user.uid });
      });
      
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'Something went wrong while generating or saving your video. Please try again.',
      });
      await logError(error, { context: 'TextToVideoForm.onSubmit', userId: user.uid });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const currentPrompt = form.watch('prompt');
  const isButtonDisabled = isGenerating || isUserLoading;

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Text-to-Video Generation</CardTitle>
            <CardDescription>
              Describe the video you want to create. Be as specific as you can.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., A majestic lion roaring on the Serengeti at sunset"
                      className="min-h-[100px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {generatedVideo && (
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                <video src={generatedVideo} controls autoPlay muted loop className="h-full w-full object-cover" />
              </div>
            )}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating video... This may take up to a minute.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <PromptSuggestions originalPrompt={currentPrompt} onSelectSuggestion={(suggestion) => form.setValue('prompt', suggestion)} />
            <Button type="submit" disabled={isButtonDisabled} size="lg">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
