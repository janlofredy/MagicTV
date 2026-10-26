import { describe, it, expect } from 'vitest';
import { IptvService } from '../services/iptv.service.js';

describe('MagicTV Playout & IPTV Test Suite', () => {
  describe('IPTV M3U Generation', () => {
    it('should format valid M3U headers and EXTINF tags', () => {
      const mockChannel = {
        number: 1,
        name: 'Action Movies',
        groupTitle: 'Movies',
        logoUrl: 'http://localhost:8000/logo.png',
      };

      const tvgId = `magictv.${mockChannel.number}`;
      const line = `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${mockChannel.name}" tvg-chno="${mockChannel.number}" tvg-logo="${mockChannel.logoUrl}" group-title="${mockChannel.groupTitle}",${mockChannel.name}`;

      expect(line).toContain('#EXTINF:-1');
      expect(line).toContain('tvg-id="magictv.1"');
      expect(line).toContain('tvg-chno="1"');
      expect(line).toContain('group-title="Movies"');
      expect(line).toContain(',Action Movies');
    });
  });

  describe('Timeline Offset Calculations', () => {
    it('should calculate correct elapsed seconds and percentage within program bounds', () => {
      const start = new Date('2026-09-23T12:00:00Z');
      const now = new Date('2026-09-23T12:30:00Z'); // 30 minutes in
      const durationSeconds = 7200; // 2 hours (120 mins)

      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
      const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
      const progressPercentage = Math.round((elapsedSeconds / durationSeconds) * 100);

      expect(elapsedSeconds).toBe(1800); // 30 mins * 60
      expect(remainingSeconds).toBe(5400); // 90 mins * 60
      expect(progressPercentage).toBe(25); // 25% of 2 hours
    });

    it('should prevent negative remaining seconds if program overruns', () => {
      const start = new Date('2026-09-23T12:00:00Z');
      const now = new Date('2026-09-23T14:15:00Z'); // 2 hours 15 mins
      const durationSeconds = 7200; // 2 hours

      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
      const isOverrun = elapsedSeconds > durationSeconds;
      const remainingSeconds = isOverrun ? 0 : Math.max(0, durationSeconds - elapsedSeconds);

      expect(isOverrun).toBe(true);
      expect(remainingSeconds).toBe(0);
    });
  });

  describe('Smart Rule Filtering Logic', () => {
    const mockCatalog = [
      {
        id: '1',
        title: 'Die Hard',
        year: 1988,
        rating: 8.2,
        genres: JSON.stringify(['Action', 'Thriller']),
        directors: JSON.stringify(['John McTiernan']),
      },
      {
        id: '2',
        title: 'Blade Runner',
        year: 1982,
        rating: 8.1,
        genres: JSON.stringify(['Sci-Fi', 'Mystery']),
        directors: JSON.stringify(['Ridley Scott']),
      },
      {
        id: '3',
        title: 'Inception',
        year: 2010,
        rating: 8.8,
        genres: JSON.stringify(['Action', 'Sci-Fi']),
        directors: JSON.stringify(['Christopher Nolan']),
      },
      {
        id: '4',
        title: 'The Room',
        year: 2003,
        rating: 3.7,
        genres: JSON.stringify(['Drama']),
        directors: JSON.stringify(['Tommy Wiseau']),
      },
    ];

    it('should filter correctly by genre', () => {
      const targetGenre = 'Sci-Fi';
      const matched = mockCatalog.filter(item => {
        const genres = JSON.parse(item.genres);
        return genres.includes(targetGenre);
      });

      expect(matched.map(m => m.title)).toEqual(['Blade Runner', 'Inception']);
    });

    it('should filter correctly by year range (80s movies)', () => {
      const matched = mockCatalog.filter(item => item.year >= 1980 && item.year <= 1989);
      expect(matched.map(m => m.title)).toEqual(['Die Hard', 'Blade Runner']);
    });

    it('should filter correctly by minimum rating', () => {
      const matched = mockCatalog.filter(item => item.rating >= 8.5);
      expect(matched.map(m => m.title)).toEqual(['Inception']);
    });
  });

  describe('TV Series & Episode Sequential Playout Logic', () => {
    const mockEpisodes = [
      { id: '3', title: 'The Rogue Prince', seriesName: 'House of the Dragon', seasonNumber: 1, episodeNumber: 2 },
      { id: '1', title: 'The Heirs of the Dragon', seriesName: 'House of the Dragon', seasonNumber: 1, episodeNumber: 1 },
      { id: '4', title: 'A Son for a Son', seriesName: 'House of the Dragon', seasonNumber: 2, episodeNumber: 1 },
      { id: '2', title: 'Second of His Name', seriesName: 'House of the Dragon', seasonNumber: 1, episodeNumber: 3 },
    ];

    it('should sort episodes sequentially by season number then episode number', () => {
      const sorted = [...mockEpisodes].sort((a, b) =>
        (a.seasonNumber || 1) - (b.seasonNumber || 1) ||
        (a.episodeNumber || 1) - (b.episodeNumber || 1)
      );

      expect(sorted.map(e => `S${e.seasonNumber}E${e.episodeNumber}`)).toEqual([
        'S1E1',
        'S1E2',
        'S1E3',
        'S2E1',
      ]);
      expect(sorted[0].title).toBe('The Heirs of the Dragon');
    });

    it('should format episode program title with series name and SxxExx correctly', () => {
      const ep = mockEpisodes[1];
      const s = String(ep.seasonNumber).padStart(2, '0');
      const e = String(ep.episodeNumber).padStart(2, '0');
      const formatted = `${ep.seriesName} - S${s}E${e}: ${ep.title}`;

      expect(formatted).toBe('House of the Dragon - S01E01: The Heirs of the Dragon');
    });
  });

  describe('Jellyfin HLS Stream URL Generation', () => {
    it('should include MediaSourceId and StartTimeTicks in HLS URL', () => {
      const baseUrl = 'http://192.168.1.5:8097';
      const token = 'test-token';
      const itemId = 'item-12345';
      const offsetSeconds = 90; // 90 seconds = 900,000,000 ticks

      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const ticks = Math.max(0, Math.floor(offsetSeconds * 10000000));
      const hlsUrl = `${cleanUrl}/Videos/${itemId}/master.m3u8?MediaSourceId=${itemId}&StartTimeTicks=${ticks}&api_key=${token}&PlaySessionId=MagicTV-Test`;

      expect(hlsUrl).toContain('MediaSourceId=item-12345');
      expect(hlsUrl).toContain('StartTimeTicks=900000000');
      expect(hlsUrl).toContain('api_key=test-token');
    });
  });

  describe('Separated Watching Methods (In-App HLS vs IPTV Direct Stream)', () => {
    it('should generate dedicated IPTV stream URLs in M3U', () => {
      const baseUrl = 'http://localhost:8000';
      const chNumber = 1;
      const iptvUrl = `${baseUrl}/iptv/channels/${chNumber}/stream`;
      expect(iptvUrl).toBe('http://localhost:8000/iptv/channels/1/stream');
    });

    it('should generate proper HLS stream for In-App playback on Plex', async () => {
      const { PlexService } = await import('../services/plex.service.js');
      const hlsUrl = PlexService.getDirectStreamUrl(
        'http://plex:32400',
        'token123',
        'item1',
        '/library/parts/999/0/file.mp4',
        120,
        true
      );
      expect(hlsUrl).toContain('/video/:/transcode/universal/start.m3u8');
      expect(hlsUrl).toContain('offset=120');
      expect(hlsUrl).toContain('X-Plex-Token=token123');
    });

    it('should generate proper HLS stream for In-App playback on Jellyfin', async () => {
      const { JellyfinService } = await import('../services/jellyfin.service.js');
      const hlsUrl = JellyfinService.getDirectStreamUrl(
        'http://jellyfin:8096',
        'token456',
        'item2',
        60,
        true
      );
      expect(hlsUrl).toContain('/Videos/item2/master.m3u8');
      expect(hlsUrl).toContain('StartTimeTicks=600000000');
      expect(hlsUrl).toContain('api_key=token456');
    });

    it('should generate direct stream for IPTV playback on Jellyfin', async () => {
      const { JellyfinService } = await import('../services/jellyfin.service.js');
      const streamUrl = JellyfinService.getDirectStreamUrl(
        'http://jellyfin:8096',
        'token456',
        'item2',
        60,
        false
      );
      expect(streamUrl).toContain('/Videos/item2/stream.mp4');
      expect(streamUrl).toContain('StartTimeTicks=600000000');
    });
  });

  describe('Consecutive Repeat Prevention', () => {
    it('should never schedule the same movie back-to-back across multiple scheduling runs', async () => {
      const { prisma } = await import('../db.js');
      const { SchedulerService } = await import('../services/scheduler.service.js');

      // Create a test server and 3 mock movies
      const testServer = await prisma.mediaServer.create({
        data: {
          name: 'Test Movie Server',
          type: 'plex',
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      });

      const m1 = await prisma.mediaItem.create({
        data: {
          serverId: testServer.id,
          serverItemId: 'test-m1',
          title: 'Movie Alpha',
          type: 'movie',
          duration: 3600,
        },
      });

      const m2 = await prisma.mediaItem.create({
        data: {
          serverId: testServer.id,
          serverItemId: 'test-m2',
          title: 'Movie Beta',
          type: 'movie',
          duration: 3600,
        },
      });

      const m3 = await prisma.mediaItem.create({
        data: {
          serverId: testServer.id,
          serverItemId: 'test-m3',
          title: 'Movie Gamma',
          type: 'movie',
          duration: 3600,
        },
      });

      // Create a test channel with manual playlist
      const testChannel = await prisma.channel.create({
        data: {
          number: 9999,
          name: 'Repeat Prevention Test Channel',
          type: 'movie',
          mode: 'continuous',
          manualItemIds: JSON.stringify([m1.id, m2.id, m3.id]),
        },
      });

      try {
        // Run initial schedule for 6 hours (adds ~6 movies)
        await SchedulerService.ensureSchedule(testChannel.id, 6);

        // Run second schedule simulating the 15-minute roll-forward
        await SchedulerService.ensureSchedule(testChannel.id, 12);

        // Fetch all scheduled programs in chronological order
        const schedules = await prisma.programSchedule.findMany({
          where: { channelId: testChannel.id },
          orderBy: { startTime: 'asc' },
        });

        expect(schedules.length).toBeGreaterThan(2);

        // Verify that NO two consecutive programs have the same mediaItemId
        for (let i = 0; i < schedules.length - 1; i++) {
          const current = schedules[i];
          const next = schedules[i + 1];
          // If neither or only one is an intermission, mediaItemId should not repeat
          if (!current.isIntermission && !next.isIntermission) {
            expect(current.mediaItemId).not.toBe(next.mediaItemId);
          }
        }
      } finally {
        // Clean up test channel, schedules, and media items
        await prisma.programSchedule.deleteMany({ where: { channelId: testChannel.id } });
        await prisma.channel.delete({ where: { id: testChannel.id } });
        await prisma.mediaItem.deleteMany({ where: { serverId: testServer.id } });
        await prisma.mediaServer.delete({ where: { id: testServer.id } });
      }
    });
  });

  describe('Movie Bathroom Breaks & Intermissions', () => {
    it('should split movies longer than 75 minutes into Part 1, Intermission, and Part 2 at 1 hour mark', async () => {
      const { prisma } = await import('../db.js');
      const { SchedulerService } = await import('../services/scheduler.service.js');

      const testServer = await prisma.mediaServer.create({
        data: {
          name: 'Intermission Test Server',
          type: 'plex',
          url: 'http://localhost:32400',
          token: 'test-token',
        },
      });

      // Long movie: 120 minutes (7200 seconds)
      const longMovie = await prisma.mediaItem.create({
        data: {
          serverId: testServer.id,
          serverItemId: 'long-movie-1',
          title: 'The Great Odyssey',
          type: 'movie',
          duration: 7200, // 2 hours
        },
      });

      // Short movie: 45 minutes (2700 seconds)
      const shortMovie = await prisma.mediaItem.create({
        data: {
          serverId: testServer.id,
          serverItemId: 'short-movie-1',
          title: 'Short Adventure',
          type: 'movie',
          duration: 2700,
        },
      });

      const testChannel = await prisma.channel.create({
        data: {
          number: 9998,
          name: 'Bathroom Break Channel',
          type: 'movie',
          mode: 'continuous',
          manualItemIds: JSON.stringify([longMovie.id, shortMovie.id]),
          rules: JSON.stringify({
            enableIntermissions: true,
            intermissionThresholdMinutes: 75,
            intermissionBreakMinutes: 5,
            intermissionIntervalMinutes: 60,
          }),
        },
      });

      try {
        await SchedulerService.ensureSchedule(testChannel.id, 4);

        const schedules = await prisma.programSchedule.findMany({
          where: { channelId: testChannel.id },
          orderBy: { startTime: 'asc' },
        });

        // The first movie should be split into 3 segments:
        // 1. Part 1: 3600s (60 min), mediaOffset: 0
        // 2. Intermission: 300s (5 min), isIntermission: true
        // 3. Part 2: 3600s (60 min), mediaOffset: 3600

        const part1 = schedules[0];
        expect(part1.title).toContain('Part 1');
        expect(part1.duration).toBe(3600);
        expect(part1.mediaOffset).toBe(0);
        expect(part1.isIntermission).toBe(false);

        const intermission = schedules[1];
        expect(intermission.title).toContain('Intermission: Bathroom Break');
        expect(intermission.duration).toBe(300); // 5 minutes
        expect(intermission.isIntermission).toBe(true);

        const part2 = schedules[2];
        expect(part2.title).toContain('Part 2');
        expect(part2.duration).toBe(3600);
        expect(part2.mediaOffset).toBe(3600);
        expect(part2.isIntermission).toBe(false);

        // Next item is the short movie (45m), which should NOT be split
        const shortItem = schedules[3];
        expect(shortItem.title).toBe('Short Adventure');
        expect(shortItem.duration).toBe(2700);
        expect(shortItem.isIntermission).toBe(false);
      } finally {
        await prisma.programSchedule.deleteMany({ where: { channelId: testChannel.id } });
        await prisma.channel.delete({ where: { id: testChannel.id } });
        await prisma.mediaItem.deleteMany({ where: { serverId: testServer.id } });
        await prisma.mediaServer.delete({ where: { id: testServer.id } });
      }
    });
  });
});
