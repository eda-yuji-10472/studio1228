'use client';

import { useState, useEffect } from 'react';
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
import { useAuth, useStorage, useUser } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.'),
});

export function ImageToVideoForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { addMediaItem, addPromptItem } = useAppContext();
  const { toast } = useToast();
  const storage = useStorage();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    },
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      form.setValue('image', file);

      try {
        const storageRef = ref(storage, `users/${user.uid}/uploads/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setImagePreview(dataUrl); // Use data URL for local preview
          // We will use the dataUrl for generation, but downloadURL could be used for other purposes
        };
        reader.readAsDataURL(file);

        addMediaItem({ type: 'image', src: downloadURL }); // Store storage URL
      } catch (error) {
        console.error("Upload failed", error);
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Could not upload image to storage.",
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!imagePreview) {
      toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to animate.' });
      return;
    }
    setIsGenerating(true);
    setGeneratedVideo(null);
    try {
      addPromptItem({ text: values.prompt });
      const result = await generateVideoFromStillImage({ photoDataUri: imagePreview, prompt: values.prompt });
      if (result.videoDataUri) {
        setGeneratedVideo(result.videoDataUri);
        addMediaItem({
          type: 'video',
          src: result.videoDataUri,
          prompt: values.prompt,
        });
        toast({
          title: 'Success!',
          description: 'Your animated video has been generated and added to your library.',
        });
      } else {
        throw new Error('Video generation failed to return a video.');
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: 'Something went wrong while generating your video. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const currentPrompt = form.watch('prompt');

  const showUploadSpinner = isUploading || (isUserLoading && form.getValues('image'));

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
                       {showUploadSpinner && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                      <Input type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={!user || isUploading} />
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
            <Button type="submit" disabled={isGenerating || !imagePreview || isUploading} size="lg">
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
