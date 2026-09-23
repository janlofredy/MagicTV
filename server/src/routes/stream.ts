import { Router } from 'express';
import { SchedulerService } from '../services/scheduler.service.js';
import http from 'http';
import https from 'https';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Make a raw HTTP/HTTPS GET request and return the IncomingMessage. */
function fetchUpstream(url: string) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'MagicTV/1.0' } }, resolve);
    req.on('error', reject);
  });
}

/** Read an IncomingMessage body to a string. */
function readText(stream: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    stream.on('data', (c: Buffer) => (buf += c.toString()));
    stream.on('end', () => resolve(buf));
    stream.on('error', reject);
  });
}

/**
 * Rewrite every non-comment, non-empty line in an M3U8 to go through
 * MagicTV's /channels/:num/hls proxy, encoding the full upstream URL.
 */
function rewriteM3u8(content: string, baseUrl: string, channelNum: number, magicTvOrigin: string): string {
  return content
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (t === '' || t.startsWith('#')) return line;
      // Resolve relative URLs against the playlist's own base URL
      let abs: string;
      try {
        abs = new URL(t, baseUrl).toString();
      } catch {
        return line;
      }
      return `${magicTvOrigin}/channels/${channelNum}/hls?u=${encodeURIComponent(abs)}`;
    })
    .join('\n');
}

/** Parse offset / quality params from the request query string. */
function parseStreamParams(query: Record<string, any>): { customOffset?: number; maxBitrate?: number } {
  let customOffset: number | undefined;
  if (query.from === 'start') {
    customOffset = 0;
  } else if (query.offset !== undefined) {
    const p = parseFloat(String(query.offset));
    if (!isNaN(p)) customOffset = Math.max(0, p);
  }

  let maxBitrate: number | undefined;
  if (query.bitrate !== undefined) {
    const b = parseInt(String(query.bitrate), 10);
    if (!isNaN(b) && b > 0) maxBitrate = b;
  } else if (query.quality) {
    const q = String(query.quality).toLowerCase();
    if (q === '1080p') maxBitrate = 4_000_000;
    else if (q === '720p') maxBitrate = 2_000_000;
    else if (q === '480p') maxBitrate = 1_000_000;
    else if (q === '360p') maxBitrate = 600_000;
  }

  return { customOffset, maxBitrate };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /channels/:num/stream  — Live TV tuner endpoint (used by Jellyfin / Plex M3U)
//
// Strategy:
//   1. Resolve the current schedule → Jellyfin HLS URL with StartTimeTicks=<elapsed>
//   2. Fetch the master.m3u8 from Jellyfin
//   3. Rewrite every URL inside to go through /channels/:num/hls?u=…
//   4. Serve the rewritten playlist to the tuner
//
// This avoids Jellyfin seeing a redirect to its own server (which caused the
// "Playback Error") while giving the client a VOD HLS playlist that is fully
// seekable from 0:00 to end-of-movie in Jellyfin's timeline.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelNumber/stream', async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) return res.status(400).send('Invalid channel number');

  try {
    const { customOffset, maxBitrate } = parseStreamParams(req.query as Record<string, any>);

    // Resolve to an HLS (master.m3u8) URL with the correct schedule offset
    const hlsUrl = await SchedulerService.resolveStreamRedirectUrl(
      channelNumber,
      true, // preferHls
      new Date(),
      customOffset,
      maxBitrate
    );

    // If Jellyfin returned a master.m3u8 URL, proxy + rewrite it
    if (hlsUrl.includes('master.m3u8') || hlsUrl.includes('.m3u8')) {
      const upstream = await fetchUpstream(hlsUrl);
      const content = await readText(upstream);
      const origin = `${req.protocol}://${req.get('host')}`;
      const rewritten = rewriteM3u8(content, hlsUrl, channelNumber, origin);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(rewritten);
    }

    // Fallback for Plex / non-HLS: plain redirect
    return res.redirect(302, hlsUrl);
  } catch (err: any) {
    console.error(`Stream proxy error for channel ${channelNumber}:`, err);
    res.status(500).send(`Playout error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /channels/:num/hls?u=<encoded_upstream_url>
//
// Proxies a single HLS resource (playlist or TS segment) from the upstream
// Jellyfin server.  Playlists are rewritten recursively so all segment URLs
// continue to flow through MagicTV.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelNumber/hls', async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  const encoded = String(req.query.u ?? '');
  if (!encoded) return res.status(400).send('Missing u parameter');

  let upstreamUrl: string;
  try {
    upstreamUrl = decodeURIComponent(encoded);
  } catch {
    return res.status(400).send('Invalid u parameter');
  }

  try {
    const upstream = await fetchUpstream(upstreamUrl);
    const ct = (upstream.headers['content-type'] as string) ?? '';
    const isPlaylist = ct.includes('mpegurl') || upstreamUrl.includes('.m3u8');

    if (isPlaylist) {
      const content = await readText(upstream);
      const origin = `${req.protocol}://${req.get('host')}`;
      const rewritten = rewriteM3u8(content, upstreamUrl, channelNumber, origin);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      return res.send(rewritten);
    }

    // Binary segment (MPEG-TS, etc.) — pipe directly
    res.setHeader('Content-Type', ct || 'video/mp2t');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length'] as string);
    }
    upstream.pipe(res);
    req.on('close', () => upstream.destroy());
  } catch (err: any) {
    console.error(`HLS proxy error for ${upstreamUrl}:`, err);
    if (!res.headersSent) res.status(502).send('Upstream error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /channels/:num/stream.m3u8 — for the built-in MagicTV player
// Redirects directly to Jellyfin HLS (no proxy needed; built-in player uses
// HLS.js which isn't subject to Jellyfin's self-referential tuner restriction).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelNumber/stream.m3u8', async (req, res) => {
  const channelNumber = parseInt(req.params.channelNumber, 10);
  if (isNaN(channelNumber)) return res.status(400).send('Invalid channel number');

  try {
    const { customOffset, maxBitrate } = parseStreamParams(req.query as Record<string, any>);
    const redirectUrl = await SchedulerService.resolveStreamRedirectUrl(
      channelNumber,
      true,
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

export default router;
