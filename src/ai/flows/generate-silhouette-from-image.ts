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
  prompt: z.string().describe('A detailed description of what to make black and what to make white.'),
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

const systemPrompt = `You are an expert at image processing. Your task is to create a two-color image from a user's photo and a set of instructions.

**CRITICAL RULE: The final output MUST be a pure black and white image. There are no exceptions.**
- Use solid black (#000000) and solid white (#FFFFFF) only.
- Do NOT use any shades of gray, anti-aliasing, gradients, or any other colors.

Your primary goal is to follow the user's instructions on what parts of the image to make black and what parts to make white. The user's prompt is the source of truth.

For example, if the user says "make the horse black and the background white", you will do exactly that. If they say "make the horse's body white and its legs black, with a white background", you will follow that instruction.

Analyze the user's prompt and the provided image, then generate a new image that strictly adheres to both the user's instructions and the critical black-and-white-only rule.`;

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
        {text: `User instructions: ${input.prompt}`},
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
