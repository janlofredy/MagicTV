import { Router } from 'express';
import { SchedulerService } from '../services/scheduler.service.js';

const router = Router();

// GET /channels/:channelNumber/stream or /channels/:channelNumber/stream.m3u8
router.get(['/:channelNumber/stream', '/:channelNumber/stream.m3u8'], async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) {
    return res.status(400).send('Invalid channel number');
  }

  try {
    const isHls = req.path.endsWith('.m3u8') || req.query.format === 'hls';
    
    // Support custom seek offset (e.g. ?offset=0 for watch from start, or scrub seconds)
    let customOffset: number | undefined;
    if (req.query.offset !== undefined) {
      const parsedOffset = parseFloat(String(req.query.offset));
      if (!isNaN(parsedOffset)) {
        customOffset = Math.max(0, parsedOffset);
      }
    }

    // Support quality bitrate limiting (e.g. ?bitrate=1500000 or ?quality=720p/1080p/480p)
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

    const redirectUrl = await SchedulerService.resolveStreamRedirectUrl(
      channelNumber,
      isHls,
      new Date(),
      customOffset,
      maxBitrate
    );
    
    // Ensure clients and intermediate proxies/tuner clients do not cache the 302 redirect
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // HTTP 302 Found redirect directly to the Plex / Jellyfin media stream with calculated offset
    res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error(`Playout redirect error for channel ${channelNumber}:`, err);
    res.status(500).send(`Playout error: ${err.message}`);
  }
});

export default router;
