'use server';
/**
 * @fileOverview Generates a video from a still image based on a text prompt.
 *
 * - generateVideoFromStillImage - A function that handles the video generation process.
 * - GenerateVideoFromStillImageInput - The input type for the generateVideoFromStillImage function.
 * - GenerateVideoFromStillImageOutput - The return type for the generateVideoFromStillImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { proxyFetch } from './proxy-fetch';

const GenerateVideoFromStillImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to animate, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The prompt to use to animate the image.'),
});
export type GenerateVideoFromStillImageInput = z.infer<
  typeof GenerateVideoFromStillImageInputSchema
>;

const GenerateVideoFromStillImageOutputSchema = z.object({
  videoDataUri: z.string().describe('The generated video as a data URI.'),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
});
export type GenerateVideoFromStillImageOutput = z.infer<
  typeof GenerateVideoFromStillImageOutputSchema
>;

export async function generateVideoFromStillImage(
  input: GenerateVideoFromStillImageInput
): Promise<GenerateVideoFromStillImageOutput> {
  return generateVideoFromStillImageFlow(input);
}

const generateVideoFromStillImageFlow = ai.defineFlow(
  {
    name: 'generateVideoFromStillImageFlow',
    inputSchema: GenerateVideoFromStillImageInputSchema,
    outputSchema: GenerateVideoFromStillImageOutputSchema,
  },
  async input => {
    const contentType = input.photoDataUri.match(/data:(.*);base64,/)?.[1];
    if (!contentType) {
      throw new Error('Could not determine content type from data URI.');
    }

    let {operation} = await ai.generate({
      model: googleAI.model('veo-3.0-generate-preview'),
      prompt: [
        {
          text: input.prompt,
        },
        {
          media: {
            url: input.photoDataUri,
            contentType,
          },
        },
      ],
      config: {
        durationSeconds: 5,
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation');
    }

    // Wait until the operation completes. Note that this may take some time, maybe even up to a minute. Design the UI accordingly.
    while (!operation.done) {
      operation = await ai.checkOperation(operation);
      // Sleep for 5 seconds before checking again.
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (operation.error) {
      throw new Error('failed to generate video: ' + operation.error.message);
    }

    const video = operation.output?.message?.content.find(p => !!p.media);
    if (!video || !video.media?.url) {
      throw new Error('Failed to find the generated video data URI');
    }
    
    // Fetch the raw URL through the proxy to get a data URI
    const proxied = await proxyFetch({ url: video.media.url });

    return {
      videoDataUri: proxied.dataUri,
      usage: operation.output?.usage,
    };
  }
);
