import { Router } from 'express';
import { SchedulerService } from '../services/scheduler.service.js';
import { JellyfinService } from '../services/jellyfin.service.js';
import { PlexService } from '../services/plex.service.js';
import { prisma } from '../db.js';
import http from 'http';
import https from 'https';

const router = Router();

// GET /channels/:channelNumber/stream.m3u8 — HLS redirect (for built-in MagicTV player)
router.get('/:channelNumber/stream.m3u8', async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) return res.status(400).send('Invalid channel number');

  try {
    let customOffset: number | undefined;
    if (req.query.from === 'start') {
      customOffset = 0;
    } else if (req.query.offset !== undefined) {
      const p = parseFloat(String(req.query.offset));
      if (!isNaN(p)) customOffset = Math.max(0, p);
    }

    let maxBitrate: number | undefined;
    if (req.query.bitrate !== undefined) {
      const b = parseInt(String(req.query.bitrate), 10);
      if (!isNaN(b) && b > 0) maxBitrate = b;
    } else if (req.query.quality) {
      const q = String(req.query.quality).toLowerCase();
      if (q === '1080p') maxBitrate = 4000000;
      else if (q === '720p') maxBitrate = 2000000;
      else if (q === '480p') maxBitrate = 1000000;
      else if (q === '360p') maxBitrate = 600000;
    }

    const redirectUrl = await SchedulerService.resolveStreamRedirectUrl(
      channelNumber,
      true, // isHls
      new Date(),
      customOffset,
      maxBitrate
    );

    res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error(`HLS redirect error for channel ${channelNumber}:`, err);
    res.status(500).send(`Playout error: ${err.message}`);
  }
});

// GET /channels/:channelNumber/stream — byte-range proxy (for Jellyfin/Plex Live TV tuners)
// Proxies the upstream static file with full Range header support so Jellyfin exposes
// scrub controls in its Live TV player.
router.get('/:channelNumber/stream', async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) return res.status(400).send('Invalid channel number');

  try {
    let customOffset: number | undefined;
    if (req.query.from === 'start') {
      customOffset = 0;
    } else if (req.query.offset !== undefined) {
      const p = parseFloat(String(req.query.offset));
      if (!isNaN(p)) customOffset = Math.max(0, p);
    }

    let maxBitrate: number | undefined;
    if (req.query.bitrate !== undefined) {
      const b = parseInt(String(req.query.bitrate), 10);
      if (!isNaN(b) && b > 0) maxBitrate = b;
    } else if (req.query.quality) {
      const q = String(req.query.quality).toLowerCase();
      if (q === '1080p') maxBitrate = 4000000;
      else if (q === '720p') maxBitrate = 2000000;
      else if (q === '480p') maxBitrate = 1000000;
      else if (q === '360p') maxBitrate = 600000;
    }

    // Resolve the upstream URL (always static=true at offset 0 for Live TV proxy)
    // We override offset=0 so Jellyfin gets the full file from byte 0 and can byte-range seek.
    // The live broadcast position is communicated via EPG/XMLTV, not stream start.
    const upstreamUrl = await SchedulerService.resolveStreamRedirectUrl(
      channelNumber,
      false, // not HLS
      new Date(),
      0, // always from start so Jellyfin can seek/scrub to any position
      maxBitrate
    );

    // Proxy the upstream response with all byte-range headers forwarded
    const upstreamReq = upstreamUrl.startsWith('https') ? https : http;
    const proxyHeaders: Record<string, string> = {
      'User-Agent': 'MagicTV/1.0',
    };
    if (req.headers.range) {
      proxyHeaders['Range'] = req.headers.range;
    }

    const upstream = upstreamReq.get(upstreamUrl, { headers: proxyHeaders }, (upstreamRes) => {
      // Forward status and relevant headers
      const forwardHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'last-modified',
        'etag',
      ];
      const responseHeaders: Record<string, string | string[]> = {
        // Always advertise byte-range support so Jellyfin shows scrub controls
        'Accept-Ranges': 'bytes',
      };
      for (const h of forwardHeaders) {
        const v = upstreamRes.headers[h];
        if (v) responseHeaders[h] = v;
      }

      res.writeHead(upstreamRes.statusCode || 200, responseHeaders);
      upstreamRes.pipe(res);
    });

    upstream.on('error', (err) => {
      console.error(`Proxy stream error for channel ${channelNumber}:`, err);
      if (!res.headersSent) res.status(502).send('Upstream stream error');
    });

    req.on('close', () => upstream.destroy());
  } catch (err: any) {
    console.error(`Stream proxy error for channel ${channelNumber}:`, err);
    res.status(500).send(`Playout error: ${err.message}`);
  }
});

export default router;
