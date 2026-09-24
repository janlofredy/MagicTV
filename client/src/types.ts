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
  type?: 'movie' | 'episode';
  seriesId?: string | null;
  seriesName?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  libraryName?: string | null;
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
  type?: 'movie' | 'episode';
  seriesName?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
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

export interface TimeBlock {
  id?: string;
  name?: string;
  startHour: number; // 0 - 23 (e.g. 1 for 1 AM)
  endHour: number;   // 0 - 23 (e.g. 4 for 4 AM)
  type: 'movie' | 'series_marathon' | 'daily_rotation' | 'off_air';
  genres?: string[];
}

export interface ChannelRules {
  type?: 'movie' | 'episode' | 'all';
  genres?: string[];
  genresOperator?: 'AND' | 'OR';
  minYear?: number;
  maxYear?: number;
  minRating?: number;
  directors?: string[];
  studios?: string[];
  collections?: string[];
  seriesNames?: string[];
  libraries?: string[];
  sortBy?: 'random' | 'year_asc' | 'year_desc' | 'title' | 'rating' | 'episode_asc';
  limit?: number;
  timeBlocks?: TimeBlock[];
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  groupTitle: string;
  type?: 'movie' | 'series' | 'mixed';
  mode: 'continuous' | 'slotted';
  slotDuration: number;
  playMode?: 'shuffle' | 'sequential';
  shuffle: boolean;
  rules?: string | null;
  manualItemIds?: string | null;
  seriesIds?: string | null;
  enabled: boolean;
  currentProgram?: ProgramInfo | null;
  nextProgram?: {
    id: string;
    title: string;
    type?: 'movie' | 'episode';
    seriesName?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    startTime: string;
    endTime: string;
    duration: number;
    posterUrl?: string | null;
  } | null;
  streamUrl?: string;
  isOffAir?: boolean;
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
