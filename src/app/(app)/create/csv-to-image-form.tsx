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
import { Loader2, Sparkles, Upload, FileText, Table as TableIcon, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { firestore, storage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { generateImageFromText, GenerateImageFromTextOutput } from '@/ai/flows/generate-image-from-text';
import * as mime from 'mime-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import NextImage from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  csv: z.any().refine(files => files instanceof FileList && files.length > 0, 'Please upload a CSV file.'),
  promptColumn: z.string().min(1, 'Please select the column to use for prompts.'),
});

type CsvRow = { [key: string]: string };

const parseCsv = (csvText: string): { headers: string[], rows: CsvRow[] } => {
  const lines = csvText.trim().split(/\r\n|\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    return headers.reduce((obj, header, index) => {
      const value = values[index] || '';
      obj[header] = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
      return obj;
    }, {} as CsvRow);
  });
  return { headers, rows };
};


export function CsvToImageForm() {
  const [csvData, setCsvData] = useState<{ headers: string[], rows: CsvRow[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{ progress: number, currentTask: string, results: {prompt: string, imageUrl: string | null, error?: string}[] }>({ progress: 0, currentTask: '', results: [] });
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      promptColumn: '',
    }
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      form.setValue('csv', files);
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          const parsed = parseCsv(text);
           if (!parsed.headers || parsed.headers.length === 0) {
             toast({
              variant: 'destructive',
              title: 'Invalid CSV',
              description: 'The CSV file appears to be empty or does not contain a valid header row.',
            });
            setCsvData(null);
            form.resetField('promptColumn');
            return;
          }
          setCsvData(parsed);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'CSV Parsing Error',
            description: 'Could not parse the CSV file. Please check its format.',
          });
          console.error(error);
        }
      };
      reader.readAsText(file);
    }
  };

  const processRow = async (row: CsvRow, index: number, total: number, promptColumn: string) => {
    if (!user) throw new Error("User not authenticated.");

    const prompt = row[promptColumn];

    if (!prompt) {
        setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt: `Row ${index + 1} (no prompt)`, imageUrl: null, error: `Skipped: '${promptColumn}' column is empty.`}]}));
        return;
    }
    
    setProcessingStatus(prev => ({ ...prev, currentTask: `Generating image for: "${prompt}"...` }));

    const imagesCollection = collection(firestore, 'users', user.uid, 'images');
    const newImageDocRef = doc(imagesCollection);

    try {
      await setDoc(newImageDocRef, {
        id: newImageDocRef.id,
        userId: user.uid,
        title: prompt,
        prompt: prompt,
        storageUrl: '',
        type: 'image' as const,
        status: 'processing' as const,
        createdAt: serverTimestamp(),
      });
      
      const result: GenerateImageFromTextOutput = await generateImageFromText({ prompt });

      const docUpdate: any = {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        cacheHit: result.cacheHit || false,
        finishReason: result.finishReason || null,
        safetyRatings: result.safetyRatings || [],
      };

      if (result.imageDataUri) {
        const contentType = result.imageDataUri.match(/data:(.*);base64,/)?.[1] || 'image/png';
        const extension = mime.extension(contentType) || 'png';
        const imageRef = ref(storage, `users/${user.uid}/images/${newImageDocRef.id}.${extension}`);
        const uploadResult = await uploadString(imageRef, result.imageDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        docUpdate.storageUrl = downloadURL;
        docUpdate.status = 'completed';
        await updateDoc(newImageDocRef, docUpdate);

        setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt, imageUrl: downloadURL}]}));
      } else {
        docUpdate.status = 'failed';
        const reason = result.finishReason || 'unknown';
        docUpdate.error = `Generation failed: ${reason}`;
        await updateDoc(newImageDocRef, docUpdate);
        setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt, imageUrl: null, error: `Generation failed: ${reason}`}]}));
      }

    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newImageDocRef, errorData).catch(updateError => logError(updateError, { context: 'CsvToImageForm.processRow.updateError', userId: user?.uid }));
      setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt, imageUrl: null, error: error.message}]}));
      await logError(error, { context: 'CsvToImageForm.processRow', userId: user.uid });
    }
  };

  const handleBatchGenerate = async (values: z.infer<typeof formSchema>) => {
    if (!csvData || !user) {
        toast({variant: "destructive", title: "Prerequisites not met", description: "Cannot start generation without CSV data and user login."});
        return;
    }
    
    setIsProcessing(true);
    setProcessingStatus({ progress: 0, currentTask: 'Starting...', results: [] });

    const rowsToProcess = csvData.rows;
    const totalRows = rowsToProcess.length;

    for (let i = 0; i < totalRows; i++) {
        await processRow(rowsToProcess[i], i, totalRows, values.promptColumn);
        setProcessingStatus(prev => ({ ...prev, progress: ((i + 1) / totalRows) * 100 }));
    }

    setProcessingStatus(prev => ({ ...prev, currentTask: 'Batch processing complete!' }));
    toast({ title: 'Batch Complete', description: `Processed ${totalRows} rows.`});
  };

  const handleReset = () => {
    setIsProcessing(false);
    setCsvData(null);
    setProcessingStatus({ progress: 0, currentTask: '', results: [] });
    form.reset();
    const fileInput = document.getElementById('csv-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  const isButtonDisabled = isProcessing || isUserLoading || !form.formState.isValid;

  if (isProcessing || processingStatus.results.length > 0) {
    return (
        <Card className="max-w-4xl">
            <CardHeader>
                <CardTitle>Batch Generation Progress</CardTitle>
                <CardDescription>{processingStatus.currentTask}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={processingStatus.progress} />
                <p className="text-sm text-muted-foreground text-center">{Math.round(processingStatus.progress)}% complete</p>
                
                <h4 className="font-semibold pt-4">Results:</h4>
                <div className="max-h-96 overflow-y-auto pr-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Image</TableHead>
                                <TableHead>Prompt</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processingStatus.results.map((result, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        {result.imageUrl ? (
                                            <a href={result.imageUrl} target="_blank" rel="noopener noreferrer">
                                                <NextImage src={result.imageUrl} alt={result.prompt} width={100} height={100} className="rounded-md object-cover aspect-square"/>
                                            </a>
                                        ) : <div className="w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-destructive"/></div>}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{result.prompt}</TableCell>
                                    <TableCell>
                                        {result.error ? (
                                            <span className="text-destructive text-xs">{result.error}</span>
                                        ) : (
                                            <span className="text-green-500 text-xs">Success</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleReset}>Start New Batch</Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="max-w-4xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleBatchGenerate)}>
          <CardHeader>
            <CardTitle>CSV to Image Generation</CardTitle>
            <CardDescription>Upload a CSV file and select the column containing prompts to generate an image for each row.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="csv"
                  render={() => (
                    <FormItem>
                      <FormLabel>1. Upload CSV File</FormLabel>
                      <FormControl>
                        <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:border-primary aspect-video">
                           <div className="flex flex-col items-center justify-center p-12 text-center">
                              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                              <p className="text-lg font-semibold text-muted-foreground">Click to upload or drag & drop</p>
                              <p className="text-sm text-muted-foreground">Any CSV file with a header row</p>
                            </div>
                          <Input
                            id="csv-upload-input"
                            type="file"
                            accept=".csv"
                            className="absolute h-full w-full opacity-0"
                            onChange={handleFileChange}
                            disabled={isProcessing}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {csvData && (
                    <FormField
                    control={form.control}
                    name="promptColumn"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>2. Select Prompt Column</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a column to use for prompts" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {csvData.headers.map(header => (
                                        <SelectItem key={header} value={header}>{header}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                 )}
             </div>

            {csvData && (
                <div>
                    <h4 className="font-semibold mb-2">CSV Data Preview</h4>
                    <div className="max-h-60 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {csvData.headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {csvData.rows.slice(0, 5).map((row, i) => (
                                    <TableRow key={i}>
                                        {csvData.headers.map(header => (
                                            <TableCell key={header} className={cn("max-w-xs truncate", form.watch('promptColumn') === header && 'bg-primary/10 font-medium')}>
                                                {row[header]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {csvData.rows.length > 5 && <p className="text-xs text-muted-foreground mt-2">Showing first 5 of {csvData.rows.length} rows.</p>}
                </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isButtonDisabled} size="lg">
                {isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Sparkles className="mr-2" />}
                Generate {csvData ? `${csvData.rows.length} Images` : 'Images'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

    