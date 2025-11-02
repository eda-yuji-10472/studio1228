import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Film, Image, Music, Scissors, Plus, Play, FastForward, Rewind, Volume2 } from 'lucide-react';

export default function EditorPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Editor"
        description="A space to cut, merge, and refine your videos. (UI Mockup)"
      />
      <main className="flex-1 overflow-hidden p-6 pt-0">
        <div className="flex h-full gap-6">
          {/* Media Bin */}
          <Card className="hidden w-80 shrink-0 lg:flex lg:flex-col">
            <CardHeader>
              <CardTitle>Media Bin</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full p-4">
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="relative aspect-video rounded-md bg-muted">
                      <div className="absolute bottom-1 left-1 rounded-full bg-black/50 p-1">
                        {i % 2 === 0 ? <Film className="h-3 w-3 text-white" /> : <Image className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Editor */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Preview Window */}
            <Card className="flex-1">
              <div className="flex h-full flex-col">
                <div className="flex-1 bg-black flex items-center justify-center">
                    <Play className="h-16 w-16 text-muted"/>
                </div>
                <div className="flex items-center justify-between border-t p-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon"><Rewind className="h-5 w-5"/></Button>
                    <Button variant="ghost" size="icon"><Play className="h-5 w-5"/></Button>
                    <Button variant="ghost" size="icon"><FastForward className="h-5 w-5"/></Button>
                  </div>
                  <div className="text-xs font-mono">00:00 / 00:15</div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5"/>
                    <Button variant="ghost" size="icon"><Scissors className="h-5 w-5"/></Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <Card className="h-48 shrink-0">
              <div className="flex h-full flex-col p-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>00:00</span>
                  <span>00:05</span>
                  <span>00:10</span>
                  <span>00:15</span>
                </div>
                <Separator className="my-2" />
                <div className="flex-1 space-y-2 overflow-hidden">
                  {/* Video Track */}
                  <div className="flex h-12 items-center gap-2 rounded-md bg-secondary p-2">
                    <Film className="h-5 w-5 shrink-0 text-secondary-foreground" />
                    <div className="h-full flex-1 bg-primary/20 rounded-sm"></div>
                    <div className="h-full w-24 bg-primary/20 rounded-sm"></div>
                  </div>
                  {/* Audio Track */}
                  <div className="flex h-12 items-center gap-2 rounded-md bg-secondary p-2">
                    <Music className="h-5 w-5 shrink-0 text-secondary-foreground" />
                     <div className="h-full w-48 bg-accent/20 rounded-sm"></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
