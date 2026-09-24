import { prisma } from '../db.js';
import { SchedulerService } from './scheduler.service.js';

export interface AutoChannelOptions {
  createSeriesChannels?: boolean;
  createLibraryChannels?: boolean;
  createGenreChannels?: boolean;
  createStudioChannels?: boolean;
  createMixedBlockChannels?: boolean;
}

export interface AutoChannelResult {
  createdCount: number;
  channelNames: string[];
}

export class AutoChannelService {
  /**
   * Automatically generate channels QuasiTV style based on media origin:
   * 1. Magic TV Flagship Channel (Movies prime/matinee, Series binges in daytime, Off-Air overnight)
   * 2. Dedicated channels per media Library (e.g. Movies, TV Shows)
   * 3. Dedicated channels for Studios / Networks
   * 4. Dedicated channels for popular Genres
   * 5. Dedicated 24/7 channels per TV Series (playing sequential S01E01 -> S01E02...)
   */
  static async generateChannels(options: AutoChannelOptions = {}): Promise<AutoChannelResult> {
    const {
      createSeriesChannels = true,
      createLibraryChannels = true,
      createGenreChannels = true,
      createStudioChannels = true,
      createMixedBlockChannels = true,
    } = options;

    const existingChannels = await prisma.channel.findMany({
      select: { id: true, number: true, name: true },
    });

    const existingNumbers = new Set(existingChannels.map(c => c.number));
    let nextNumber = existingChannels.length > 0
      ? Math.max(...existingChannels.map(c => c.number)) + 1
      : 1;

    const existingNames = new Set(existingChannels.map(c => c.name.toLowerCase().trim()));
    const createdNames: string[] = [];

    // Helper to get lowest available number, preferring 1
    const getAvailableChannelNumber = (preferred: number = 1): number => {
      if (!existingNumbers.has(preferred)) {
        existingNumbers.add(preferred);
        return preferred;
      }
      while (existingNumbers.has(nextNumber)) {
        nextNumber++;
      }
      const chosen = nextNumber++;
      existingNumbers.add(chosen);
      return chosen;
    };

    // 1. Flagship Magic TV Channel: Mixed Block (Movies, Series Marathon & Overnight Off-Air)
    if (createMixedBlockChannels) {
      const movieCount = await prisma.mediaItem.count({ where: { type: 'movie' } });
      const episodeCount = await prisma.mediaItem.count({ where: { type: 'episode' } });

      if (movieCount > 0 || episodeCount > 0) {
        const channelName = 'Magic TV';
        if (!existingNames.has(channelName.toLowerCase())) {
          const channelNumber = getAvailableChannelNumber(1);
          const newChannel = await prisma.channel.create({
            data: {
              number: channelNumber,
              name: channelName,
              description: 'The flagship Magic TV broadcast: Afternoon & Primetime Movies, TV Series Marathons during daytime, and Off-Air overnight (1 AM - 4 AM).',
              groupTitle: 'General Entertainment',
              type: 'mixed',
              playMode: 'sequential',
              mode: 'continuous',
              shuffle: false,
              rules: JSON.stringify({
                type: 'all',
                timeBlocks: [
                  {
                    name: 'Overnight Off-Air',
                    startHour: 1,
                    endHour: 4,
                    type: 'off_air',
                  },
                  {
                    name: 'Morning Series Marathon',
                    startHour: 4,
                    endHour: 12,
                    type: 'series_marathon',
                  },
                  {
                    name: 'Lunch Movie Matinee',
                    startHour: 12,
                    endHour: 14,
                    type: 'movie',
                  },
                  {
                    name: 'Afternoon Series Marathon',
                    startHour: 14,
                    endHour: 20,
                    type: 'series_marathon',
                  },
                  {
                    name: 'Primetime Feature Movies',
                    startHour: 20,
                    endHour: 1,
                    type: 'movie',
                  },
                ],
              }),
              enabled: true,
            },
          });

          existingNames.add(channelName.toLowerCase());
          createdNames.push(channelName);
          await SchedulerService.ensureSchedule(newChannel.id, 48);
        }
      }
    }

    // 2. Media Library channels (Movies / Shows libraries)
    if (createLibraryChannels) {
      const libraries = await prisma.mediaLibrary.findMany({
        where: { enabled: true },
      });

      for (const lib of libraries) {
        const channelName = `${lib.name} Channel`;
        if (existingNames.has(channelName.toLowerCase())) continue;

        // Check if there are items in this library
        const count = await prisma.mediaItem.count({
          where: { libraryName: lib.name },
        });

        if (count === 0) continue;

        const isSeries = lib.type === 'tvshows';
        const newChannel = await prisma.channel.create({
          data: {
            number: getAvailableChannelNumber(),
            name: channelName,
            description: `All content from ${lib.name} library (${count} items)`,
            groupTitle: 'Libraries',
            type: isSeries ? 'series' : 'movie',
            playMode: isSeries ? 'sequential' : 'shuffle',
            mode: 'continuous',
            shuffle: !isSeries,
            rules: JSON.stringify({
              libraries: [lib.name],
              sortBy: isSeries ? 'episode_asc' : 'random',
            }),
            enabled: true,
          },
        });

        existingNames.add(channelName.toLowerCase());
        createdNames.push(channelName);
        await SchedulerService.ensureSchedule(newChannel.id, 48);
      }
    }

    // 3. Studio / Network Channels (studios/networks with at least 3 items)
    if (createStudioChannels) {
      const items = await prisma.mediaItem.findMany({
        select: { studios: true },
      });

      const studioCounts = new Map<string, number>();
      for (const item of items) {
        try {
          const parsed = JSON.parse(item.studios || '[]');
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              const cleanS = s.trim();
              if (cleanS) {
                studioCounts.set(cleanS, (studioCounts.get(cleanS) || 0) + 1);
              }
            }
          }
        } catch {}
      }

