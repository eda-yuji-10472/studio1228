import { PageHeader } from '@/components/shared/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToVideoForm } from './text-to-video-form';
import { ImageToVideoForm } from './image-to-video-form';
import { ImageToImageForm } from './image-to-image-form';
import { CsvToImageForm } from './csv-to-image-form';
import { ImageToSilhouetteForm } from './image-to-silhouette-form';
import { Film, Image as ImageIcon, Wand2, FileText, Footprints, Grid } from 'lucide-react';
import { ImageGridSplitForm } from './image-grid-split-form';

export default function CreatePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Create"
        description="Generate new media from text and images."
      />
      <main className="flex-1 p-6 pt-0">
        <Tabs defaultValue="text-to-video" className="w-full">
          <TabsList className="grid w-full grid-cols-6 md:w-[1200px]">
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
            <TabsTrigger value="csv-to-image">
              <FileText className="mr-2" />
              CSV to Text Image
            </TabsTrigger>
            <TabsTrigger value="image-to-silhouette">
              <Footprints className="mr-2" />
              Image to Silhouette
            </TabsTrigger>
            <TabsTrigger value="grid-split">
              <Grid className="mr-2" />
              画像分割
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
          <TabsContent value="csv-to-image" className="mt-6">
            <CsvToImageForm />
          </TabsContent>
          <TabsContent value="image-to-silhouette" className="mt-6">
            <ImageToSilhouetteForm />
          </TabsContent>
          <TabsContent value="grid-split" className="mt-6">
            <ImageGridSplitForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
