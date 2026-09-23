import { prisma } from '../db.js';
import { create } from 'xmlbuilder2';
import { SchedulerService } from './scheduler.service.js';

export class IptvService {
  /**
   * Formats a date into XMLTV timestamp: YYYYMMDDHHMMSS +0000
   */
  private static formatXmltvDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds} +0000`;
  }

  /**
   * Generates standard M3U / M3U8 IPTV Playlist
   */
  static async generateM3U(baseUrl: string): Promise<string> {
    const channels = await prisma.channel.findMany({
      where: { enabled: true },
      orderBy: { number: 'asc' },
    });

    const lines: string[] = ['#EXTM3U'];

    for (const ch of channels) {
      const tvgId = `magictv.${ch.number}`;
      const tvgName = ch.name;
      const tvgChno = ch.number;
      const logo = ch.logoUrl || `${baseUrl}/api/channels/${ch.id}/logo`;
      const group = ch.groupTitle || 'Movies';
      // Use HLS starting from the beginning of the current media item.
      // This lets Jellyfin Live TV expose full scrubbing controls (back to 00:00 or forward).
      // The EPG/XMLTV still shows the correct live position; the player just starts from t=0
      // so the viewer can scrub freely through the whole movie.
      const streamUrl = `${baseUrl}/channels/${ch.number}/stream.m3u8?from=start`;

      lines.push(
        `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-chno="${tvgChno}" tvg-logo="${logo}" group-title="${group}",${ch.name}`
      );
      lines.push(streamUrl);
    }

    return lines.join('\n');
  }

  /**
   * Generates standard XMLTV EPG feed
   */
  static async generateXmltv(baseUrl: string, hoursAhead: number = 48): Promise<string> {
    const channels = await prisma.channel.findMany({
      where: { enabled: true },
      orderBy: { number: 'asc' },
    });

    const now = new Date();
    const pastWindow = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const futureWindow = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('tv', {
        'generator-info-name': 'MagicTV',
        'generator-info-url': 'https://github.com/janlofredy/MagicTV',
      });

    // 1. Channel entries
    for (const ch of channels) {
      const tvgId = `magictv.${ch.number}`;
      const chEle = root.ele('channel', { id: tvgId });
      chEle.ele('display-name').txt(ch.name);
      chEle.ele('display-name').txt(String(ch.number));
      if (ch.logoUrl) {
        chEle.ele('icon', { src: ch.logoUrl });
      }

      // Ensure channel schedule is populated
      await SchedulerService.ensureSchedule(ch.id, hoursAhead);
    }

    // 2. Programme entries
    const schedules = await prisma.programSchedule.findMany({
      where: {
        channel: { enabled: true },
        startTime: { lt: futureWindow },
        endTime: { gt: pastWindow },
      },
      include: {
        channel: true,
        mediaItem: true,
      },
      orderBy: { startTime: 'asc' },
    });

    for (const prog of schedules) {
      const tvgId = `magictv.${prog.channel.number}`;
      const media = prog.mediaItem;

      const progEle = root.ele('programme', {
        start: this.formatXmltvDate(prog.startTime),
        stop: this.formatXmltvDate(prog.endTime),
        channel: tvgId,
      });

      if (media.type === 'episode' && media.seriesName) {
        progEle.ele('title', { lang: 'en' }).txt(media.seriesName);
        progEle.ele('sub-title', { lang: 'en' }).txt(media.title);
        const s = media.seasonNumber || 1;
        const e = media.episodeNumber || 1;
        progEle.ele('episode-num', { system: 'onscreen' }).txt(`S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`);
        progEle.ele('episode-num', { system: 'xmltv_ns' }).txt(`${s - 1}.${e - 1}.`);
      } else {
        progEle.ele('title', { lang: 'en' }).txt(prog.title);
      }

      if (media.overview) {
        progEle.ele('desc', { lang: 'en' }).txt(media.overview);
      }

      if (media.year) {
        progEle.ele('date').txt(String(media.year));
      }

      try {
        const genres: string[] = JSON.parse(media.genres || '[]');
        for (const g of genres) {
          progEle.ele('category', { lang: 'en' }).txt(g);
        }
      } catch {}

      if (media.posterUrl) {
        const poster = media.posterUrl.startsWith('http')
          ? media.posterUrl
          : `${baseUrl}${media.posterUrl}`;
        progEle.ele('icon', { src: poster });
      }

      if (media.contentRating) {
        const ratingEle = progEle.ele('rating', { system: 'MPAA' });
        ratingEle.ele('value').txt(media.contentRating);
      }

      if (media.rating) {
        const starEle = progEle.ele('star-rating');
        starEle.ele('value').txt(`${media.rating}/10`);
      }
    }

    return root.end({ prettyPrint: true });
  }
}
