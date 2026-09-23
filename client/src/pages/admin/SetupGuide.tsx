import React, { useState } from 'react';
import { Tv, Radio, HelpCircle, Check, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface SetupGuideProps {
  onLaunchTV?: (channelNumber?: number) => void;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ onLaunchTV }) => {
  const baseUrl = window.location.origin;
  const m3uUrl = `${baseUrl}/iptv/channels.m3u`;
  const epgUrl = `${baseUrl}/iptv/epg.xml`;

  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedEpg, setCopiedEpg] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<'jellyfin' | 'plex' | 'iptv'>('jellyfin');

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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Live TV Integration Guide</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          How to Setup Live TV in Jellyfin & Plex
        </h1>
        <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
          MagicTV exposes your custom channels and schedule as standard IPTV feeds. Follow the simple steps below to bring continuous live channels directly into your favorite media players and Smart TVs.
        </p>
      </div>

      {/* Quick Feed Endpoints Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
        <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Your MagicTV Feed Endpoints</span>
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          These URLs automatically serve all enabled channels and electronic programming guide (EPG) schedules.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* M3U Playlist */}
          <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  M3U Tuner / Stream Playlist
                </span>
                <a
                  href={m3uUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  Download <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Used in Jellyfin "M3U Tuner", Plex "Live TV & DVR", and IPTV apps.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={m3uUrl}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 flex-1 font-mono select-all focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => copyToClipboard(m3uUrl, 'm3u')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors shrink-0"
                title="Copy M3U URL"
              >
                {copiedM3u ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* XMLTV EPG */}
          <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  XMLTV TV Guide (EPG)
                </span>
                <a
                  href={epgUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                >
                  Download <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Provides airtimes, titles, posters, ratings, and episode descriptions up to 48h ahead.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={epgUrl}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 flex-1 font-mono select-all focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => copyToClipboard(epgUrl, 'epg')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors shrink-0"
                title="Copy EPG URL"
              >
                {copiedEpg ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Step-by-Step Instructions */}
      <div className="space-y-4">
        {/* Jellyfin Accordion */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <button
            onClick={() => setActiveAccordion(prev => (prev === 'jellyfin' ? ('none' as any) : 'jellyfin'))}
            className="w-full p-6 text-left flex items-center justify-between bg-slate-900 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-lg">
                🍇
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Jellyfin Live TV Setup</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 uppercase tracking-wider border border-purple-500/30">
                    Recommended
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Native support for M3U tuners and XMLTV guides without third-party plugins.
                </p>
              </div>
            </div>
            {activeAccordion === 'jellyfin' ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {activeAccordion === 'jellyfin' && (
            <div className="p-6 pt-2 border-t border-slate-800/80 space-y-6 text-sm text-slate-300">
              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>Navigate to Live TV Settings</span>
                </h4>
                <p className="text-xs text-slate-400 ml-8 leading-relaxed">
                  Open your Jellyfin web interface (<code className="text-cyan-300">http://&lt;jellyfin-ip&gt;:8096</code>) as an administrator. In the left sidebar under the <strong className="text-slate-200">Server</strong> heading, click on <strong className="text-cyan-400">Live TV</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>Add Tuner Device (M3U Playlist)</span>
                </h4>
                <div className="ml-8 space-y-2 text-xs text-slate-400">
                  <p>Under the <strong className="text-slate-200">Tuner Devices</strong> section, click the <strong className="text-cyan-400">+</strong> button.</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong className="text-slate-200">Tuner type:</strong> Select <strong className="text-cyan-300">M3U Tuner</strong>.</li>
                    <li>
                      <strong className="text-slate-200">File or URL:</strong> Paste your MagicTV M3U URL:
                      <div className="mt-1 flex items-center gap-2 max-w-xl">
                        <code className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-cyan-300 font-mono text-[11px] select-all flex-1">
                          {m3uUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(m3uUrl, 'm3u')}
                          className="px-2 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 text-xs hover:bg-slate-700"
                        >
                          {copiedM3u ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </li>
                    <li><strong className="text-slate-200">Simultaneous streams:</strong> Set to <code className="text-slate-300">4</code> or <code className="text-slate-300">0</code> (unlimited).</li>
                  </ul>
                  <p>Click <strong className="text-slate-200">Save</strong>.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>Add TV Guide Data Provider (XMLTV)</span>
                </h4>
                <div className="ml-8 space-y-2 text-xs text-slate-400">
                  <p>Under the <strong className="text-slate-200">TV Guide Data Providers</strong> section, click the <strong className="text-indigo-400">+</strong> button.</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Choose <strong className="text-indigo-300">XMLTV</strong>.</li>
                    <li>
                      <strong className="text-slate-200">File or URL:</strong> Paste your MagicTV XMLTV URL:
                      <div className="mt-1 flex items-center gap-2 max-w-xl">
                        <code className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-indigo-300 font-mono text-[11px] select-all flex-1">
                          {epgUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(epgUrl, 'epg')}
                          className="px-2 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 text-xs hover:bg-slate-700"
                        >
                          {copiedEpg ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </li>
                  </ul>
                  <p>Click <strong className="text-slate-200">Save</strong>.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center text-xs">
                    4
                  </span>
                  <span>Trigger Guide Sync</span>
                </h4>
                <p className="text-xs text-slate-400 ml-8 leading-relaxed">
                  In Jellyfin, navigate to <strong className="text-slate-200">Dashboard ➔ Scheduled Tasks</strong>. Find <strong className="text-cyan-400">Refresh Guide</strong> and click the <strong className="text-cyan-400">Play (▶)</strong> button. Within seconds, all your movie and TV channels will populate in Jellyfin's Live TV Guide!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Plex Accordion */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <button
            onClick={() => setActiveAccordion(prev => (prev === 'plex' ? ('none' as any) : 'plex'))}
            className="w-full p-6 text-left flex items-center justify-between bg-slate-900 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-lg">
                🟠
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Plex Live TV & DVR Setup</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase tracking-wider border border-amber-500/30">
                    Plex Pass
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Integrate pseudo-live broadcast streams directly into your Plex Pass Live TV grid.
                </p>
              </div>
            </div>
            {activeAccordion === 'plex' ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {activeAccordion === 'plex' && (
            <div className="p-6 pt-2 border-t border-slate-800/80 space-y-6 text-sm text-slate-300">
              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>Navigate to Live TV & DVR in Plex</span>
                </h4>
                <p className="text-xs text-slate-400 ml-8 leading-relaxed">
                  Open the Plex Web App (<code className="text-cyan-300">http://&lt;plex-ip&gt;:32400/web</code>) with an admin account. Click the <strong className="text-slate-200">Settings</strong> wrench icon in the top right. Under the <strong className="text-slate-200">Manage</strong> section on the left sidebar, click <strong className="text-amber-400">Live TV & DVR</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>Add Tuner Device</span>
                </h4>
                <div className="ml-8 space-y-2 text-xs text-slate-400">
                  <p>Click <strong className="text-slate-200">Set Up Plex DVR</strong> (or <strong className="text-slate-200">Add Device</strong>).</p>
                  <p>If Plex does not auto-detect, click <strong className="text-cyan-300">Don't see your device? Enter its network address manually</strong>.</p>
                  <p>
                    Enter your MagicTV M3U URL:
                    <div className="mt-1 flex items-center gap-2 max-w-xl">
                      <code className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-cyan-300 font-mono text-[11px] select-all flex-1">
                        {m3uUrl}
                      </code>
                      <button
                        onClick={() => copyToClipboard(m3uUrl, 'm3u')}
                        className="px-2 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 text-xs hover:bg-slate-700"
                      >
                        {copiedM3u ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </p>
                  <p>Click <strong className="text-slate-200">Connect</strong> ➔ <strong className="text-slate-200">Continue</strong>.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>Connect XMLTV Guide</span>
                </h4>
                <div className="ml-8 space-y-2 text-xs text-slate-400">
                  <p>In the guide selection step, choose <strong className="text-indigo-300">Use XMLTV</strong>.</p>
                  <p>
                    Paste the MagicTV XMLTV EPG URL:
                    <div className="mt-1 flex items-center gap-2 max-w-xl">
                      <code className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-indigo-300 font-mono text-[11px] select-all flex-1">
                        {epgUrl}
                      </code>
                      <button
                        onClick={() => copyToClipboard(epgUrl, 'epg')}
                        className="px-2 py-1 bg-slate-800 text-slate-200 rounded border border-slate-700 text-xs hover:bg-slate-700"
                      >
                        {copiedEpg ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </p>
                  <p>Enter a title such as <strong className="text-slate-200">MagicTV Guide</strong> and click <strong className="text-slate-200">Continue</strong> ➔ <strong className="text-slate-200">Finish</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Third-Party IPTV Apps Accordion */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <button
            onClick={() => setActiveAccordion(prev => (prev === 'iptv' ? ('none' as any) : 'iptv'))}
            className="w-full p-6 text-left flex items-center justify-between bg-slate-900 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-black text-lg">
                📱
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Smart TV & IPTV Apps (TiviMate, Apple TV, Kodi, VLC)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compatible with all standard IPTV players on Android TV, Fire TV, iOS, and PC.
                </p>
              </div>
            </div>
            {activeAccordion === 'iptv' ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {activeAccordion === 'iptv' && (
            <div className="p-6 pt-2 border-t border-slate-800/80 space-y-4 text-xs text-slate-300">
              <ol className="list-decimal list-inside space-y-2 leading-relaxed ml-2 text-slate-400">
                <li>Open your IPTV player (e.g. <strong className="text-slate-200">TiviMate</strong>, <strong className="text-slate-200">IPTV Smarters</strong>, <strong className="text-slate-200">OTT Navigator</strong>, or <strong className="text-slate-200">IPTVX</strong>).</li>
                <li>Choose <strong className="text-slate-200">Add Playlist</strong> and select <strong className="text-cyan-300">M3U Playlist</strong>.</li>
                <li>Enter the M3U Playlist URL: <code className="text-cyan-300 select-all">{m3uUrl}</code>.</li>
                <li>Under EPG or TV Guide Source, enter the XMLTV URL: <code className="text-indigo-300 select-all">{epgUrl}</code>.</li>
                <li>Set the EPG update frequency to every 12 or 24 hours.</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Built-in TV Player callout */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>Prefer watching directly in your browser?</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Experience our 10-foot TV player with full D-Pad navigation, cable guide overlay, and instant audio controls.
          </p>
        </div>
        {onLaunchTV && (
          <button
            onClick={() => onLaunchTV()}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all shrink-0"
          >
            Launch 10ft TV Mode
          </button>
        )}
      </div>
    </div>
  );
};
