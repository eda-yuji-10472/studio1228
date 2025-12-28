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
import { generateSilhouetteFromImage, GenerateSilhouetteFromImageOutput } from '@/ai/flows/generate-silhouette-from-image';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Upload, ArrowLeft, Footprints, FileJson, Download } from 'lucide-react';
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
import { saveAs } from 'file-saver';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  prompt: z.string().min(3, 'Prompt must be at least 3 characters long.'),
});

export function ImageToSilhouetteForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    const fileInput = document.getElementById('silhouette-image-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleAnalyzeAndDownload = async () => {
    if (!generatedImage) return;

    setIsAnalyzing(true);
    toast({ title: 'Analyzing Pattern...', description: 'Please wait while the image is analyzed.' });

    try {
      const gridCols = 160;
      const gridRows = 90;

      const img = new window.Image();
      img.src = generatedImage;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.drawImage(img, 0, 0);

      const cellWidth = canvas.width / gridCols;
      const cellHeight = canvas.height / gridRows;
      const pattern: string[][] = [];

      for (let y = 0; y < gridRows; y++) {
        const row: string[] = [];
        for (let x = 0; x < gridCols; x++) {
          const sx = Math.floor(x * cellWidth);
          const sy = Math.floor(y * cellHeight);
          const sw = Math.ceil(cellWidth);
          const sh = Math.ceil(cellHeight);
          
          const imageData = ctx.getImageData(sx, sy, sw, sh);
          const data = imageData.data;
          let totalBrightness = 0;
          let pixelCount = 0;

          for (let i = 0; i < data.length; i += 4) {
            // Only consider pixels with alpha > 0.5 to avoid transparent edges
            if (data[i + 3] > 128) {
              // RGB to brightness (0-255)
              const brightness = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
              totalBrightness += brightness;
              pixelCount++;
            }
          }
          
          const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 255;
          
          // Use a threshold to decide. 128 is halfway between black (0) and white (255)
          row.push(avgBrightness < 128 ? 'black' : 'white');
        }
        pattern.push(row);
      }
      
      const jsonString = JSON.stringify({ grid: pattern }, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      saveAs(blob, 'pattern.json');

      toast({ title: 'Success!', description: 'The image pattern has been downloaded as pattern.json' });

    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast({ variant: 'destructive', title: 'Analysis Failed', description: error.message });
      await logError(error, { context: 'ImageToSilhouetteForm.handleAnalyzeAndDownload', userId: user?.uid });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in to generate media.' });
      return;
    }
    if (!imagePreview) {
      toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to create a silhouette from.' });
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
        title: `Silhouette of: ${values.prompt}`,
        prompt: values.prompt,
        storageUrl: '',
        type: 'image' as const,
        status: 'processing' as const,
        createdAt: serverTimestamp(),
        finishReason: '',
        safetyRatings: [],
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
      const result: GenerateSilhouetteFromImageOutput = await generateSilhouetteFromImage({ 
        photoDataUri: imagePreview, 
        prompt: values.prompt,
      });
      
      const docUpdate: any = {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        cacheHit: result.cacheHit || false,
        finishReason: result.finishReason || null,
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

        toast({
          title: 'Success!',
          description: `Your new silhouette has been generated and saved. ${result.cacheHit ? '(from cache)' : ''}`,
        });
      } else {
         const reason = result.finishReason || 'unknown';
         docUpdate.status = 'failed';
         docUpdate.error = `Generation failed with reason: ${reason}`;
         await updateDoc(newImageDocRef, docUpdate);
      }
    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newImageDocRef, errorData).catch(updateError => {
        console.error("Failed to update doc with error state:", updateError);
        logError(updateError, { context: 'ImageToSilhouetteForm.onSubmit.updateError', userId: user.uid });
      });
      
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'Something went wrong during the process. Please try again.',
      });
      await logError(error, { context: 'ImageToSilhouetteForm.onSubmit', userId: user.uid });
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
          <CardDescription>Your new silhouette has been successfully generated. You can now download the image or its pattern.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
           <div className="relative w-full max-w-md bg-white rounded-md" style={{ aspectRatio: '16 / 9' }}>
             <Image src={generatedImage} alt="Generated silhouette" fill className="object-contain" />
           </div>
           <div className="flex gap-2">
             <Button onClick={handleReset} type="button" variant="outline" size="lg">
                <ArrowLeft className="mr-2" />
                Generate Another
            </Button>
            <Button onClick={handleAnalyzeAndDownload} type="button" variant="secondary" size="lg" disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 className="mr-2 animate-spin" /> : <FileJson className="mr-2" />}
                Save Pattern as JSON
            </Button>
           </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Image to Silhouette</CardTitle>
            <CardDescription>Upload an image and describe which parts should be black and which should be white. The final image will be pure black and white.</CardDescription>
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
                          <Input id="silhouette-image-upload-input" type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={isButtonDisabled} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="aspect-video w-full overflow-hidden rounded-lg border bg-white flex items-center justify-center">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center gap-4 p-4 rounded-lg bg-background/80">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Generating silhouette...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <Footprints className="h-10 w-10 text-muted-foreground mb-2"/>
                            <p className="text-sm text-muted-foreground">Your generated silhouette will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Black and White Instructions</FormLabel>
                <FormControl>
                    <Textarea 
                    placeholder="e.g., 'Make the running horse black and everything else white.' or 'Make the horse's body white and its legs black, with a white background.'" 
                    className="min-h-[100px] resize-y" 
                    {...field}
                    />
                </FormControl>
                <FormDescription>
                Describe what should be black and what should be white. The AI will follow your instructions.
                </FormDescription>
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
                  Generate Silhouette
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
