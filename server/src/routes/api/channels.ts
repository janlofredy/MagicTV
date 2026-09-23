import { Router } from 'express';
import { prisma } from '../../db.js';
import { SchedulerService } from '../../services/scheduler.service.js';
import { z } from 'zod';

const router = Router();

const channelSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  groupTitle: z.string().default('Movies'),
  mode: z.enum(['continuous', 'slotted']).default('continuous'),
  slotDuration: z.number().int().default(120),
  shuffle: z.boolean().default(true),
  rules: z.string().optional().nullable(),
  manualItemIds: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
});

// GET /api/channels - List all channels with current playout summary
router.get('/', async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { number: 'asc' },
    });

    const enriched = await Promise.all(
      channels.map(async ch => {
        try {
          const state = await SchedulerService.getCurrentPlayoutState(ch.id);
          return {
            ...ch,
            currentProgram: state.currentProgram,
            nextProgram: state.nextProgram,
            streamUrl: state.streamUrl,
          };
        } catch {
          return {
            ...ch,
            currentProgram: null,
            nextProgram: null,
            streamUrl: `${process.env.BASE_URL || 'http://localhost:8000'}/channels/${ch.number}/stream.m3u8`,
          };
        }
      })
    );

    res.json(enriched);
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
    const state = await SchedulerService.getCurrentPlayoutState(req.params.id);
    res.json(state);
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
