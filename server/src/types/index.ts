export interface TimeBlock {
  id?: string;
  name?: string;
  startHour: number; // 0 - 23 (e.g. 1 for 1 AM)
  endHour: number;   // 0 - 23 (e.g. 4 for 4 AM)
  type: 'movie' | 'series_marathon' | 'off_air';
  genres?: string[];
}

export interface ChannelRules {
  type?: 'movie' | 'episode' | 'all';
  genres?: string[];         // e.g. ["Action", "Sci-Fi"]
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

export interface PlayoutState {
  channelId: string;
  channelNumber: number;
  channelName: string;
  currentProgram: {
    id: string;
    mediaItemId: string;
    title: string;
    type?: string;
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
    duration: number; // in seconds
    elapsedSeconds: number;
    remainingSeconds: number;
    progressPercentage: number;
  } | null;
  nextProgram: {
    id: string;
    title: string;
    type?: string;
    seriesName?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    startTime: string;
    endTime: string;
    duration: number;
    posterUrl?: string | null;
  } | null;
  streamUrl: string;
  isIntermission?: boolean;
  isOffAir?: boolean;
  offAirMessage?: string;
}

export interface MediaServerConfig {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  token: string;
  userId?: string | null;
}
