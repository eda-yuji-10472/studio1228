import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToVideoForm } from './text-to-video-form';
import { ImageToVideoForm } from './image-to-video-form';
import { ImageToImageForm } from './image-to-image-form';
import { Film, Image as ImageIcon, Wand2 } from 'lucide-react';

export default function CreatePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Create"
        description="Generate new media from text and images."
      />
      <main className="flex-1 p-6 pt-0">
        <Tabs defaultValue="text-to-video" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="text-to-video">
              <Film className="mr-2" />
              Text to Video
            </TabsTrigger>
            <TabsTrigger value="image-to-video">
              <ImageIcon className="mr-2" />
              Image to Video
            </TabsTrigger>
            <TabsTrigger value="image-to-image">
              <Wand2 className="mr-2" />
              Image to Image
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text-to-video" className="mt-6">
            <TextToVideoForm />
          </TabsContent>
          <TabsContent value="image-to-video" className="mt-6">
            <ImageToVideoForm />
          </TabsContent>
          <TabsContent value="image-to-image" className="mt-6">
            <ImageToImageForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
