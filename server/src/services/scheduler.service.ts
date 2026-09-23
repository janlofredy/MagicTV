import { prisma } from '../db.js';
import { Channel, MediaItem, ProgramSchedule } from '@prisma/client';
import { ChannelRules, PlayoutState } from '../types/index.js';
import { PlexService } from './plex.service.js';
import { JellyfinService } from './jellyfin.service.js';

export class SchedulerService {
  /**
   * Evaluates rules or manual playlists for a channel to get eligible media items
   */
  static async getEligibleMediaItems(channel: Channel): Promise<MediaItem[]> {
    if (channel.manualItemIds) {
      try {
        const ids: string[] = JSON.parse(channel.manualItemIds);
        if (Array.isArray(ids) && ids.length > 0) {
          const items = await prisma.mediaItem.findMany({
            where: { id: { in: ids } },
            include: { server: true },
          });
          // Preserve manual order
          const idMap = new Map(items.map(item => [item.id, item]));
          const sorted = ids.map(id => idMap.get(id)).filter(Boolean) as MediaItem[];
          if (sorted.length > 0) return sorted;
        }
      } catch (err) {
        console.warn(`Error parsing manualItemIds for channel ${channel.id}:`, err);
      }
    }

    let allItems = await prisma.mediaItem.findMany({
      include: { server: true },
    });

    if (allItems.length === 0) {
      return [];
    }

    // Filter by channel type (movie vs series)
    if (channel.type === 'series') {
      allItems = allItems.filter(item => item.type === 'episode');
    } else if (channel.type === 'movie') {
      allItems = allItems.filter(item => item.type === 'movie');
    }

    // Filter by dedicated seriesIds if present on channel
    if (channel.seriesIds) {
      try {
        const allowedSeries = JSON.parse(channel.seriesIds);
        if (Array.isArray(allowedSeries) && allowedSeries.length > 0) {
          allItems = allItems.filter(item =>
            (item.seriesId && allowedSeries.includes(item.seriesId)) ||
            (item.seriesName && allowedSeries.some(s => s.toLowerCase() === item.seriesName?.toLowerCase()))
          );
        }
      } catch {}
    }

    if (!channel.rules) {
      if (channel.playMode === 'sequential') {
        return allItems.sort((a, b) =>
          (a.seasonNumber || 1) - (b.seasonNumber || 1) ||
          (a.episodeNumber || 1) - (b.episodeNumber || 1)
        );
      }
      return channel.shuffle ? this.shuffleArray([...allItems]) : allItems;
    }

    let rules: ChannelRules = {};
    try {
      rules = JSON.parse(channel.rules);
    } catch {
      return allItems;
    }

    let filtered = allItems.filter(item => {
      // Rule media type filter
      if (rules.type && rules.type !== 'all') {
        if (rules.type === 'movie' && item.type !== 'movie') return false;
        if (rules.type === 'episode' && item.type !== 'episode') return false;
      }

      // Series names filter
      if (rules.seriesNames && rules.seriesNames.length > 0) {
        if (!item.seriesName) return false;
        const matchesSeries = rules.seriesNames.some(s =>
          item.seriesName?.toLowerCase() === s.toLowerCase()
        );
        if (!matchesSeries) return false;
      }

      // Libraries filter
      if (rules.libraries && rules.libraries.length > 0) {
        if (!item.libraryName) return false;
        const matchesLib = rules.libraries.some(lib =>
          item.libraryName?.toLowerCase() === lib.toLowerCase()
        );
        if (!matchesLib) return false;
      }

      // 1. Genre filter
      if (rules.genres && rules.genres.length > 0) {
        let itemGenres: string[] = [];
        try {
          itemGenres = JSON.parse(item.genres || '[]');
        } catch {
          itemGenres = [];
        }
        
        const operator = rules.genresOperator || 'OR';
        if (operator === 'OR') {
          const hasMatch = rules.genres.some(g =>
            itemGenres.some(ig => ig.toLowerCase() === g.toLowerCase())
          );
          if (!hasMatch) return false;
        } else {
          const hasAll = rules.genres.every(g =>
            itemGenres.some(ig => ig.toLowerCase() === g.toLowerCase())
          );
          if (!hasAll) return false;
        }
      }

      // 2. Year filter
      if (rules.minYear && item.year && item.year < rules.minYear) return false;
      if (rules.maxYear && item.year && item.year > rules.maxYear) return false;

      // 3. Rating filter
      if (rules.minRating && item.rating && item.rating < rules.minRating) return false;

      // 4. Directors filter
      if (rules.directors && rules.directors.length > 0) {
        let itemDirectors: string[] = [];
        try {
          itemDirectors = JSON.parse(item.directors || '[]');
        } catch {
          itemDirectors = [];
        }
        const hasDirector = rules.directors.some(d =>
          itemDirectors.some(id => id.toLowerCase().includes(d.toLowerCase()))
        );
        if (!hasDirector) return false;
      }

      // 5. Studios filter
      if (rules.studios && rules.studios.length > 0) {
        let itemStudios: string[] = [];
        try {
          itemStudios = JSON.parse(item.studios || '[]');
        } catch {
          itemStudios = [];
        }
        const hasStudio = rules.studios.some(s =>
          itemStudios.some(is => is.toLowerCase().includes(s.toLowerCase()))
        );
        if (!hasStudio) return false;
      }

      // 6. Collections filter
      if (rules.collections && rules.collections.length > 0) {
        let itemCollections: string[] = [];
        try {
          itemCollections = JSON.parse(item.collections || '[]');
        } catch {
          itemCollections = [];
        }
        const hasColl = rules.collections.some(c =>
          itemCollections.some(ic => ic.toLowerCase().includes(c.toLowerCase()))
        );
        if (!hasColl) return false;
      }

      return true;
    });

    // If filtering eliminated all items, fallback to allItems so channel never goes black
    if (filtered.length === 0) {
      filtered = allItems;
    }

    // Sort or Shuffle
    if (channel.playMode === 'sequential' || rules.sortBy === 'episode_asc') {
      filtered.sort((a, b) => {
        // First group by seriesName if applicable
        if (a.seriesName && b.seriesName && a.seriesName !== b.seriesName) {
          return a.seriesName.localeCompare(b.seriesName);
        }
        return (
          (a.seasonNumber || 1) - (b.seasonNumber || 1) ||
          (a.episodeNumber || 1) - (b.episodeNumber || 1)
        );
      });
    } else if (rules.sortBy === 'year_asc') {
      filtered.sort((a, b) => (a.year || 0) - (b.year || 0));
    } else if (rules.sortBy === 'year_desc') {
      filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (rules.sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (rules.sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (channel.playMode === 'shuffle' || channel.shuffle || rules.sortBy === 'random') {
      filtered = this.shuffleArray(filtered);
    }

    if (rules.limit && rules.limit > 0) {
      filtered = filtered.slice(0, rules.limit);
    }

    return filtered;
  }

  /**
   * Generates or extends programming timeline for a channel
   */
  static async ensureSchedule(channelId: string, hoursAhead: number = 48): Promise<number> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || !channel.enabled) return 0;

    const items = await this.getEligibleMediaItems(channel);
    if (items.length === 0) return 0;

    const now = new Date();
    const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    // Find the latest scheduled program
    const latest = await prisma.programSchedule.findFirst({
      where: { channelId },
      orderBy: { endTime: 'desc' },
    });

    let currentStartTime = latest && latest.endTime > now ? new Date(latest.endTime) : new Date(now);
    
    // For slotted mode, snap start time to nearest slot boundary
    if (channel.mode === 'slotted') {
      const slotMs = (channel.slotDuration || 120) * 60 * 1000;
      if (!latest || latest.endTime <= now) {
        const slotsElapsed = Math.floor(now.getTime() / slotMs);
        currentStartTime = new Date(slotsElapsed * slotMs);
      }
    }

    let addedCount = 0;
    let orderIndex = (latest?.orderIndex || 0) + 1;
    let itemIndex = 0;

    const schedulesToCreate: Array<{
      channelId: string;
      mediaItemId: string;
      title: string;
      startTime: Date;
      endTime: Date;
      duration: number;
      orderIndex: number;
    }> = [];

    while (currentStartTime < horizon) {
      const item = items[itemIndex % items.length];
      itemIndex++;

      let duration = item.duration; // in seconds
      let endTime: Date;

      if (channel.mode === 'slotted') {
        const slotSeconds = (channel.slotDuration || 120) * 60;
        endTime = new Date(currentStartTime.getTime() + slotSeconds * 1000);
      } else {
        endTime = new Date(currentStartTime.getTime() + duration * 1000);
      }

      const formattedTitle = item.type === 'episode' && item.seriesName
        ? `${item.seriesName} - S${String(item.seasonNumber || 1).padStart(2, '0')}E${String(item.episodeNumber || 1).padStart(2, '0')}: ${item.title}`
        : item.title;

      schedulesToCreate.push({
        channelId: channel.id,
        mediaItemId: item.id,
        title: formattedTitle,
        startTime: new Date(currentStartTime),
        endTime,
        duration,
        orderIndex: orderIndex++,
      });

      currentStartTime = new Date(endTime);
      addedCount++;
    }

    if (schedulesToCreate.length > 0) {
      await prisma.programSchedule.createMany({
        data: schedulesToCreate,
      });
    }

    // Clean up old past schedules older than 12 hours
    const purgeTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    await prisma.programSchedule.deleteMany({
      where: {
        channelId,
        endTime: { lt: purgeTime },
      },
    });

    return addedCount;
  }

  /**
   * Calculates the exact playout state and offset for a channel right now
   */
  static async getCurrentPlayoutState(channelId: string, timestamp: Date = new Date()): Promise<PlayoutState> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Ensure we have active schedules only if none exist in the future
    const upcomingCount = await prisma.programSchedule.count({
      where: {
        channelId,
        endTime: { gt: timestamp },
      },
    });

    if (upcomingCount === 0) {
      await this.ensureSchedule(channelId, 24);
    }

    const currentSchedule = await prisma.programSchedule.findFirst({
      where: {
        channelId,
        startTime: { lte: timestamp },
        endTime: { gt: timestamp },
      },
      include: {
        mediaItem: {
          include: { server: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    const nextSchedule = await prisma.programSchedule.findFirst({
      where: {
        channelId,
        startTime: { gte: timestamp },
      },
      include: {
        mediaItem: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:8000';
    let streamUrl = `${baseUrl}/channels/${channel.number}/stream.m3u8`;

    if (!currentSchedule) {
      return {
        channelId: channel.id,
        channelNumber: channel.number,
        channelName: channel.name,
        currentProgram: null,
        nextProgram: null,
        streamUrl,
        isIntermission: true,
      };
    }

    const media = currentSchedule.mediaItem;
    const elapsedSeconds = Math.max(0, Math.floor((timestamp.getTime() - currentSchedule.startTime.getTime()) / 1000));
    const duration = currentSchedule.duration;
    const isOverrun = elapsedSeconds > duration;
    const remainingSeconds = isOverrun ? 0 : Math.max(0, duration - elapsedSeconds);
    const progressPercentage = Math.min(100, Math.round((elapsedSeconds / duration) * 100));

    let genres: string[] = [];
    try {
      genres = JSON.parse(media.genres || '[]');
    } catch {
      genres = [];
    }

    return {
      channelId: channel.id,
      channelNumber: channel.number,
      channelName: channel.name,
      currentProgram: {
        id: currentSchedule.id,
        mediaItemId: media.id,
        title: media.title,
        type: media.type,
        seriesName: media.seriesName,
        seasonNumber: media.seasonNumber,
        episodeNumber: media.episodeNumber,
        year: media.year,
        overview: media.overview,
        posterUrl: media.posterUrl,
        backdropUrl: media.backdropUrl,
        genres,
        rating: media.rating,
        contentRating: media.contentRating,
        startTime: currentSchedule.startTime.toISOString(),
        endTime: currentSchedule.endTime.toISOString(),
        duration,
        elapsedSeconds,
        remainingSeconds,
        progressPercentage,
      },
      nextProgram: nextSchedule
        ? {
            id: nextSchedule.id,
            title: nextSchedule.mediaItem.title,
            type: nextSchedule.mediaItem.type,
            seriesName: nextSchedule.mediaItem.seriesName,
            seasonNumber: nextSchedule.mediaItem.seasonNumber,
            episodeNumber: nextSchedule.mediaItem.episodeNumber,
            startTime: nextSchedule.startTime.toISOString(),
            endTime: nextSchedule.endTime.toISOString(),
            duration: nextSchedule.duration,
            posterUrl: nextSchedule.mediaItem.posterUrl,
          }
        : null,
      streamUrl,
      isIntermission: isOverrun,
    };
  }

  /**
   * Resolves the target direct play stream URL with calculated offset for HTTP 302 redirect
   */
  static async resolveStreamRedirectUrl(
    channelNumber: number,
    preferHls: boolean = true,
    timestamp: Date = new Date()
  ): Promise<string> {
    const channel = await prisma.channel.findUnique({
      where: { number: channelNumber },
    });

    if (!channel) {
      throw new Error(`Channel #${channelNumber} not found`);
    }

    const state = await this.getCurrentPlayoutState(channel.id, timestamp);

    if (!state.currentProgram) {
      // Return standby clip or intermission video
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    }

    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: state.currentProgram.mediaItemId },
      include: { server: true },
    });

    if (!mediaItem) {
      throw new Error(`MediaItem not found for program`);
    }

    const server = mediaItem.server;
    const offset = state.currentProgram.elapsedSeconds;

    // Check if rawMetadata has demo direct stream
    if (mediaItem.rawMetadata) {
      try {
        const raw = JSON.parse(mediaItem.rawMetadata);
        if (raw.streamUrl) {
          return raw.streamUrl;
        }
      } catch {}
    }

    if (server.type === 'plex') {
      let partKey: string | undefined;
      try {
        if (mediaItem.rawMetadata) {
          const raw = JSON.parse(mediaItem.rawMetadata);
          partKey = raw.partKey;
        }
      } catch {}

      return PlexService.getDirectStreamUrl(
        server.url,
        server.token,
        mediaItem.serverItemId,
        partKey,
        offset,
        preferHls
      );
    } else if (server.type === 'jellyfin') {
      return JellyfinService.getDirectStreamUrl(
        server.url,
        server.token,
        mediaItem.serverItemId,
        offset,
        preferHls
      );
    }

    // Fallback
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  }

  private static shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
