/** Lightweight image info for queued messages (no File blob to avoid memory leaks) */
export interface QueuedImageInfo {
  id: string;
  name: string;
  preview: string; // data URL for preview display
}

export interface QueuedMessageInfo {
  queueId: string;
  text: string;
  images?: QueuedImageInfo[];  // Lightweight image info for display and restore
  timestamp: number;
}
