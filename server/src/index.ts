import dotenv from 'dotenv';
dotenv.config();

// Ensure DATABASE_URL fallback before Prisma initialization
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

if (process.env.TZ) {
  process.env.TZ = process.env.TZ;
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './db.js';

import serversRouter from './routes/api/servers.js';
import channelsRouter from './routes/api/channels.js';
import mediaRouter from './routes/api/media.js';
import proxyRouter from './routes/proxy.js';
import iptvRouter from './routes/iptv.js';
import streamRouter from './routes/stream.js';
import { SyncService } from './services/sync.service.js';
import { SchedulerService } from './services/scheduler.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/servers', serversRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/proxy', proxyRouter);

// IPTV & Stream Playout Routes
app.use('/iptv', iptvRouter);
app.use('/channels', streamRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MagicTV Server' });
});

// Serve static client build if available (production mode)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/iptv') || req.path.startsWith('/channels')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) next();
  });
});

async function initializeApp() {
  console.log('🚀 Initializing MagicTV Server...');
  
  // Seed sample demo movies if library is completely empty
  const itemCount = await prisma.mediaItem.count();
  if (itemCount === 0) {
    console.log('📦 Seeding initial creative-commons movie catalog for demo...');
    await SyncService.seedSampleLibraryIfNeeded();
  }

  // Create default starter channels if none exist
  const channelCount = await prisma.channel.count();
  if (channelCount === 0) {
    console.log('📺 Creating default channels...');
    const ch1 = await prisma.channel.create({
      data: {
        number: 1,
        name: 'Magic Cinema 24/7',
        description: 'Non-stop movie marathons and cinematic classics.',
        groupTitle: 'General',
        mode: 'continuous',
        shuffle: true,
      },
    });

    const ch2 = await prisma.channel.create({
      data: {
        number: 2,
        name: 'Retro Sci-Fi & Action',
        description: 'Intergalactic adventures, future tech, and intense action.',
        groupTitle: 'Sci-Fi',
        mode: 'continuous',
        rules: JSON.stringify({ genres: ['Sci-Fi', 'Action', 'Animation'] }),
        shuffle: true,
      },
    });

    const ch3 = await prisma.channel.create({
      data: {
        number: 3,
        name: 'Prime Time Classics',
        description: 'Scheduled feature presentations on the top of the hour.',
        groupTitle: 'Classics',
        mode: 'slotted',
        slotDuration: 30, // 30-minute block for short films
        rules: JSON.stringify({ sortBy: 'title' }),
        shuffle: false,
      },
    });

    // Populate schedules
    await SchedulerService.ensureSchedule(ch1.id, 48);
    await SchedulerService.ensureSchedule(ch2.id, 48);
    await SchedulerService.ensureSchedule(ch3.id, 48);
  }

  // Background scheduler roll-forward every 15 minutes
  setInterval(async () => {
    try {
      const channels = await prisma.channel.findMany({ where: { enabled: true } });
      for (const ch of channels) {
        await SchedulerService.ensureSchedule(ch.id, 48);
      }
    } catch (err) {
      console.error('Error running schedule maintenance:', err);
    }
  }, 15 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`✨ MagicTV Server running on http://localhost:${PORT}`);
    console.log(`📺 M3U Playlist: http://localhost:${PORT}/iptv/channels.m3u`);
    console.log(`📋 XMLTV EPG:    http://localhost:${PORT}/iptv/epg.xml`);
  });
}

initializeApp().catch(err => {
  console.error('Failed to start MagicTV server:', err);
  process.exit(1);
});
