import { Router } from 'express';
import { prisma } from '../../db.js';
import { SchedulerService } from '../../services/scheduler.service.js';
import { AutoChannelService } from '../../services/auto-channel.service.js';
import { z } from 'zod';

const router = Router();

const channelSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  groupTitle: z.string().default('Movies'),
  type: z.enum(['movie', 'series', 'mixed']).default('movie'),
  mode: z.enum(['continuous', 'slotted']).default('continuous'),
  slotDuration: z.number().int().default(120),
  playMode: z.enum(['shuffle', 'sequential']).default('shuffle'),
  shuffle: z.boolean().default(true),
  rules: z.string().optional().nullable(),
  manualItemIds: z.string().optional().nullable(),
  seriesIds: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
});

// GET /api/channels - List all channels with current playout summary
router.get('/', async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { number: 'asc' },
    });

    const now = new Date();
    const baseUrl = process.env.BASE_URL || 'http://localhost:8000';

    // Batch fetch all active/current schedules across channels in a single query
    const currentSchedules = await prisma.programSchedule.findMany({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
      include: {
        mediaItem: true,
      },
    });

    // Batch fetch next schedules
    const nextSchedules = await prisma.programSchedule.findMany({
      where: {
        startTime: { gte: now },
      },
      include: {
        mediaItem: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const currentMap = new Map<string, typeof currentSchedules[0]>();
    for (const s of currentSchedules) {
      currentMap.set(s.channelId, s);
    }

    const nextMap = new Map<string, typeof nextSchedules[0]>();
    for (const s of nextSchedules) {
      if (!nextMap.has(s.channelId)) {
        nextMap.set(s.channelId, s);
      }
    }

    const enriched = channels.map(ch => {
      const current = currentMap.get(ch.id);
      const next = nextMap.get(ch.id);

      let currentProgram = null;
      if (current) {
        const elapsed = Math.max(0, Math.floor((now.getTime() - current.startTime.getTime()) / 1000));
        const duration = current.duration;
        const progressPercentage = Math.min(100, Math.round((elapsed / duration) * 100));
        let genres: string[] = [];
        try {
          genres = JSON.parse(current.mediaItem.genres || '[]');
        } catch {
          genres = [];
        }

        currentProgram = {
          id: current.id,
          mediaItemId: current.mediaItem.id,
          title: current.mediaItem.title,
          type: current.mediaItem.type,
          seriesName: current.mediaItem.seriesName,
          seasonNumber: current.mediaItem.seasonNumber,
          episodeNumber: current.mediaItem.episodeNumber,
          year: current.mediaItem.year,
          overview: current.mediaItem.overview,
          posterUrl: current.mediaItem.posterUrl,
          backdropUrl: current.mediaItem.backdropUrl,
          genres,
          rating: current.mediaItem.rating,
          contentRating: current.mediaItem.contentRating,
          startTime: current.startTime.toISOString(),
          endTime: current.endTime.toISOString(),
          duration,
          elapsedSeconds: elapsed,
          remainingSeconds: Math.max(0, duration - elapsed),
          progressPercentage,
        };
      }

      let nextProgram = null;
      if (next) {
        nextProgram = {
          id: next.id,
          title: next.mediaItem.title,
          type: next.mediaItem.type,
          seriesName: next.mediaItem.seriesName,
          seasonNumber: next.mediaItem.seasonNumber,
          episodeNumber: next.mediaItem.episodeNumber,
          startTime: next.startTime.toISOString(),
          endTime: next.endTime.toISOString(),
          duration: next.duration,
          posterUrl: next.mediaItem.posterUrl,
        };
      }

      let isOffAir = false;
      if (!currentProgram && ch.rules) {
        try {
          const rules = JSON.parse(ch.rules);
          if (rules.timeBlocks && Array.isArray(rules.timeBlocks)) {
            const h = now.getHours();
            isOffAir = rules.timeBlocks.some((b: any) => {
              if (b.type !== 'off_air') return false;
              if (b.startHour <= b.endHour) {
                return h >= b.startHour && h < b.endHour;
              } else {
                return h >= b.startHour || h < b.endHour;
              }
            });
          }
        } catch {}
      }

      return {
        ...ch,
        currentProgram,
        nextProgram,
        streamUrl: `${baseUrl}/channels/${ch.number}/stream.m3u8`,
        isOffAir,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/channels/guide - Full timeline schedule for EPG Grid (3-4 hour window)
router.get('/guide', async (req, res) => {
  try {
    const hours = Math.min(12, Math.max(1, parseInt(req.query.hours as string, 10) || 4));
    const now = new Date();
    const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins in past
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const channels = await prisma.channel.findMany({
      where: { enabled: true },
      orderBy: { number: 'asc' },
    });

    const schedules = await prisma.programSchedule.findMany({
      where: {
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: {
        mediaItem: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const scheduleByChannel = new Map<string, any[]>();
    for (const prog of schedules) {
      if (!scheduleByChannel.has(prog.channelId)) {
        scheduleByChannel.set(prog.channelId, []);
      }
      let genres: string[] = [];
      try {
        genres = JSON.parse(prog.mediaItem.genres || '[]');
      } catch {
        genres = [];
      }

      scheduleByChannel.get(prog.channelId)!.push({
        id: prog.id,
        channelId: prog.channelId,
        mediaItemId: prog.mediaItemId,
        title: prog.mediaItem.title,
        type: prog.mediaItem.type,
        seriesName: prog.mediaItem.seriesName,
        seasonNumber: prog.mediaItem.seasonNumber,
        episodeNumber: prog.mediaItem.episodeNumber,
        overview: prog.mediaItem.overview,
        year: prog.mediaItem.year,
        rating: prog.mediaItem.rating,
        contentRating: prog.mediaItem.contentRating,
        posterUrl: prog.mediaItem.posterUrl,
        genres,
        startTime: prog.startTime.toISOString(),
        endTime: prog.endTime.toISOString(),
        duration: prog.duration,
      });
    }

    const result = channels.map(ch => ({
      channel: ch,
      programs: scheduleByChannel.get(ch.id) || [],
    }));

    res.json({
      windowStart: startTime.toISOString(),
      windowEnd: endTime.toISOString(),
      channels: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/channels/:id - Get specific channel details and upcoming schedule
router.get('/:id', async (req, res) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: {
        schedules: {
          take: 20,
          where: { endTime: { gt: new Date() } },
          include: { mediaItem: true },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const state = await SchedulerService.getCurrentPlayoutState(channel.id);
    res.json({ ...channel, playout: state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/channels/:id/playout - Live playout state for TV player
router.get('/:id/playout', async (req, res) => {
  try {
    let channelId = req.params.id;
    const num = parseInt(channelId, 10);
    if (!isNaN(num) && String(num) === channelId) {
      const ch = await prisma.channel.findUnique({ where: { number: num } });
      if (ch) channelId = ch.id;
    }
    const state = await SchedulerService.getCurrentPlayoutState(channelId);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/channels/auto-generate - QuasiTV style automatic channel creation
router.post('/auto-generate', async (req, res) => {
  try {
    const result = await AutoChannelService.generateChannels(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/channels - Create channel
router.post('/', async (req, res) => {
  try {
    const parsed = channelSchema.parse(req.body);
    
    // Check channel number conflict
    const existing = await prisma.channel.findUnique({
      where: { number: parsed.number },
    });
    if (existing) {
      return res.status(400).json({ error: `Channel #${parsed.number} already exists` });
    }

    const channel = await prisma.channel.create({
      data: parsed,
    });

    // Populate schedule immediately
    await SchedulerService.ensureSchedule(channel.id, 48);

    res.status(201).json(channel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/channels/:id - Update channel
router.put('/:id', async (req, res) => {
  try {
    const parsed = channelSchema.parse(req.body);

    const existing = await prisma.channel.findFirst({
      where: {
        number: parsed.number,
        NOT: { id: req.params.id },
      },
    });
    if (existing) {
      return res.status(400).json({ error: `Channel #${parsed.number} is already taken` });
    }

    const updated = await prisma.channel.update({
      where: { id: req.params.id },
      data: parsed,
    });

    // Wipe future schedules and regenerate with new rules/configuration
    await prisma.programSchedule.deleteMany({
      where: {
        channelId: updated.id,
        startTime: { gt: new Date() },
      },
    });
    await SchedulerService.ensureSchedule(updated.id, 48);

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/channels/:id/refresh-schedule - Force regenerate schedule
router.post('/:id/refresh-schedule', async (req, res) => {
  try {
    await prisma.programSchedule.deleteMany({
      where: {
        channelId: req.params.id,
        startTime: { gt: new Date() },
      },
    });
    const added = await SchedulerService.ensureSchedule(req.params.id, 48);
    res.json({ success: true, programsAdded: added });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/channels/:id - Delete channel
router.delete('/:id', async (req, res) => {
  try {
    await prisma.channel.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
