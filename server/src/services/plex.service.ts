export interface PlexConnectionTestResult {
  success: boolean;
  serverName?: string;
  version?: string;
  error?: string;
}

export interface PlexLibrarySection {
  id: string;
  title: string;
  type: string;
}

export interface PlexMovieItem {
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
  posterPath?: string;
  backdropPath?: string;
  partKey?: string;
}

export class PlexService {
  private static getHeaders(token: string) {
    return {
      'X-Plex-Token': token,
      'X-Plex-Client-Identifier': 'MagicTV-App',
      'X-Plex-Product': 'MagicTV',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Platform': 'NodeJS',
      'Accept': 'application/json',
    };
  }

  private static normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  static async testConnection(baseUrl: string, token: string): Promise<PlexConnectionTestResult> {
    const url = `${this.normalizeUrl(baseUrl)}/identity`;
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
        serverName: data.MediaContainer?.machineIdentifier || 'Plex Media Server',
        version: data.MediaContainer?.version || 'Unknown',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  static async getMovieSections(baseUrl: string, token: string): Promise<PlexLibrarySection[]> {
    const url = `${this.normalizeUrl(baseUrl)}/library/sections`;
    const res = await fetch(url, {
      headers: this.getHeaders(token),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Plex sections: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const directories = data.MediaContainer?.Directory || [];
    
    return directories
      .filter((dir: any) => dir.type === 'movie')
      .map((dir: any) => ({
        id: String(dir.key),
        title: dir.title,
        type: dir.type,
      }));
  }

  static async getMoviesFromSection(
    baseUrl: string,
    token: string,
    sectionId: string,
    batchSize: number = 200,
    offset: number = 0
  ): Promise<{ movies: PlexMovieItem[]; totalSize: number }> {
    const cleanUrl = this.normalizeUrl(baseUrl);
    const url = `${cleanUrl}/library/sections/${sectionId}/all?X-Plex-Container-Start=${offset}&X-Plex-Container-Size=${batchSize}`;
    
    const res = await fetch(url, {
      headers: this.getHeaders(token),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch movies from section ${sectionId}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const container = data.MediaContainer || {};
    const totalSize = container.totalSize || container.size || 0;
    const metadata = container.Metadata || [];

    const movies: PlexMovieItem[] = metadata.map((item: any) => {
      const partKey = item.Media?.[0]?.Part?.[0]?.key;
      const durationSeconds = Math.round((item.duration || 0) / 1000);

      const genres = (item.Genre || []).map((g: any) => g.tag).filter(Boolean);
      const directors = (item.Director || []).map((d: any) => d.tag).filter(Boolean);
      const studios = item.studio ? [item.studio] : [];
      const collections = (item.Collection || []).map((c: any) => c.tag).filter(Boolean);

      return {
        serverItemId: String(item.ratingKey),
        title: item.title,
        originalTitle: item.originalTitle,
        year: item.year ? parseInt(item.year, 10) : undefined,
        overview: item.summary,
        tagline: item.tagline,
        duration: durationSeconds > 0 ? durationSeconds : 5400, // fallback 90 mins if missing
        rating: item.rating ? parseFloat(item.rating) : undefined,
        contentRating: item.contentRating,
        genres,
        directors,
        studios,
        collections,
        posterPath: item.thumb,
        backdropPath: item.art,
        partKey,
      };
    });

    return { movies, totalSize };
  }

  static getDirectStreamUrl(
    baseUrl: string,
    token: string,
    serverItemId: string,
    partKey?: string,
    offsetSeconds: number = 0,
    preferHls: boolean = true
  ): string {
    const cleanUrl = this.normalizeUrl(baseUrl);
    
    if (preferHls) {
      // Plex Universal Transcode / Direct Stream HLS endpoint
      // directPlay=1, directStream=1 ensures no re-encoding if codec matches
      return `${cleanUrl}/video/:/transcode/universal/start.m3u8?path=${encodeURIComponent(
        `/library/metadata/${serverItemId}`
      )}&mediaIndex=0&partIndex=0&protocol=hls&offset=${Math.max(0, Math.floor(offsetSeconds))}&fastSeek=1&directPlay=1&directStream=1&copyts=1&X-Plex-Token=${token}`;
    }

    // Direct part file stream
    if (partKey) {
      return `${cleanUrl}${partKey}?download=0&offset=${Math.max(0, Math.floor(offsetSeconds))}&X-Plex-Token=${token}`;
    }

    return `${cleanUrl}/library/metadata/${serverItemId}?X-Plex-Token=${token}`;
  }

  static getArtworkUrl(baseUrl: string, token: string, path?: string | null): string | null {
    if (!path) return null;
    const cleanUrl = this.normalizeUrl(baseUrl);
    return `${cleanUrl}${path}?X-Plex-Token=${token}`;
  }
}
