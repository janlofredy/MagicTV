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
    const redirectUrl = await SchedulerService.resolveStreamRedirectUrl(channelNumber, isHls);
    
    // HTTP 302 Found redirect directly to the Plex / Jellyfin media stream with calculated offset
    res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error(`Playout redirect error for channel ${channelNumber}:`, err);
    res.status(500).send(`Playout error: ${err.message}`);
  }
});

export default router;
