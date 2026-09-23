import React, { useState, useEffect } from 'react';
import { Radio, Film, Clock, Server, Copy, Check, ExternalLink, Play, Sparkles } from 'lucide-react';
import { Channel } from '../../types';

interface DashboardProps {
  onSelectChannel: (channel: Channel) => void;
  onLaunchTV: (channelNumber?: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLaunchTV }) => {
  const [stats, setStats] = useState({
    serversCount: 0,
    channelsCount: 0,
    moviesCount: 0,
    totalHours: 0,
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedEpg, setCopiedEpg] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const baseUrl = window.location.origin;
  const m3uUrl = `${baseUrl}/iptv/channels.m3u`;
  const epgUrl = `${baseUrl}/iptv/epg.xml`;

  const fetchData = async () => {
    try {
      const [statsRes, channelsRes] = await Promise.all([
        fetch('/api/media/stats'),
        fetch('/api/channels'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, type: 'm3u' | 'epg') => {
    navigator.clipboard.writeText(text);
    if (type === 'm3u') {
      setCopiedM3u(true);
      setTimeout(() => setCopiedM3u(false), 2000);
    } else {
      setCopiedEpg(true);
      setTimeout(() => setCopiedEpg(false), 2000);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await fetch('/api/media/seed-demo', { method: 'POST' });
      await fetchData();
    } finally {
      setSeeding(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Live IPTV Playout Active
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Pseudo-Live Cable TV for Plex & Jellyfin
          </h1>
          <p className="mt-3 text-slate-300 leading-relaxed text-sm sm:text-base">
            MagicTV turns your movie libraries into continuous broadcast channels. Plug the M3U playlist into any TV app like TiviMate, Apple TV, Kodi, or relax in the built-in 10-foot TV web player.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onLaunchTV()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Launch 10-Foot TV Experience</span>
            </button>

            {stats.moviesCount === 0 && (
              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl transition-all"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{seeding ? 'Seeding Demo Movies...' : 'Seed Demo Movies'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-600/10 via-indigo-600/10 to-transparent pointer-events-none" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Channels</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{stats.channelsCount}</div>
          <p className="mt-1 text-xs text-slate-500">Broadcasting 24/7</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Movie Catalog</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{stats.moviesCount}</div>
          <p className="mt-1 text-xs text-slate-500">Indexed & ready for rules</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Duration</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{stats.totalHours} hrs</div>
          <p className="mt-1 text-xs text-slate-500">Non-stop content</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Media Servers</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-white">{stats.serversCount}</div>
          <p className="mt-1 text-xs text-slate-500">Plex & Jellyfin connected</p>
        </div>
      </div>

      {/* IPTV Feed Endpoints Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <span>IPTV & EPG Feed URLs for your TV Clients</span>
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Paste these feed URLs into external IPTV players (e.g., TiviMate, OTT Navigator, Kodi IPTV Simple Client, Apple TV IPTVX, or VLC).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">M3U Playlist URL</span>
              <a
                href={m3uUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Download <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={m3uUrl}
                className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 flex-1 font-mono select-all focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => copyToClipboard(m3uUrl, 'm3u')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                title="Copy M3U URL"
              >
                {copiedM3u ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">XMLTV EPG URL</span>
              <a
                href={epgUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Download <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={epgUrl}
                className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 flex-1 font-mono select-all focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => copyToClipboard(epgUrl, 'epg')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                title="Copy EPG URL"
              >
                {copiedEpg ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing Channel Monitor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span>Live Channels On Air</span>
          </h2>
          <span className="text-xs text-slate-400">Auto-refreshes every 10s</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(channel => {
            const prog = channel.currentProgram;
            return (
              <div
                key={channel.id}
                className="group relative bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl overflow-hidden transition-all duration-200 shadow-md flex flex-col"
              >
                {/* Header with channel number & title */}
                <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/60 text-cyan-300 font-extrabold flex items-center justify-center text-sm shadow-inner">
                      {channel.number}
                    </span>
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                        {channel.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">{channel.groupTitle}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onLaunchTV(channel.number)}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 rounded-lg transition-all"
                    title="Watch Channel"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Current Program Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  {prog ? (
                    <div>
                      <div className="flex gap-3">
                        {prog.posterUrl ? (
                          <img
                            src={prog.posterUrl.startsWith('http') ? prog.posterUrl : `/api/proxy/image?mediaId=${prog.mediaItemId}`}
                            alt={prog.title}
                            className="w-16 h-24 object-cover rounded-md border border-slate-800 shadow"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                            No Poster
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                            Now Playing
                          </span>
                          <h4 className="text-sm font-semibold text-white truncate mt-0.5" title={prog.title}>
                            {prog.title}
                          </h4>
                          {prog.year && <span className="text-xs text-slate-400">{prog.year}</span>}

                          {prog.genres && prog.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {prog.genres.slice(0, 2).map(g => (
                                <span key={g} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>{formatSeconds(prog.elapsedSeconds)}</span>
                          <span>{formatSeconds(prog.duration)}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${prog.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 text-sm italic">
                      Intermission / No Program Scheduled
                    </div>
                  )}

                  {/* Up Next Teaser */}
                  {channel.nextProgram && (
                    <div className="pt-3 border-t border-slate-800/80 text-xs flex items-center justify-between text-slate-400">
                      <span className="font-medium text-slate-500">Up Next:</span>
                      <span className="truncate max-w-[180px] text-slate-300 font-medium">
                        {channel.nextProgram.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
