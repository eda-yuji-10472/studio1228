'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateVideoFromStillImage } from '@/ai/flows/generate-video-from-still-image';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import Image from 'next/image';
import { PromptSuggestions } from '@/components/shared/prompt-suggestions';
import { useUser } from '@/firebase/auth/use-user';
import { firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
});

async function saveMediaToStorageAndFirestore(
  userId: string,
  prompt: string,
  videoDataUri: string,
  sourceImageUrl: string
) {
  if (!videoDataUri.startsWith('data:video/mp4;base64,')) {
    throw new Error('Invalid video data URI format.');
  }

  // 1. Upload generated video to Firebase Storage
  const videoRef = ref(storage, `users/${userId}/videos/${new Date().getTime()}.mp4`);
  const uploadResult = await uploadString(videoRef, videoDataUri, 'data_url');
  const downloadURL = await getDownloadURL(uploadResult.ref);

  // 2. Save video metadata to Firestore
  const videosCollection = collection(firestore, 'users', userId, 'videos');
  const newVideoDoc = doc(videosCollection);
  
  const videoData = {
    id: newVideoDoc.id,
    userId: userId,
    title: prompt,
    prompt: prompt,
    storageUrl: downloadURL,
    thumbnailUrl: sourceImageUrl, // Use the source image as the thumbnail
    type: 'video' as const,
    createdAt: serverTimestamp(),
  };

  setDoc(newVideoDoc, videoData).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: newVideoDoc.path,
        operation: 'create',
        requestResourceData: videoData,
      })
    );
    throw error;
  });

  return { videoUrl: downloadURL, docId: newVideoDoc.id};
}

export function ImageToVideoForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { addPromptItem } = useAppContext();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      setSourceImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in to generate media.' });
      return;
    }
    if (!sourceImageFile || !imagePreview) {
      toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to animate.' });
      return;
    }

    setIsGenerating(true);
    setIsUploading(true); // Indicate that the initial upload is starting
    setGeneratedVideo(null);
    
    let sourceImageUrl = '';

    try {
      // 1. Upload source image first
      const imageRef = ref(storage, `users/${user.uid}/images/${Date.now()}-${sourceImageFile.name}`);
      const imageUploadResult = await uploadBytes(imageRef, sourceImageFile);
      sourceImageUrl = await getDownloadURL(imageUploadResult.ref);
      
      // Save image metadata to Firestore
      const imagesCollection = collection(firestore, 'users', user.uid, 'images');
      const newImageDoc = doc(imagesCollection);
      const imageData = {
        id: newImageDoc.id,
        userId: user.uid,
        title: sourceImageFile.name,
        storageUrl: sourceImageUrl,
        type: 'image' as const,
        createdAt: serverTimestamp(),
      };
      setDoc(newImageDoc, imageData).catch(error => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: newImageDoc.path,
            operation: 'create',
            requestResourceData: imageData,
          })
        );
        throw error;
      });


      setIsUploading(false); // Initial upload finished

      // 2. Generate video
      addPromptItem({ text: values.prompt });
      const result = await generateVideoFromStillImage({ photoDataUri: imagePreview, prompt: values.prompt });

      if (result.videoDataUri) {
        setGeneratedVideo(result.videoDataUri);
        
        // 3. Save generated video and its metadata
        await saveMediaToStorageAndFirestore(user.uid, values.prompt, result.videoDataUri, sourceImageUrl);

        toast({
          title: 'Success!',
          description: 'Your animated video has been generated and saved to your library.',
        });

      } else {
        throw new Error('Video generation failed to return a video.');
      }
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'Something went wrong during the process. Please try again.',
      });
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
    }
  };
  
  const currentPrompt = form.watch('prompt');

  const isButtonDisabled = isGenerating || isUploading || isUserLoading;

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Image-to-Video Generation</CardTitle>
            <CardDescription>Upload an image and describe how you want to animate it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel>Source Image</FormLabel>
                  <FormControl>
                    <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:border-primary">
                      {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" width={500} height={300} className="aspect-video w-full rounded-md object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12">
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload or drag & drop</p>
                        </div>
                      )}
                       {(isUploading && !isGenerating) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <p className="text-white flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</p>
                        </div>
                      )}
                      <Input type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={isButtonDisabled} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Animation Prompt</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Make the clouds move, add subtle wind to the trees" className="min-h-[100px] resize-y" {...field} />
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
                <p className="text-sm text-muted-foreground">Animating image... This may take up to a minute.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <PromptSuggestions originalPrompt={currentPrompt} onSelectSuggestion={(suggestion) => form.setValue('prompt', suggestion)} />
            <Button type="submit" disabled={isButtonDisabled} size="lg">
              {isGenerating || isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isGenerating ? 'Generating...' : 'Uploading...'}
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

    