'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/app-context';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaCard } from '@/components/shared/media-card';
import { Bot, FileText, Image as ImageIcon, Video } from 'lucide-react';
import { formatDistanceToNow, subDays } from 'date-fns';
import { PromptSuggestions } from '@/components/shared/prompt-suggestions';
import { useCollection, useMemoFirebase } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { firestore } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore';
import type { MediaItem } from '@/lib/types';


function MediaGrid() {
  const { user, isLoading: isUserLoading } = useUser();

  const thirtyDaysAgo = useMemo(() => {
    return Timestamp.fromDate(subDays(new Date(), 30));
  }, []);

  const videosQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'videos'),
      where('createdAt', '>=', thirtyDaysAgo),
      orderBy('createdAt', 'desc')
    );
  }, [user, thirtyDaysAgo]);

  const imagesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'images'),
      where('createdAt', '>=', thirtyDaysAgo),
      orderBy('createdAt', 'desc')
    );
  }, [user, thirtyDaysAgo]);

  const { data: videos, isLoading: isLoadingVideos } = useCollection<MediaItem>(videosQuery);
  const { data: images, isLoading: isLoadingImages } = useCollection<MediaItem>(imagesQuery);

  const isLoading = isUserLoading || isLoadingVideos || isLoadingImages;

  const allMedia: MediaItem[] = useMemo(() => {
    const combined = [...(videos || []), ...(images || [])];
    // Firestore's serverTimestamp can be null briefly, so handle that
    combined.sort((a, b) => {
        const dateA = (a.createdAt as any)?.toDate?.() || 0;
        const dateB = (b.createdAt as any)?.toDate?.() || 0;
        return dateB - dateA;
    });
    return combined;
  }, [videos, images]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (allMedia.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
        <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Your recent media library is empty</h3>
        <p className="text-sm text-muted-foreground">Media older than 30 days is hidden. Start by creating something new!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {allMedia.map(item => <MediaCard key={item.id} item={item} />)}
    </div>
  );
}


export default function LibraryPage() {
  const { promptHistory, isHydrated } = useAppContext();
  
  const handleSuggestionSelect = (suggestion: string) => {
    navigator.clipboard.writeText(suggestion);
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Library"
        description="Browse your generated media and prompt history from the last 30 days."
      />
      <main className="flex-1 p-6 pt-0">
        <Tabs defaultValue="media" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="media">
              <Video className="mr-2" />
              Media
            </TabsTrigger>
            <TabsTrigger value="prompts">
              <FileText className="mr-2" />
              Prompts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="media" className="mt-6">
            <MediaGrid />
          </TabsContent>

          <TabsContent value="prompts" className="mt-6">
            {!isHydrated ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : promptHistory.length > 0 ? (
                <div className="space-y-2">
                    {promptHistory.map(prompt => (
                        <div key={prompt.id} className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <p className="font-mono text-sm">{prompt.text}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
                                </p>
                            </div>
                            <PromptSuggestions originalPrompt={prompt.text} onSelectSuggestion={handleSuggestionSelect} />
                        </div>
                    ))}
                </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No prompt history</h3>
                <p className="text-sm text-muted-foreground">Your used prompts will appear here.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
