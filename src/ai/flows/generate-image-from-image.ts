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
  noChangeDetected: z.boolean().optional().describe('True if the output image is identical to the input.'),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  cacheHit: z.boolean().optional(),
  finishReason: z.string().optional(),
  safetyRatings: z.array(z.object({
    category: z.string(),
    probability: z.string(),
  })).optional(),
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

    const {media, usage, custom, finishReason, safetyRatings} = await ai.generate({
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
      // If generation failed for any reason, return the reason to the client.
      return {
        imageDataUri: '',
        usage,
        cacheHit: custom?.cacheHit || false,
        finishReason,
        safetyRatings,
      }
    }
    
    // The model returns a PNG, let's ensure the data URI reflects that
    const outputBase64 = media.url.split(',')[1];
    const imageDataUri = `data:image/png;base64,${outputBase64}`;

    // Compare input and output to see if there was a change
    const inputBase64 = input.photoDataUri.split(',')[1];
    const noChangeDetected = inputBase64 === outputBase64;

    return {
      imageDataUri,
      noChangeDetected,
      usage,
      cacheHit: custom?.cacheHit || false,
      finishReason,
      safetyRatings,
    };
  }
);
