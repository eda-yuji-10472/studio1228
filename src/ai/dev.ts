import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-similar-prompts.ts';
import '@/ai/flows/generate-video-from-text.ts';
import '@/ai/flows/generate-video-from-still-image.ts';
import '@/ai/flows/proxy-fetch.ts';
