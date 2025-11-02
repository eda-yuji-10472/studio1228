'use server';

/**
 * @fileOverview A Genkit flow that acts as a server-side proxy to fetch a URL.
 * This is used to bypass client-side CORS issues when fetching from certain domains.
 *
 * - proxyFetch - A function that fetches a URL on the server and returns its content as a data URI.
 * - ProxyFetchInput - The input type for the proxyFetch function.
 * - ProxyFetchOutput - The return type for the proxyFetch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fetch from 'node-fetch';

const ProxyFetchInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch.'),
});
export type ProxyFetchInput = z.infer<typeof ProxyFetchInputSchema>;

const ProxyFetchOutputSchema = z.object({
  dataUri: z.string().describe('The fetched content as a data URI.'),
});
export type ProxyFetchOutput = z.infer<typeof ProxyFetchOutputSchema>;

export async function proxyFetch(input: ProxyFetchInput): Promise<ProxyFetchOutput> {
  return proxyFetchFlow(input);
}

const proxyFetchFlow = ai.defineFlow(
  {
    name: 'proxyFetchFlow',
    inputSchema: ProxyFetchInputSchema,
    outputSchema: ProxyFetchOutputSchema,
  },
  async (input) => {
    try {
      const response = await fetch(input.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: Server responded with status ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUri = `data:${contentType};base64,${base64}`;

      return { dataUri };
    } catch (error: any) {
      console.error('Proxy Fetch Flow Error:', error);
      throw new Error(`Failed to fetch URL through proxy: ${error.message}`);
    }
  }
);
