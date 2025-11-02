'use client';

import type { MediaItem } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import NextImage from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Download, FileText, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '../ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip"

interface MediaCardProps {
  item: MediaItem;
}

export function MediaCard({ item }: MediaCardProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = item.storageUrl;
    // Forcing download by setting the 'download' attribute might not work for all browser/server configurations
    // for cross-origin resources. A server-side solution is more reliable.
    // For simplicity, we'll just open the link in a new tab.
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    if (timestamp.toDate) { // It's a Firestore Timestamp
      return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
    }
    // It might be an ISO string from local state
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  }

  const cardMedia = item.type === 'video' ? (
    <video src={item.storageUrl} poster={item.thumbnailUrl} controls muted loop className="h-full w-full bg-muted object-contain" />
  ) : (
    <NextImage src={item.storageUrl} alt={item.prompt || 'Generated image'} fill className="object-contain bg-muted" />
  );

  return (
    <Card className="group overflow-hidden">
      <CardContent className="relative aspect-video p-0">
        {cardMedia}
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="secondary" onClick={handleDownload}>
                <Download className="h-4 w-4"/>
                <span className="sr-only">Download</span>
            </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 p-4">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span className='flex items-center gap-1.5'>
                {item.type === 'video' ? <Video className="h-3 w-3"/> : <ImageIcon className="h-3 w-3" />}
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </span>
            <time dateTime={item.createdAt}>
                {getTimestamp(item.createdAt)}
            </time>
        </div>
        {(item.prompt || item.title) && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className="flex items-start gap-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="truncate">{item.prompt || item.title}</span>
                    </p>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{item.prompt || item.title}</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardFooter>
    </Card>
  );
}
