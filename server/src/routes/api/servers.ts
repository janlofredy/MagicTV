import { Router } from 'express';
import { prisma } from '../../db.js';
import { PlexService } from '../../services/plex.service.js';
import { JellyfinService } from '../../services/jellyfin.service.js';
import { SyncService } from '../../services/sync.service.js';
import { z } from 'zod';

const router = Router();

const serverSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['plex', 'jellyfin']),
  url: z.string().url(),
  token: z.string().min(1),
  userId: z.string().optional().nullable(),
});

// GET /api/servers - List all configured media servers
router.get('/', async (req, res) => {
  try {
    const servers = await prisma.mediaServer.findMany({
      include: {
        libraries: true,
        _count: { select: { mediaItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/test - Test connection before saving
router.post('/test', async (req, res) => {
  const { type, url, token, userId } = req.body;
  if (!url || !token || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (type === 'plex') {
      const result = await PlexService.testConnection(url, token);
      return res.json(result);
    } else if (type === 'jellyfin') {
      const result = await JellyfinService.testConnection(url, token);
      return res.json(result);
    } else {
      return res.status(400).json({ error: 'Invalid server type' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/servers - Add media server and trigger initial sync
router.post('/', async (req, res) => {
  try {
    const parsed = serverSchema.parse(req.body);
    const server = await prisma.mediaServer.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        url: parsed.url,
        token: parsed.token,
        userId: parsed.userId,
      },
    });

    // Run sync in background or immediately
    SyncService.syncServer(server.id).catch(err => {
      console.error(`Background sync failed for server ${server.id}:`, err);
    });

    res.status(201).json(server);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/servers/:id/sync - Trigger sync manually
router.post('/:id/sync', async (req, res) => {
  try {
    const result = await SyncService.syncServer(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id - Delete media server
router.delete('/:id', async (req, res) => {
  try {
    await prisma.mediaServer.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
