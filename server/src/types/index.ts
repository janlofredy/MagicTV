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
}

export interface MediaServerConfig {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  token: string;
  userId?: string | null;
}
