'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Grid, Download, ArrowLeft } from 'lucide-react';
import NextImage from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  rows: z.coerce.number().min(1, 'Must be at least 1.').max(10, 'Cannot be more than 10.'),
  cols: z.coerce.number().min(1, 'Must be at least 1.').max(10, 'Cannot be more than 10.'),
});

type SplitResult = {
  imageDataUrl: string;
  filename: string;
};

export function ImageGridSplitForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string>('image');
  const [splitResults, setSplitResults] = useState<SplitResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rows: 2,
      cols: 2,
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file);
      setOriginalFilename(file.name.replace(/\.[^/.]+$/, ""));
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        const img = new window.Image();
        img.src = result;
        img.onload = () => setOriginalImage(img);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setOriginalImage(null);
    setSplitResults([]);
    setIsProcessing(false);
    form.reset({ rows: 2, cols: 2, image: undefined });
    const fileInput = document.getElementById('grid-split-image-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!originalImage) {
      toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to split.' });
      return;
    }
    
    setIsProcessing(true);
    setSplitResults([]);

    try {
        const { rows, cols } = values;
        const tileWidth = Math.floor(originalImage.naturalWidth / cols);
        const tileHeight = Math.floor(originalImage.naturalHeight / rows);

        if (tileWidth === 0 || tileHeight === 0) {
            throw new Error("Calculated tile dimension is zero. Please check image size and row/column count.");
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        canvas.width = tileWidth;
        canvas.height = tileHeight;

        const results: SplitResult[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const sx = c * tileWidth;
                const sy = r * tileHeight;
                
                ctx.clearRect(0, 0, tileWidth, tileHeight);
                ctx.drawImage(originalImage, sx, sy, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
                
                const imageDataUrl = canvas.toDataURL('image/png');
                const filename = `${originalFilename}_${String(r).padStart(2, '0')}_${String(c).padStart(2, '0')}.png`;
                results.push({ imageDataUrl, filename });
            }
        }
        setSplitResults(results);
        toast({ title: 'Success!', description: `Image split into ${results.length} tiles.` });

    } catch (error: any) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: 'Processing Failed',
            description: error.message || 'Something went wrong during the process. Please try again.',
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (splitResults.length === 0) return;

    setIsDownloading(true);
    toast({ title: "Preparing ZIP...", description: `Packaging ${splitResults.length} images.` });

    try {
        const zip = new JSZip();
        for (const result of splitResults) {
            const response = await fetch(result.imageDataUrl);
            const blob = await response.blob();
            zip.file(result.filename, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${originalFilename}-split-images.zip`);
        toast({ title: "Download Started", description: "Your ZIP file is being downloaded." });
    } catch (error: any) {
        console.error("Failed to create ZIP file", error);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: `Could not create the ZIP file. ${error.message}`,
        });
    } finally {
        setIsDownloading(false);
    }
  };

  const isButtonDisabled = isProcessing;

  if (splitResults.length > 0) {
    return (
        <Card className="max-w-4xl">
            <CardHeader>
                <CardTitle>Splitting Complete</CardTitle>
                <CardDescription>{`Your image was successfully split into ${splitResults.length} tiles.`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2 overflow-y-auto max-h-[60vh] p-1" style={{ gridTemplateColumns: `repeat(${form.getValues('cols')}, minmax(0, 1fr))` }}>
                    {splitResults.map((result, index) => (
                        <div key={index} className="relative aspect-square border rounded-md">
                            <NextImage src={result.imageDataUrl} alt={result.filename} fill className="object-contain"/>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                 <Button onClick={handleReset} variant="outline">
                    <ArrowLeft className="mr-2" />
                    Split Another Image
                 </Button>
                 <Button onClick={handleDownloadAll} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}
                    Download All as ZIP
                 </Button>
            </CardFooter>
        </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Image Grid Split</CardTitle>
            <CardDescription>Upload an image and specify how many rows and columns to split it into.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel>Source Image</FormLabel>
                  <FormControl>
                    <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:border-primary aspect-video">
                      {imagePreview ? (
                        <NextImage src={imagePreview} alt="Image preview" fill className="rounded-md object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                          <p className="text-lg font-semibold text-muted-foreground">Click to upload or drag & drop</p>
                          <p className="text-sm text-muted-foreground">Any standard image format</p>
                        </div>
                      )}
                      <Input id="grid-split-image-input" type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={isButtonDisabled} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="rows"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rows</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" max="10" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="cols"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Columns</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" max="10" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isButtonDisabled} size="lg">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Splitting...
                </>
              ) : (
                <>
                  <Grid className="mr-2" />
                  Split Image
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
