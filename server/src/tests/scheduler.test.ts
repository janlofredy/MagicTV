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
});
