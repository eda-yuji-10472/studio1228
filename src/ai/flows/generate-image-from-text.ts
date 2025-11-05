'use server';

/**
 * @fileOverview Generates an image from a text prompt.
 *
 * - generateImageFromText - A function that handles the image generation process.
 * - GenerateImageFromTextInput - The input type for the generateImageFromText function.
 * - GenerateImageFromTextOutput - The return type for the generateImageFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const GenerateImageFromTextInputSchema = z.object({
  prompt: z.string().describe('The text prompt to use for image generation.'),
});
export type GenerateImageFromTextInput = z.infer<
  typeof GenerateImageFromTextInputSchema
>;

const GenerateImageFromTextOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a data URI.'),
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
export type GenerateImageFromTextOutput = z.infer<
  typeof GenerateImageFromTextOutputSchema
>;

export async function generateImageFromText(
  input: GenerateImageFromTextInput
): Promise<GenerateImageFromTextOutput> {
  return generateImageFromTextFlow(input);
}

const generateImageFromTextFlow = ai.defineFlow(
  {
    name: 'generateImageFromTextFlow',
    inputSchema: GenerateImageFromTextInputSchema,
    outputSchema: GenerateImageFromTextOutputSchema,
  },
  async input => {
    const {media, usage, custom, finishReason, safetyRatings} = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image-preview'),
      prompt: input.prompt,
       config: {
        responseModalities: ['IMAGE'],
      },
    });

    if (!media?.url) {
      return {
        imageDataUri: '',
        usage,
        cacheHit: custom?.cacheHit || false,
        finishReason,
        safetyRatings,
      }
    }

    const outputBase64 = media.url.split(',')[1];
    const imageDataUri = `data:image/png;base64,${outputBase64}`;

    return {
      imageDataUri,
      usage,
      cacheHit: custom?.cacheHit || false,
      finishReason,
      safetyRatings,
    };
  }
);
