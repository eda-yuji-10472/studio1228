export type MediaItem = {
  id: string;
  type: 'video' | 'image';
  storageUrl: string; // Firebase Storage URL
  thumbnailUrl?: string; // Optional: for videos
  prompt?: string;
  createdAt: any; // Can be a server timestamp
  duration?: number;
  title: string;
  userId: string;
  status?: 'processing' | 'completed' | 'failed';
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type PromptItem = {
  id: string;
  text: string;
  createdAt: string;
};
