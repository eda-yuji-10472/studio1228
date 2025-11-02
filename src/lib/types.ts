export type MediaItem = {
  id: string;
  type: 'video' | 'image';
  src: string; // data URI or URL
  prompt?: string;
  createdAt: string;
};

export type PromptItem = {
  id: string;
  text: string;
  createdAt: string;
};