      const sortedStudios = Array.from(studioCounts.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 studios max

      for (const [studio, count] of sortedStudios) {
        const channelName = `${studio} TV`;
        if (existingNames.has(channelName.toLowerCase())) continue;

        const newChannel = await prisma.channel.create({
          data: {
            number: getAvailableChannelNumber(),
            name: channelName,
            description: `Curated programming from ${studio} (${count} titles)`,
            groupTitle: 'Studios',
            type: 'mixed',
            playMode: 'shuffle',
            mode: 'continuous',
            shuffle: true,
            rules: JSON.stringify({
              studios: [studio],
              sortBy: 'random',
            }),
            enabled: true,
          },
        });

        existingNames.add(channelName.toLowerCase());
        createdNames.push(channelName);
        await SchedulerService.ensureSchedule(newChannel.id, 48);
      }
    }

    // 3. Genre Channels (genres with at least 3 items)
    if (createGenreChannels) {
      const items = await prisma.mediaItem.findMany({
        select: { genres: true },
      });

      const genreCounts = new Map<string, number>();
      for (const item of items) {
        try {
          const parsed = JSON.parse(item.genres || '[]');
          if (Array.isArray(parsed)) {
            for (const g of parsed) {
              const cleanG = g.trim();
              if (cleanG) {
                genreCounts.set(cleanG, (genreCounts.get(cleanG) || 0) + 1);
              }
            }
          }
        } catch {}
      }

      // Sort genres by count descending
      const sortedGenres = Array.from(genreCounts.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);

      for (const [genre, count] of sortedGenres) {
        const channelName = `${genre} 24/7`;
        if (existingNames.has(channelName.toLowerCase())) continue;

        const newChannel = await prisma.channel.create({
          data: {
            number: getAvailableChannelNumber(),
            name: channelName,
            description: `Non-stop ${genre} movies and entertainment (${count} titles)`,
            groupTitle: 'Genres',
            type: 'mixed',
            playMode: 'shuffle',
            mode: 'continuous',
            shuffle: true,
            rules: JSON.stringify({
              genres: [genre],
              genresOperator: 'OR',
              sortBy: 'random',
            }),
            enabled: true,
          },
        });

        existingNames.add(channelName.toLowerCase());
        createdNames.push(channelName);
        await SchedulerService.ensureSchedule(newChannel.id, 48);
      }
    }

    // 4. TV Series Dedicated Channels (Sequential playout per show)
    if (createSeriesChannels) {
      // Find all distinct series in database
      const episodes = await prisma.mediaItem.findMany({
        where: {
          type: 'episode',
          seriesName: { not: null },
        },
        select: {
          seriesId: true,
          seriesName: true,
          posterUrl: true,
          backdropUrl: true,
          overview: true,
        },
      });

      const seriesMap = new Map<string, { seriesId: string; name: string; poster?: string; backdrop?: string; count: number }>();
      for (const ep of episodes) {
        if (!ep.seriesName) continue;
        const key = ep.seriesName.trim();
        const existing = seriesMap.get(key);
        if (existing) {
          existing.count++;
          if (!existing.poster && ep.posterUrl) existing.poster = ep.posterUrl;
          if (!existing.backdrop && ep.backdropUrl) existing.backdrop = ep.backdropUrl;
        } else {
          seriesMap.set(key, {
            seriesId: ep.seriesId || key,
            name: key,
            poster: ep.posterUrl || undefined,
            backdrop: ep.backdropUrl || undefined,
            count: 1,
          });
        }
      }

      for (const [name, info] of seriesMap) {
        const channelName = name;
        if (existingNames.has(channelName.toLowerCase())) continue;

        const newChannel = await prisma.channel.create({
          data: {
            number: getAvailableChannelNumber(),
            name: channelName,
            description: `24/7 dedicated broadcast of ${name} (${info.count} episodes)`,
            logoUrl: info.poster || null,
            groupTitle: 'TV Series',
            type: 'series',
            playMode: 'sequential',
            mode: 'continuous',
            shuffle: false,
            rules: JSON.stringify({
              type: 'episode',
              seriesNames: [name],
              sortBy: 'episode_asc',
            }),
            seriesIds: JSON.stringify([info.seriesId]),
            enabled: true,
          },
        });

        existingNames.add(channelName.toLowerCase());
        createdNames.push(channelName);
        // Pre-generate initial schedule
        await SchedulerService.ensureSchedule(newChannel.id, 48);
      }
    }



    return {
      createdCount: createdNames.length,
      channelNames: createdNames,
    };
  }
}
