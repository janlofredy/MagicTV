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

export default router;
