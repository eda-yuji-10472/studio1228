'use server';
/**
 * @fileOverview Generates a silhouette from a source image and a text prompt.
 *
 * - generateSilhouetteFromImage - A function that handles the silhouette generation process.
 * - GenerateSilhouetteFromImageInput - The input type for the generateSilhouetteFromImage function.
 * - GenerateSilhouetteFromImageOutput - The return type for the generateSilhouetteFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const GenerateSilhouetteFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A source photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('A description of the subject to be turned into a silhouette.'),
});
export type GenerateSilhouetteFromImageInput = z.infer<
  typeof GenerateSilhouetteFromImageInputSchema
>;

const GenerateSilhouetteFromImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated silhouette image as a data URI.'),
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
export type GenerateSilhouetteFromImageOutput = z.infer<
  typeof GenerateSilhouetteFromImageOutputSchema
>;

export async function generateSilhouetteFromImage(
  input: GenerateSilhouetteFromImageInput
): Promise<GenerateSilhouetteFromImageOutput> {
  return generateSilhouetteFromImageFlow(input);
}

const systemPrompt = `You are an expert at image processing. Your task is to take a user-provided image and a prompt describing a subject within that image.

You must identify the specified subject and create a new image that contains only the silhouette of that subject.

The silhouette must be solid black (#000000).
The background of the new image, and everything that is not part of the subject's silhouette, must be solid white (#FFFFFF).

Do not include any other elements from the original image. Only the black silhouette on a solid white background.`;

const generateSilhouetteFromImageFlow = ai.defineFlow(
  {
    name: 'generateSilhouetteFromImageFlow',
    inputSchema: GenerateSilhouetteFromImageInputSchema,
    outputSchema: GenerateSilhouetteFromImageOutputSchema,
  },
  async input => {
    const contentType = input.photoDataUri.match(/data:(.*);base64,/)?.[1];
    if (!contentType) {
      throw new Error('Could not determine content type from data URI.');
    }

    const {media, usage, custom, finishReason, safetyRatings} = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image-preview'),
      prompt: [
        {text: systemPrompt},
        {text: `Subject to isolate: ${input.prompt}`},
        {media: {url: input.photoDataUri, contentType}},
      ],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    if (!media?.url) {
      // If generation failed for any reason (e.g. safety), return the reason to the client.
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

    return {
      imageDataUri,
      usage,
      cacheHit: custom?.cacheHit || false,
      finishReason,
      safetyRatings,
    };
  }
);
