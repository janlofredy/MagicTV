import { Router } from 'express';
import { IptvService } from '../services/iptv.service.js';
import { SchedulerService } from '../services/scheduler.service.js';

const router = Router();

const getBaseUrl = (req: any) => {
  const host = req.get('host');
  const protocol = req.protocol;
  return process.env.BASE_URL || `${protocol}://${host}`;
};

// GET /iptv/channels.m3u & /iptv/channels.m3u8 - M3U Playlist
router.get(['/channels.m3u', '/channels.m3u8'], async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const m3u = await IptvService.generateM3U(baseUrl);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="magictv_channels.m3u"');
    res.send(m3u);
  } catch (err: any) {
    res.status(500).send(`#EXTM3U\n# Error generating playlist: ${err.message}`);
  }
});

// GET /iptv/epg.xml - XMLTV EPG Feed
router.get('/epg.xml', async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const xml = await IptvService.generateXmltv(baseUrl, 48);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="magictv_epg.xml"');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><tv error="${err.message}"></tv>`);
  }
});

// GET /iptv/channels/:channelNumber/stream & .m3u8 - Dedicated IPTV tuner stream
router.get(['/channels/:channelNumber/stream', '/channels/:channelNumber/stream.m3u8'], async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) {
    return res.status(400).send('Invalid channel number');
  }

  try {
    const isHls = req.path.endsWith('.m3u8') || req.query.format === 'hls';

    let customOffset: number | undefined;
    if (req.query.offset !== undefined) {
      const parsedOffset = parseFloat(String(req.query.offset));
      if (!isNaN(parsedOffset)) {
        customOffset = Math.max(0, parsedOffset);
      }
    }

    let maxBitrate: number | undefined;
    if (req.query.bitrate !== undefined) {
      const parsedBitrate = parseInt(String(req.query.bitrate), 10);
      if (!isNaN(parsedBitrate) && parsedBitrate > 0) {
        maxBitrate = parsedBitrate;
      }
    } else if (req.query.quality) {
      const q = String(req.query.quality).toLowerCase();
      if (q === '1080p') maxBitrate = 4000000;
      else if (q === '720p') maxBitrate = 2000000;
      else if (q === '480p') maxBitrate = 1000000;
      else if (q === '360p') maxBitrate = 600000;
    }

    const redirectUrl = await SchedulerService.resolveIptvStreamUrl(
      channelNumber,
      isHls,
      new Date(),
      customOffset,
      maxBitrate
    );

    // Prevent tuner clients and proxies from caching the 302 redirect
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error(`[IPTV] Playout redirect error for channel ${channelNumber}:`, err);
    res.status(500).send(`IPTV playout error: ${err.message}`);
  }
});

export default router;
