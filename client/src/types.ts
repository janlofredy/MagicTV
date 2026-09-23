export interface MediaServer {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin' | 'demo';
  url: string;
  token: string;
  userId?: string | null;
  lastSyncAt?: string | null;
  isActive: boolean;
  _count?: {
    mediaItems: number;
  };
}

export interface MediaItem {
  id: string;
  title: string;
  originalTitle?: string | null;
  year?: number | null;
  overview?: string | null;
  tagline?: string | null;
  duration: number; // seconds
  rating?: number | null;
  contentRating?: string | null;
  genres: string; // JSON string
  directors: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  server?: {
    name: string;
    type: string;
  };
}

export interface ProgramInfo {
  id: string;
  mediaItemId: string;
  title: string;
  year?: number | null;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres: string[];
  rating?: number | null;
  contentRating?: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  progressPercentage: number;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  groupTitle: string;
  mode: 'continuous' | 'slotted';
  slotDuration: number;
  shuffle: boolean;
  rules?: string | null;
  manualItemIds?: string | null;
  enabled: boolean;
  currentProgram?: ProgramInfo | null;
  nextProgram?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    duration: number;
    posterUrl?: string | null;
  } | null;
  streamUrl?: string;
}

export interface ScheduleProgram {
  id: string;
  channelId: string;
  mediaItemId: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  mediaItem: MediaItem;
}
