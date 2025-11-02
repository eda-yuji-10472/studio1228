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
import { generateImageFromImage } from '@/ai/flows/generate-image-from-image';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Upload, Wand2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { PromptSuggestions } from '@/components/shared/prompt-suggestions';
import { useUser } from '@/firebase/auth/use-user';
import { firestore, storage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { logError } from '@/lib/logger';
import * as mime from 'mime-types';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
});

export function ImageToImageForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleReset = () => {
    setGeneratedImage(null);
    setImagePreview(null);
    form.reset({ prompt: '' });
    const fileInput = document.getElementById('image-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in to generate media.' });
      return;
    }
    if (!imagePreview) {
      toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to modify.' });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    
    const imagesCollection = collection(firestore, 'users', user.uid, 'images');
    const newImageDocRef = doc(imagesCollection);

    try {
      const initialImageData = {
        id: newImageDocRef.id,
        userId: user.uid,
        title: values.prompt,
        prompt: values.prompt,
        storageUrl: '',
        type: 'image' as const,
        status: 'processing' as const,
        createdAt: serverTimestamp(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheHit: false,
      };
      await setDoc(newImageDocRef, initialImageData);
    } catch (error: any) {
      console.error('Failed to create initial Firestore document:', error);
      toast({
        variant: 'destructive',
        title: 'Firestore Error',
        description: `Could not create tracking document. Check permissions. ${error.message}`,
      });
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newImageDocRef.path, operation: 'create', requestResourceData: { title: values.prompt, status: 'processing'} }));
      setIsGenerating(false);
      return;
    }

    try {
      addPromptItem({ text: values.prompt });
      const result = await generateImageFromImage({ 
        photoDataUri: imagePreview, 
        prompt: values.prompt,
      });
      
      const docUpdate: any = {
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
        await updateDoc(newImageDocRef, docUpdate);
        toast({
          variant: 'destructive',
          title: 'Generation Blocked',
          description: 'The prompt or image was blocked by the safety policy. The details have been logged.',
        });
        setIsGenerating(false);
        return;
      }
      
      if (result.imageDataUri) {
        setGeneratedImage(result.imageDataUri);
        
        const contentType = result.imageDataUri.match(/data:(.*);base64,/)?.[1] || 'image/png';
        const extension = mime.extension(contentType) || 'png';
        
        const imageRef = ref(storage, `users/${user.uid}/images/${newImageDocRef.id}.${extension}`);
        const uploadResult = await uploadString(imageRef, result.imageDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        docUpdate.storageUrl = downloadURL;
        docUpdate.status = 'completed';
        
        await updateDoc(newImageDocRef, docUpdate);

        if (result.noChangeDetected) {
          toast({
            title: 'No Change Detected',
            description: "The model returned an identical image. Try a more specific prompt or a different image.",
          });
        } else {
          toast({
            title: 'Success!',
            description: `Your new image has been generated and saved. ${result.cacheHit ? '(from cache)' : ''}`,
          });
        }
      } else {
        throw new Error('Image generation failed to return an image.');
      }
    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newImageDocRef, errorData).catch(updateError => {
        console.error("Failed to update doc with error state:", updateError);
        logError(updateError, { context: 'ImageToImageForm.onSubmit.updateError', userId: user.uid });
      });
      
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'Something went wrong during the process. Please try again.',
      });
      await logError(error, { context: 'ImageToImageForm.onSubmit', userId: user.uid });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const currentPrompt = form.watch('prompt');
  const isButtonDisabled = isGenerating || isUserLoading;

  if (generatedImage) {
    return (
        <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Generation Complete</CardTitle>
          <CardDescription>Your new image has been successfully generated.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
           <div className="relative w-full max-w-md" style={{ maxHeight: '50vh' }}>
             <Image src={generatedImage} alt="Generated image" fill className="object-contain rounded-md" />
           </div>
           <Button onClick={handleReset} type="button" variant="outline" size="lg">
              <ArrowLeft className="mr-2" />
              Generate Another
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Image-to-Image Generation</CardTitle>
            <CardDescription>Upload a source image and describe the changes you want to see.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="image"
                  render={() => (
                    <FormItem>
                      <FormLabel>Source Image</FormLabel>
                      <FormControl>
                        <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:border-primary aspect-video">
                          {imagePreview ? (
                            <Image src={imagePreview} alt="Image preview" fill className="rounded-md object-contain" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-12">
                              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Click to upload</p>
                            </div>
                          )}
                          <Input id="image-upload-input" type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={isButtonDisabled} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Generating image...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <Wand2 className="h-10 w-10 text-muted-foreground mb-2"/>
                            <p className="text-sm text-muted-foreground">Your generated image will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Modification Prompt</FormLabel>
                <FormControl>
                    <Textarea 
                    placeholder="e.g., Change the background to a sunny beach, add a hat on the person" 
                    className="min-h-[100px] resize-y" 
                    {...field}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
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
                  Generate Image
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
