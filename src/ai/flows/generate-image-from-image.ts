'use server';
/**
 * @fileOverview Generates an image from a source image and a text prompt.
 *
 * - generateImageFromImage - A function that handles the image generation process.
 * - GenerateImageFromImageInput - The input type for the generateImageFromImage function.
 * - GenerateImageFromImageOutput - The return type for the generateImageFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const GenerateImageFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A source photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The prompt to use to modify the image.'),
});
export type GenerateImageFromImageInput = z.infer<
  typeof GenerateImageFromImageInputSchema
>;

const GenerateImageFromImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI.'),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  cacheHit: z.boolean().optional(),
});
export type GenerateImageFromImageOutput = z.infer<
  typeof GenerateImageFromImageOutputSchema
>;

export async function generateImageFromImage(
  input: GenerateImageFromImageInput
): Promise<GenerateImageFromImageOutput> {
  return generateImageFromImageFlow(input);
}

const generateImageFromImageFlow = ai.defineFlow(
  {
    name: 'generateImageFromImageFlow',
    inputSchema: GenerateImageFromImageInputSchema,
    outputSchema: GenerateImageFromImageOutputSchema,
  },
  async input => {
    const contentType = input.photoDataUri.match(/data:(.*);base64,/)?.[1];
    if (!contentType) {
      throw new Error('Could not determine content type from data URI.');
    }

    const {media, usage, custom} = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image-preview'),
      prompt: [
        {text: input.prompt},
        {media: {url: input.photoDataUri, contentType}},
      ],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return an image.');
    }
    
    // The model returns a PNG, let's ensure the data URI reflects that
    const imageDataUri = `data:image/png;base64,${media.url.split(',')[1]}`;

    return {
      imageDataUri,
      usage,
      cacheHit: custom?.cacheHit || false,
    };
  }
);
