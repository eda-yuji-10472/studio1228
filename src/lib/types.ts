export type MediaItem = {
  id: string;
  type: 'video' | 'image';
  storageUrl: string; // Firebase Storage URL
  thumbnailUrl?: string; // Optional: for videos
  prompt?: string;
  createdAt: string;
  duration?: number;
  title: string;
  userId: string;
};

export type PromptItem = {
  id: string;
  text: string;
  createdAt: string;
};
