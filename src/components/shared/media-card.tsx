'use client';

import { MediaItem } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import NextImage from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Download, FileText } from 'lucide-react';
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
    link.href = item.src;
    const fileExtension = item.type === 'video' ? 'mp4' : 'png';
    link.download = `veo-studio-pro-${item.id}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="group overflow-hidden">
      <CardContent className="relative aspect-video p-0">
        {item.type === 'video' ? (
          <video src={item.src} controls muted loop className="h-full w-full bg-muted object-cover" />
        ) : (
          <NextImage src={item.src} alt={item.prompt || 'Generated image'} fill className="object-cover bg-muted" />
        )}
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="secondary" onClick={handleDownload}>
                <Download className="h-4 w-4"/>
                <span className="sr-only">Download</span>
            </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 p-4">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
          <time dateTime={item.createdAt}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </time>
        </div>
        {item.prompt && (
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className="flex items-start gap-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="truncate">{item.prompt}</span>
                    </p>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{item.prompt}</p>
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardFooter>
    </Card>
  );
}
