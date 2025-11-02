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
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logError } from '@/lib/logger';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
  personGeneration: z.string().default('allow_adult'),
  aspectRatio: z.string().default('16:9'),
});

export function ImageToVideoForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addPromptItem } = useAppContext();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
      personGeneration: 'allow_adult',
      aspectRatio: '16:9',
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
    setGeneratedVideo(null);
    
    const videosCollection = collection(firestore, 'users', user.uid, 'videos');
    const newVideoDocRef = doc(videosCollection);

    try {
      const initialVideoData = {
        id: newVideoDocRef.id,
        userId: user.uid,
        title: values.prompt,
        prompt: values.prompt,
        storageUrl: '',
        thumbnailUrl: '',
        type: 'video' as const,
        status: 'processing' as const,
        personGeneration: values.personGeneration,
        aspectRatio: values.aspectRatio,
        createdAt: serverTimestamp(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheHit: false,
      };
      await setDoc(newVideoDocRef, initialVideoData);
    } catch (error: any) {
      console.error('Failed to create initial Firestore document:', error);
      toast({
        variant: 'destructive',
        title: 'Firestore Error',
        description: `Could not create tracking document. Check permissions. ${error.message}`,
      });
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newVideoDocRef.path, operation: 'create', requestResourceData: { title: values.prompt, status: 'processing'} }));
      setIsGenerating(false);
      return;
    }

    try {
      const imageFileName = `${newVideoDocRef.id}-${sourceImageFile.name}`;
      const imageRef = ref(storage, `users/${user.uid}/images/${imageFileName}`);
      const imageUploadResult = await uploadBytes(imageRef, sourceImageFile);
      const sourceImageUrl = await getDownloadURL(imageUploadResult.ref);
      
      addPromptItem({ text: values.prompt });
      const result = await generateVideoFromStillImage({ 
        photoDataUri: imagePreview, 
        prompt: values.prompt,
        personGeneration: values.personGeneration,
        aspectRatio: values.aspectRatio,
       });

      const docUpdate: any = {
        thumbnailUrl: sourceImageUrl,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        cacheHit: result.cacheHit || false,
        finishReason: result.finishReason,
        safetyRatings: result.safetyRatings || [],
      };

      if (result.finishReason === 'SAFETY') {
        docUpdate.status = 'failed';
        docUpdate.error = 'Blocked by safety policy.';
        await updateDoc(newVideoDocRef, docUpdate);
        toast({
          variant: 'destructive',
          title: 'Generation Blocked',
          description: 'The prompt or image was blocked by the safety policy. The details have been logged.',
        });
        setIsGenerating(false);
        return;
      }
      
      if (result.videoDataUri) {
        setGeneratedVideo(result.videoDataUri);
        
        const videoRef = ref(storage, `users/${user.uid}/videos/${newVideoDocRef.id}.mp4`);
        const uploadResult = await uploadString(videoRef, result.videoDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        docUpdate.storageUrl = downloadURL;
        docUpdate.status = 'completed';

        await updateDoc(newVideoDocRef, docUpdate);

        toast({
          title: 'Success!',
          description: `Your animated video has been generated and saved. ${result.cacheHit ? '(from cache)' : ''}`,
        });
      } else {
        throw new Error('Video generation failed to return a video.');
      }
    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newVideoDocRef, errorData).catch(updateError => {
        console.error("Failed to update doc with error state:", updateError);
        logError(updateError, { context: 'ImageToVideoForm.onSubmit.updateError', userId: user.uid });
      });
      
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'Something went wrong during the process. Please try again.',
      });
      await logError(error, { context: 'ImageToVideoForm.onSubmit', userId: user.uid });
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
            <CardTitle>Image-to-Video Generation</CardTitle>
            <CardDescription>Upload an image and describe how you want to animate it. Choose your desired aspect ratio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel>Source Image</FormLabel>
                  <FormControl>
                    <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:border-primary">
                      {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" width={500} height={300} className="w-full rounded-md object-contain p-2" style={{ maxHeight: '40vh' }} />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 aspect-video">
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload or drag & drop</p>
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

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Aspect Ratio</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="16:9" id="ar-16-9" />
                          </FormControl>
                          <Label htmlFor="ar-16-9" className="font-normal">16:9 (Landscape)</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="9:16" id="ar-9-16" />
                          </FormControl>
                          <Label htmlFor="ar-9-16" className="font-normal">9:16 (Portrait)</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personGeneration"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Person Generation</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="allow_adult" id="pg-allow" />
                          </FormControl>
                          <Label htmlFor="pg-allow" className="font-normal">Allow</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="dont_allow" id="pg-disallow" />
                          </FormControl>
                          <Label htmlFor="pg-disallow" className="font-normal">Do Not Allow</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>


            {generatedVideo && (
              <div className="w-full overflow-hidden rounded-lg border bg-muted flex justify-center">
                <video src={generatedVideo} controls autoPlay muted loop className="h-full max-h-[60vh] w-auto object-contain" />
              </div>
            )}
            {isGenerating && !generatedVideo && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted p-8 aspect-video">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Animating image... This may take up to a minute.</p>
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
