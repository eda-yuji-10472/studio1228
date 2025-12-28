'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-similar-prompts.ts';
import '@/ai/flows/generate-video-from-text.ts';
import '@/ai/flows/generate-video-from-still-image.ts';
import '@/ai/flows/proxy-fetch.ts';
import '@/ai/flows/generate-image-from-image.ts';
import '@/ai/flows/generate-image-from-text.ts';
import '@/ai/flows/generate-silhouette-from-image.ts';
