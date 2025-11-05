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
import { Loader2, Text, Upload, AlertTriangle, Download } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { firestore, storage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import NextImage from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


const formSchema = z.object({
  csv: z.any().refine(files => files?.[0], 'Please upload a CSV file.'),
  stylePrompt: z.string().optional(),
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


/**
 * Creates an image from structured CSV data, drawing it in a table format.
 * @param headers The CSV headers.
 * @param row The data for a single CSV row.
 * @returns A data URI of the generated transparent PNG image with a grid.
 */
const createTextImage = (headers: string[], row: CsvRow): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        // --- Layout & Style Configuration ---
        const numColumns = Math.min(3, headers.length);
        const totalWidth = 1200;
        const cellPadding = 10;
        const columnGap = 0; // No gap for grid lines
        const rowGap = 0;
        const fontSize = 16;
        const lineHeight = fontSize * 1.5;
        const headerFontColor = '#333333';
        const valueFontColor = '#000000';
        const gridColor = '#DDDDDD';
        const evenCellColor = '#FFFFFF';
        const oddCellColor = '#F0F8FF'; // AliceBlue
        ctx.font = `bold ${fontSize}px sans-serif`;

        const columnWidth = (totalWidth - (cellPadding * 2 * numColumns) - (columnGap * (numColumns - 1))) / numColumns;

        // --- Text Wrapping and Measurement ---
        const wrapText = (text: string, maxWidth: number): string[] => {
            if (!text) return [''];
            const words = text.split(' ');
            let lines: string[] = [];
            let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        // --- Calculate Cell Dimensions and Total Height ---
        const cellData = headers.map(header => {
            const headerLines = wrapText(header, columnWidth - cellPadding * 2);
            const valueLines = wrapText(row[header] || '', columnWidth - cellPadding * 2);
            const cellHeight = (headerLines.length + valueLines.length) * lineHeight + cellPadding * 2;
            return { header, value: row[header] || '', headerLines, valueLines, cellHeight };
        });

        const rowHeights: number[] = [];
        for (let i = 0; i < cellData.length; i += numColumns) {
            const chunk = cellData.slice(i, i + numColumns);
            const maxRowHeight = Math.max(...chunk.map(c => c.cellHeight), 0);
            rowHeights.push(maxRowHeight);
        }

        const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + (rowHeights.length - 1) * rowGap;

        // --- Set Canvas Size ---
        canvas.width = totalWidth;
        canvas.height = totalHeight;

        // --- Drawing ---
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Ensure transparent background

        let currentY = 0;
        for (let i = 0; i < rowHeights.length; i++) {
            const rowHeight = rowHeights[i];
            const rowCells = cellData.slice(i * numColumns, i * numColumns + numColumns);

            let currentX = 0;
            for (let j = 0; j < numColumns; j++) {
                 // Fill cell background
                ctx.fillStyle = (i + j) % 2 === 0 ? evenCellColor : oddCellColor;
                ctx.fillRect(currentX, currentY, columnWidth, rowHeight);

                // Draw Cell Grid
                ctx.strokeStyle = gridColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(currentX, currentY, columnWidth, rowHeight);

                // Draw Text if cell exists
                if (j < rowCells.length) {
                    const cell = rowCells[j];
                    let textY = currentY + cellPadding;

                    // Draw Header
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.fillStyle = headerFontColor;
                    ctx.textBaseline = 'top';
                    cell.headerLines.forEach(line => {
                        ctx.fillText(line, currentX + cellPadding, textY);
                        textY += lineHeight;
                    });
                    
                    // Draw Value
                    ctx.font = `${fontSize}px sans-serif`;
                    ctx.fillStyle = valueFontColor;
                    cell.valueLines.forEach(line => {
                        ctx.fillText(line, currentX + cellPadding, textY);
                        textY += lineHeight;
                    });
                }
                currentX += columnWidth + columnGap;
            }
            currentY += rowHeight + rowGap;
        }

        resolve(canvas.toDataURL('image/png'));
    });
};

type Result = {
    prompt: string;
    imageUrl: string | null;
    filename: string;
    error?: string;
};

export function CsvToImageForm() {
  const [csvData, setCsvData] = useState<{ headers: string[], rows: CsvRow[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{ progress: number, currentTask: string, results: Result[] }>({ progress: 0, currentTask: '', results: [] });
  const [originalCsvFilename, setOriginalCsvFilename] = useState<string>('batch');
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('csv', e.target.files);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setOriginalCsvFilename(file.name.replace(/\.[^/.]+$/, "")); // Store filename without extension
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          const parsed = parseCsv(text);
           if (!parsed.headers || parsed.headers.length === 0 || parsed.rows.length === 0) {
             toast({
              variant: 'destructive',
              title: 'Invalid CSV',
              description: 'The CSV file appears to be empty or does not contain a valid header row and data.',
            });
            setCsvData(null);
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
  
  const sanitizeFilename = (text: string) => {
    return text.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 50);
  };

  const processRow = async (row: CsvRow, index: number, totalRows: number, headers: string[], stylePrompt: string | undefined) => {
    if (!user) throw new Error("User not authenticated.");

    let prompt: string;
    if (stylePrompt) {
        prompt = stylePrompt.replace(/{(\w+)}/g, (match, key) => {
            return row[key] || match;
        });
    } else {
        prompt = Object.entries(row)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    // Create a sortable and descriptive filename
    const rowIndexPadded = String(index + 1).padStart(String(totalRows).length, '0');
    const safePromptPart = sanitizeFilename(prompt);
    const filename = `${originalCsvFilename}-${rowIndexPadded}-${safePromptPart}.png`;

    if (!prompt) {
        setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt: `Row ${index + 1}`, imageUrl: null, filename, error: `Skipped: Row is empty or prompt is invalid.`}]}));
        return;
    }
    
    setProcessingStatus(prev => ({ ...prev, currentTask: `Converting text to image for row ${index + 1}` }));

    const imagesCollection = collection(firestore, 'users', user.uid, 'images');
    const newImageDocRef = doc(imagesCollection); // Still use this for Firestore ID

    try {
      await setDoc(newImageDocRef, {
        id: newImageDocRef.id,
        userId: user.uid,
        title: `Row ${index + 1}: ${prompt.substring(0, 100)}`,
        prompt: prompt,
        storageUrl: '',
        type: 'image' as const,
        status: 'processing' as const,
        filename, // Store the friendly filename
        createdAt: serverTimestamp(),
      });
      
      const imageDataUri = await createTextImage(headers, row);

      if (imageDataUri) {
        const imageRef = ref(storage, `users/${user.uid}/images/${filename}`);
        const uploadResult = await uploadString(imageRef, imageDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        await updateDoc(newImageDocRef, {
            storageUrl: downloadURL,
            status: 'completed',
        });

        setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt, imageUrl: downloadURL, filename}]}));
      } else {
        throw new Error('Canvas toDataURL failed.');
      }

    } catch (error: any) {
      console.error(error);
      const errorData = { status: 'failed' as const, error: error.message || 'Unknown error' };
      await updateDoc(newImageDocRef, errorData).catch(updateError => logError(updateError, { context: 'CsvToImageForm.processRow.updateError', userId: user?.uid }));
      setProcessingStatus(prev => ({...prev, results: [...prev.results, {prompt, imageUrl: null, filename, error: error.message}]}));
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

    const { headers, rows: rowsToProcess } = csvData;
    const totalRows = rowsToProcess.length;

    for (let i = 0; i < totalRows; i++) {
        await processRow(rowsToProcess[i], i, totalRows, headers, values.stylePrompt);
        setProcessingStatus(prev => ({ ...prev, progress: ((i + 1) / totalRows) * 100 }));
    }

    setProcessingStatus(prev => ({ ...prev, currentTask: 'Batch processing complete!' }));
    toast({ title: 'Batch Complete', description: `Processed ${totalRows} rows.`});
  };

  const handleReset = () => {
    setIsProcessing(false);
    setCsvData(null);
    setProcessingStatus({ progress: 0, currentTask: '', results: [] });
    form.reset({csv: null, stylePrompt: ''});
    setOriginalCsvFilename('batch');
    const fileInput = document.getElementById('csv-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDownloadAll = async () => {
    const successfulResults = processingStatus.results.filter(r => r.imageUrl);
    if (successfulResults.length === 0) {
        toast({
            variant: "destructive",
            title: "No Images to Download",
            description: "There are no successfully generated images to download.",
        });
        return;
    }

    setIsDownloading(true);
    toast({ title: "Preparing ZIP...", description: `Packaging ${successfulResults.length} images.` });

    try {
        const zip = new JSZip();
        
        await Promise.all(successfulResults.map(async (result) => {
            if (result.imageUrl) {
                // Fix: Fetch via Next.js image optimization endpoint to bypass CORS
                const fetchUrl = `/_next/image?url=${encodeURIComponent(result.imageUrl)}&w=3840&q=75`;
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image ${result.filename}: ${response.statusText}`);
                }
                const blob = await response.blob();
                zip.file(result.filename, blob);
            }
        }));

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${originalCsvFilename}-images.zip`);
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


  const isButtonDisabled = isProcessing || isUserLoading || !csvData;

  if (isProcessing || processingStatus.results.length > 0) {
    return (
        <Card className="max-w-4xl">
            <CardHeader>
                <CardTitle>Batch Conversion Progress</CardTitle>
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
                                                <NextImage src={result.imageUrl} alt={result.prompt} width={100} height={100} className="rounded-md object-cover aspect-square bg-gray-100 p-1"/>
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
            <CardFooter className="flex justify-between">
                 <Button onClick={handleReset}>Start New Batch</Button>
                 <Button onClick={handleDownloadAll} disabled={isDownloading || processingStatus.results.filter(r => r.imageUrl).length === 0}>
                    {isDownloading ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}
                    Download All as ZIP
                 </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleBatchGenerate)}>
          <CardHeader>
            <CardTitle>CSV to Image Conversion</CardTitle>
            <CardDescription>Upload a CSV file. Each row will be converted into a text-based image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="csv"
                  render={({ field }) => (
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
             </div>
            
            <FormField
                control={form.control}
                name="stylePrompt"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>2. Style Prompt (Optional)</FormLabel>
                    <FormControl>
                    <Textarea
                        placeholder="e.g., A high-quality, photorealistic image of {item}. Detailed, studio lighting, 8k."
                        className="min-h-[100px] resize-y"
                        {...field}
                    />
                    </FormControl>
                    <FormDescription>
                    Provide a template for the prompt. Use column headers in curly braces (e.g., {'{column_name}'}) to insert data from each row. If left blank, a generic prompt will be created from all columns.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />


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
                                            <TableCell key={header} className="max-w-[120px] truncate">
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
                {isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Text className="mr-2" />}
                Convert {csvData ? `${csvData.rows.length} Rows` : 'Rows'} to Images
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
