export interface JellyfinConnectionTestResult {
  success: boolean;
  serverName?: string;
  version?: string;
  error?: string;
}

export interface JellyfinLibrarySection {
  id: string;
  title: string;
  type: string;
}

export interface JellyfinMovieItem {
  serverItemId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  overview?: string;
  tagline?: string;
  duration: number; // in seconds
  rating?: number;
  contentRating?: string;
  genres: string[];
  directors: string[];
  studios: string[];
  collections: string[];
  posterTag?: string;
  backdropTag?: string;
}

export interface JellyfinEpisodeItem {
  serverItemId: string;
  seriesId: string;
  seriesName: string;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  overview?: string;
  year?: number;
  duration: number; // in seconds
  rating?: number;
  contentRating?: string;
  genres: string[];
  directors: string[];
  studios: string[];
  posterTag?: string;
  backdropTag?: string;
}

export class JellyfinService {
  private static getHeaders(token: string) {
    return {
      'X-Emby-Token': token,
      'X-Emby-Authorization': `MediaBrowser Client="MagicTV", Device="Server", DeviceId="MagicTV-App", Version="1.0.0", Token="${token}"`,
      'Accept': 'application/json',
    };
  }

  private static normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  static async testConnection(baseUrl: string, token: string): Promise<JellyfinConnectionTestResult> {
    const url = `${this.normalizeUrl(baseUrl)}/System/Info`;
    try {
      const res = await fetch(url, {
        headers: this.getHeaders(token),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const data = (await res.json()) as any;
      return {
        success: true,
        serverName: data.ServerName || 'Jellyfin Server',
        version: data.Version || 'Unknown',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  static async getSections(baseUrl: string, token: string, userId?: string | null): Promise<JellyfinLibrarySection[]> {
    const cleanUrl = this.normalizeUrl(baseUrl);
    const url = userId
      ? `${cleanUrl}/Users/${userId}/Views`
      : `${cleanUrl}/Library/MediaFolders`;

    const res = await fetch(url, {
      headers: this.getHeaders(token),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Jellyfin libraries: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const items = data.Items || [];

    return items
      .filter((folder: any) => 
        folder.CollectionType === 'movies' || 
        folder.CollectionType === 'tvshows' || 
        folder.Type === 'CollectionFolder'
      )
      .map((folder: any) => ({
        id: String(folder.Id),
        title: folder.Name,
        type: folder.CollectionType === 'tvshows' ? 'tvshows' : 'movies',
      }));
  }

  // Alias for backward compatibility
  static async getMovieSections(baseUrl: string, token: string, userId?: string | null): Promise<JellyfinLibrarySection[]> {
    return this.getSections(baseUrl, token, userId);
  }

  static async getMoviesFromSection(
    baseUrl: string,
    token: string,
    sectionId: string,
    userId?: string | null,
    limit: number = 200,
    startIndex: number = 0
  ): Promise<{ movies: JellyfinMovieItem[]; totalSize: number }> {
    const cleanUrl = this.normalizeUrl(baseUrl);
    const userPath = userId ? `/Users/${userId}` : '';
    const url = `${cleanUrl}${userPath}/Items?ParentId=${sectionId}&IncludeItemTypes=Movie&Recursive=true&Fields=Overview,Genres,Studios,OfficialRating,CommunityRating,PremiereDate,RunTimeTicks,People,Taglines,OriginalTitle&StartIndex=${startIndex}&Limit=${limit}`;

    const res = await fetch(url, {
      headers: this.getHeaders(token),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch movies from Jellyfin: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const totalSize = data.TotalRecordCount || (data.Items || []).length;
    const items = data.Items || [];

    const movies: JellyfinMovieItem[] = items.map((item: any) => {
      const durationSeconds = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10000000) : 5400;
      
      const directors = (item.People || [])
        .filter((p: any) => p.Type === 'Director')
        .map((p: any) => p.Name)
        .filter(Boolean);

      const studios = (item.Studios || []).map((s: any) => s.Name).filter(Boolean);
      const genres = item.Genres || [];
      const collections: string[] = [];

      return {
        serverItemId: String(item.Id),
        title: item.Name,
        originalTitle: item.OriginalTitle,
        year: item.ProductionYear,
        overview: item.Overview,
        tagline: item.Taglines?.[0],
        duration: durationSeconds > 0 ? durationSeconds : 5400,
        rating: item.CommunityRating ? parseFloat(item.CommunityRating) : undefined,
        contentRating: item.OfficialRating,
        genres,
        directors,
        studios,
        collections,
        posterTag: item.ImageTags?.Primary,
        backdropTag: item.BackdropImageTags?.[0],
      };
    });

    return { movies, totalSize };
  }

  static async getEpisodesFromSection(
    baseUrl: string,
    token: string,
    sectionId: string,
    userId?: string | null,
    limit: number = 200,
    startIndex: number = 0
  ): Promise<{ episodes: JellyfinEpisodeItem[]; totalSize: number }> {
    const cleanUrl = this.normalizeUrl(baseUrl);
    const userPath = userId ? `/Users/${userId}` : '';
    const url = `${cleanUrl}${userPath}/Items?ParentId=${sectionId}&IncludeItemTypes=Episode&Recursive=true&Fields=Overview,Genres,Studios,OfficialRating,CommunityRating,PremiereDate,RunTimeTicks,People,Taglines,OriginalTitle,SeriesName,SeasonName,IndexNumber,ParentIndexNumber,SeriesId&StartIndex=${startIndex}&Limit=${limit}`;

    const res = await fetch(url, {
      headers: this.getHeaders(token),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch episodes from Jellyfin: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const totalSize = data.TotalRecordCount || (data.Items || []).length;
    const items = data.Items || [];

    const episodes: JellyfinEpisodeItem[] = items.map((item: any) => {
      const durationSeconds = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10000000) : 2400; // default 40m for episode
      
      const directors = (item.People || [])
        .filter((p: any) => p.Type === 'Director')
        .map((p: any) => p.Name)
        .filter(Boolean);

      const studios = (item.Studios || []).map((s: any) => s.Name).filter(Boolean);
      const genres = item.Genres || [];

      return {
        serverItemId: String(item.Id),
        seriesId: String(item.SeriesId || ''),
        seriesName: item.SeriesName || 'Unknown Show',
        seasonNumber: item.ParentIndexNumber != null ? item.ParentIndexNumber : 1,
        episodeNumber: item.IndexNumber != null ? item.IndexNumber : 1,
        title: item.Name || `Episode ${item.IndexNumber || 1}`,
        overview: item.Overview,
        year: item.ProductionYear,
        duration: durationSeconds > 0 ? durationSeconds : 2400,
        rating: item.CommunityRating ? parseFloat(item.CommunityRating) : undefined,
        contentRating: item.OfficialRating,
        genres,
        directors,
        studios,
        posterTag: item.ImageTags?.Primary,
        backdropTag: item.BackdropImageTags?.[0],
      };
    });

    return { episodes, totalSize };
  }

  static getDirectStreamUrl(
    baseUrl: string,
    token: string,
    itemId: string,
    offsetSeconds: number = 0,
    preferHls: boolean = true,
    maxBitrate?: number
  ): string {
    const cleanUrl = this.normalizeUrl(baseUrl);
    const ticks = Math.max(0, Math.floor(offsetSeconds * 10000000));
    const bitrateParam = maxBitrate ? `&MaxStreamingBitrate=${maxBitrate}` : '';

    if (preferHls) {
      // Jellyfin requires MediaSourceId parameter, otherwise returns 400 Bad Request
      return `${cleanUrl}/Videos/${itemId}/master.m3u8?MediaSourceId=${itemId}&StartTimeTicks=${ticks}&api_key=${token}&PlaySessionId=MagicTV-${Date.now()}${bitrateParam}`;
    }

    if (maxBitrate) {
      // Transcode stream for lower bitrate/quality (MP4 stream)
      return `${cleanUrl}/Videos/${itemId}/stream.mp4?MediaSourceId=${itemId}&VideoCodec=h264&AudioCodec=aac${bitrateParam}&StartTimeTicks=${ticks}&api_key=${token}`;
    }

    return `${cleanUrl}/Videos/${itemId}/stream?static=true&StartTimeTicks=${ticks}&api_key=${token}`;
  }

  static getArtworkUrl(baseUrl: string, token: string, itemId: string, type: 'Primary' | 'Backdrop' = 'Primary'): string {
    const cleanUrl = this.normalizeUrl(baseUrl);
    return `${cleanUrl}/Items/${itemId}/Images/${type}?api_key=${token}`;
  }
}
