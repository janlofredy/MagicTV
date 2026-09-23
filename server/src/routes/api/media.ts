import { Router } from 'express';
import { prisma } from '../../db.js';
import { SyncService } from '../../services/sync.service.js';

const router = Router();

// GET /api/media - Browse cached movies with search & filters
router.get('/', async (req, res) => {
  try {
    const { search, genre, year, serverId, limit = '50', offset = '0' } = req.query;

    const where: any = {};

    if (serverId && typeof serverId === 'string') {
      where.serverId = serverId;
    }

    if (year) {
      where.year = parseInt(String(year), 10);
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { overview: { contains: search } },
      ];
    }

    if (genre && typeof genre === 'string') {
      where.genres = { contains: genre };
    }

    const [items, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        take: parseInt(String(limit), 10),
        skip: parseInt(String(offset), 10),
        orderBy: { title: 'asc' },
        include: { server: { select: { name: true, type: true } } },
      }),
      prisma.mediaItem.count({ where }),
    ]);

    res.json({ items, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/genres - Distinct genres list
router.get('/genres', async (req, res) => {
  try {
    const items = await prisma.mediaItem.findMany({
      select: { genres: true },
    });

    const set = new Set<string>();
    for (const item of items) {
      try {
        const parsed = JSON.parse(item.genres || '[]');
        parsed.forEach((g: string) => set.add(g));
      } catch {}
    }

    res.json(Array.from(set).sort());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/stats - Dashboard summary metrics
router.get('/stats', async (req, res) => {
  try {
    const [serversCount, channelsCount, moviesCount, totalDurationResult] = await Promise.all([
      prisma.mediaServer.count(),
      prisma.channel.count({ where: { enabled: true } }),
      prisma.mediaItem.count(),
      prisma.mediaItem.aggregate({
        _sum: { duration: true },
      }),
    ]);

    const totalSeconds = totalDurationResult._sum.duration || 0;
    const totalHours = Math.round(totalSeconds / 3600);

    res.json({
      serversCount,
      channelsCount,
      moviesCount,
      totalHours,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/seed-demo - Seed demo catalog
router.post('/seed-demo', async (req, res) => {
  try {
    const created = await SyncService.seedSampleLibraryIfNeeded();
    res.json({ success: true, created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
