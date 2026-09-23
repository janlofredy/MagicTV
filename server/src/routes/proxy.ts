import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// GET /api/proxy/image?mediaId=...&type=poster|backdrop
router.get('/image', async (req, res) => {
  const { mediaId, type = 'poster' } = req.query;

  if (!mediaId || typeof mediaId !== 'string') {
    return res.status(400).send('Missing mediaId');
  }

  try {
    const item = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
      include: { server: true },
    });

    if (!item) {
      return res.status(404).send('Media item not found');
    }

    let targetUrl: string | null = null;
    const server = item.server;
    const rawPath = type === 'backdrop' ? item.backdropUrl : item.posterUrl;

    if (!rawPath) {
      return res.status(404).send('No image available');
    }

    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      targetUrl = rawPath;
    } else if (server.type === 'plex') {
      targetUrl = `${server.url.replace(/\/+$/, '')}${rawPath}?X-Plex-Token=${server.token}`;
    } else if (server.type === 'jellyfin') {
      const imgType = type === 'backdrop' ? 'Backdrop' : 'Primary';
      targetUrl = `${server.url.replace(/\/+$/, '')}/Items/${item.serverItemId}/Images/${imgType}?api_key=${server.token}`;
    }

    if (!targetUrl) {
      return res.status(404).send('Could not construct image URL');
    }

    const imageRes = await fetch(targetUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!imageRes.ok) {
      return res.status(imageRes.status).send('Failed to fetch upstream image');
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send(`Image proxy error: ${err.message}`);
  }
});

export default router;
