import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToVideoForm } from './text-to-video-form';
import { ImageToVideoForm } from './image-to-video-form';
import { Film, Image as ImageIcon } from 'lucide-react';

export default function CreatePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Create"
        description="Generate new videos from text or images."
      />
      <main className="flex-1 p-6 pt-0">
        <Tabs defaultValue="text-to-video" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="text-to-video">
              <Film className="mr-2" />
              Text to Video
            </TabsTrigger>
            <TabsTrigger value="image-to-video">
              <ImageIcon className="mr-2" />
              Image to Video
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text-to-video" className="mt-6">
            <TextToVideoForm />
          </TabsContent>
          <TabsContent value="image-to-video" className="mt-6">
            <ImageToVideoForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
