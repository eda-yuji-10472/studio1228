'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileJson } from 'lucide-react';
import Image from 'next/image';
import { logError } from '@/lib/logger';
import { saveAs } from 'file-saver';
import { Slider } from '@/components/ui/slider';

const formSchema = z.object({
  image: z.any().refine(file => file instanceof File, 'Please upload an image.'),
  gridCols: z.coerce.number().min(1).max(500),
  gridRows: z.coerce.number().min(1).max(500),
  threshold: z.coerce.number().min(0).max(255),
});

export function ImageToPatternForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gridCols: 160,
      gridRows: 90,
      threshold: 128,
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
  
  const handleAnalyzeAndDownload = async (values: z.infer<typeof formSchema>) => {
    if (!imagePreview) {
        toast({ variant: 'destructive', title: 'No Image', description: 'Please upload an image to analyze.' });
        return;
    }

    setIsAnalyzing(true);
    toast({ title: 'Analyzing Pattern...', description: 'Please wait while the image is analyzed.' });

    try {
      const { gridCols, gridRows, threshold } = values;

      const img = new window.Image();
      img.src = imagePreview;
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
      const pattern: number[][] = [];

      for (let y = 0; y < gridRows; y++) {
        const row: number[] = [];
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
            if (data[i + 3] > 128) { // Consider non-transparent pixels
              const brightness = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
              totalBrightness += brightness;
              pixelCount++;
            }
          }
          
          const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 255; // Default to white if no pixels
          
          // 1 for black (dark), 0 for white (light)
          row.push(avgBrightness < threshold ? 1 : 0);
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
      await logError(error, { context: 'ImageToPatternForm.handleAnalyzeAndDownload' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const thresholdValue = form.watch('threshold');

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleAnalyzeAndDownload)}>
          <CardHeader>
            <CardTitle>Image to Pattern</CardTitle>
            <CardDescription>Upload any image to analyze its color pattern and convert it into a JSON grid of 0s and 1s.</CardDescription>
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
                        <Image src={imagePreview} alt="Image preview" fill className="rounded-md object-contain p-2" />
                        ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                            <p className="text-lg font-semibold text-muted-foreground">Click to upload or drag & drop</p>
                            <p className="text-sm text-muted-foreground">Any standard image format</p>
                        </div>
                        )}
                        <Input id="pattern-image-upload-input" type="file" accept="image/*" className="absolute h-full w-full opacity-0" onChange={handleImageChange} disabled={isAnalyzing} />
                    </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="gridCols"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Grid Columns</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="gridRows"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Grid Rows</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="threshold"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Brightness Threshold</FormLabel>
                        <div className='flex items-center gap-4'>
                            <FormControl className='flex-1'>
                                <Slider
                                    min={0}
                                    max={255}
                                    step={1}
                                    value={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                />
                            </FormControl>
                            <span className="font-mono text-sm w-12 text-center border rounded-md p-2">{thresholdValue}</span>
                        </div>
                         <FormDescription>
                            The brightness value (0-255) to distinguish black (1) from white (0). Lower values treat more pixels as white.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isAnalyzing || !imagePreview} size="lg">
              {isAnalyzing ? <Loader2 className="mr-2 animate-spin" /> : <FileJson className="mr-2" />}
              Analyze and Download JSON
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
