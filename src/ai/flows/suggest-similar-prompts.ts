'use server';

/**
 * @fileOverview This file defines a Genkit flow to suggest similar prompts based on a given prompt.
 *
 * The flow takes a prompt as input and returns a list of suggested similar prompts.
 * It uses the Gemini LLM to generate the suggestions.
 *
 * @interface SuggestSimilarPromptsInput - The input type for the suggestSimilarPrompts function.
 * @interface SuggestSimilarPromptsOutput - The output type for the suggestSimilarPrompts function.
 * @function suggestSimilarPrompts - The function that handles the prompt suggestion process.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSimilarPromptsInputSchema = z.object({
  prompt: z.string().describe('The prompt to find similar prompts for.'),
});
export type SuggestSimilarPromptsInput = z.infer<typeof SuggestSimilarPromptsInputSchema>;

const SuggestSimilarPromptsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('A list of suggested similar prompts.'),
});
export type SuggestSimilarPromptsOutput = z.infer<typeof SuggestSimilarPromptsOutputSchema>;

export async function suggestSimilarPrompts(input: SuggestSimilarPromptsInput): Promise<SuggestSimilarPromptsOutput> {
  return suggestSimilarPromptsFlow(input);
}

const suggestSimilarPromptsPrompt = ai.definePrompt({
  name: 'suggestSimilarPromptsPrompt',
  input: {schema: SuggestSimilarPromptsInputSchema},
  output: {schema: SuggestSimilarPromptsOutputSchema},
  prompt: `You are an AI assistant that suggests similar prompts for video generation.

  Given the following prompt, generate a list of 5 similar prompts that could be used to generate videos.

  Prompt: {{{prompt}}}

  Suggestions:`,
});

const suggestSimilarPromptsFlow = ai.defineFlow(
  {
    name: 'suggestSimilarPromptsFlow',
    inputSchema: SuggestSimilarPromptsInputSchema,
    outputSchema: SuggestSimilarPromptsOutputSchema,
  },
  async input => {
    const {output} = await suggestSimilarPromptsPrompt(input);
    return output!;
  }
);
