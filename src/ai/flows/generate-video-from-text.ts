'use server';

/**
 * @fileOverview Generates a video from a text prompt using the VEO3 model.
 *
 * - generateVideoFromText - A function that generates a video from a text prompt.
 * - GenerateVideoFromTextInput - The input type for the generateVideoFromText function.
 * - GenerateVideoFromTextOutput - The return type for the generateVideoFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { proxyFetch } from './proxy-fetch';

const GenerateVideoFromTextInputSchema = z.object({
  prompt: z.string().describe('The text prompt to use for video generation.'),
});
export type GenerateVideoFromTextInput = z.infer<
  typeof GenerateVideoFromTextInputSchema
>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoDataUri: z.string().describe('The generated video as a data URI.'),
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
export type GenerateVideoFromTextOutput = z.infer<
  typeof GenerateVideoFromTextOutputSchema
>;

export async function generateVideoFromText(
  input: GenerateVideoFromTextInput
): Promise<GenerateVideoFromTextOutput> {
  return generateVideoFromTextFlow(input);
}

const generateVideoFromTextFlow = ai.defineFlow(
  {
    name: 'generateVideoFromTextFlow',
    inputSchema: GenerateVideoFromTextInputSchema,
    outputSchema: GenerateVideoFromTextOutputSchema,
  },
  async input => {
    let {operation, custom} = await ai.generate({
      model: googleAI.model('veo-3.0-generate-preview'),
      prompt: input.prompt,
      config: {
        aspectRatio: '16:9',
        safetySettings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
          ]
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation');
    }

    // Wait until the operation completes. Note that this may take some time,
    // maybe even up to a minute. Design the UI accordingly.
    while (!operation.done) {
      operation = await ai.checkOperation(operation);
      // Sleep for 5 seconds before checking again.
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const finishReason = operation.output?.candidates?.[0]?.finishReason;
    const safetyRatings = operation.output?.candidates?.[0]?.safetyRatings;

    if (operation.error) {
      // Even if there's an error, we might have safety data to return.
      if (finishReason === 'SAFETY') {
        return {
          videoDataUri: '',
          usage: operation.usage,
          cacheHit: custom?.cacheHit || false,
          finishReason,
          safetyRatings,
        }
      }
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
      usage: operation.usage,
      cacheHit: custom?.cacheHit || false,
      finishReason,
      safetyRatings,
    };
  }
);
