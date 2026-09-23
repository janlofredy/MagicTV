import React, { useState, useEffect, useRef } from 'react';
import { Channel } from '../../types';
import Hls from 'hls.js';
import { ArrowLeft, Tv } from 'lucide-react';

interface TVPlayerProps {
  initialChannelNumber?: number;
  onExit: () => void;
}

export const TVPlayer: React.FC<TVPlayerProps> = ({ initialChannelNumber = 1, onExit }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelIndex, setActiveChannelIndex] = useState(0);
  const [showOSD, setShowOSD] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [focusedGuideChannelIndex, setFocusedGuideChannelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playoutState, setPlayoutState] = useState<any>(null);
  const [channelInputDigits, setChannelInputDigits] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const osdTimerRef = useRef<any>(null);
  const digitTimerRef = useRef<any>(null);

  const activeChannel = channels[activeChannelIndex];

  // Fetch all channels
  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (data.length > 0) {
          const foundIdx = data.findIndex(c => c.number === initialChannelNumber);
          setActiveChannelIndex(foundIdx >= 0 ? foundIdx : 0);
          setFocusedGuideChannelIndex(foundIdx >= 0 ? foundIdx : 0);
        }
      })
      .catch(console.error);
  }, [initialChannelNumber]);

  // Fetch live playout state for active channel
  useEffect(() => {
    if (!activeChannel) return;

    const fetchPlayout = async () => {
      try {
        const res = await fetch(`/api/channels/${activeChannel.id}/playout`);
        if (res.ok) {
          const state = await res.json();
          setPlayoutState(state);
        }
      } catch (err) {
        console.error('Failed to load playout:', err);
      }
    };

    fetchPlayout();
    const timer = setInterval(fetchPlayout, 5000);
    return () => clearInterval(timer);
  }, [activeChannel]);

  // Synchronize playback position with live broadcast offset
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playoutState?.currentProgram) return;

    const offset = playoutState.currentProgram.elapsedSeconds;
    // If video has metadata and is starting near 0s while broadcast offset is ahead
    if (video.readyState >= 1 && video.duration > offset && video.duration > (playoutState.currentProgram.duration * 0.7)) {
      if (video.currentTime < 3 && offset > 5) {
        console.log(`[TVPlayer PlayoutSync] Seeking to live offset ${offset}s (currentTime: ${video.currentTime.toFixed(1)}s, duration: ${video.duration.toFixed(1)}s)`);
        video.currentTime = offset;
      }
    }
  }, [playoutState]);

  // Handle Video Stream Loading & Offset Playback
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    const video = videoRef.current;
    const streamUrl = `/channels/${activeChannel.number}/stream.m3u8`;

    const handleLoadedMetadata = () => {
      const offset = playoutState?.currentProgram?.elapsedSeconds;
      if (offset && offset > 3 && video.duration > offset && video.duration > (playoutState.currentProgram.duration * 0.7)) {
        console.log(`[TVPlayer Metadata] Initial seek to ${offset}s`);
        video.currentTime = offset;
      }
      video.play().catch(e => console.log('Autoplay prevented:', e));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          // If HLS fails, fallback to direct video stream
          console.warn('HLS fatal error, falling back to direct video stream:', data);
          video.src = `/channels/${activeChannel.number}/stream`;
          video.play().catch(() => {});
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = streamUrl;
      video.play().catch(() => {});
    } else {
      video.src = `/channels/${activeChannel.number}/stream`;
      video.play().catch(() => {});
    }

    triggerOSD();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannelIndex, channels]);

  // OSD auto-hide timer
  const triggerOSD = () => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowOSD(false);
    }, 5000);
  };

  // Keyboard / D-Pad Remote Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If direct digit key
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const newDigits = channelInputDigits + e.key;
        setChannelInputDigits(newDigits);
        triggerOSD();

        if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
        digitTimerRef.current = setTimeout(() => {
          const targetNumber = parseInt(newDigits, 10);
          const idx = channels.findIndex(c => c.number === targetNumber);
          if (idx >= 0) {
            setActiveChannelIndex(idx);
            setFocusedGuideChannelIndex(idx);
          }
          setChannelInputDigits('');
        }, 1200);
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowGuide(prev => !prev);
        triggerOSD();
        return;
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (showGuide) {
          setShowGuide(false);
        } else {
          onExit();
        }
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted(prev => !prev);
        if (videoRef.current) videoRef.current.muted = !isMuted;
        triggerOSD();
        return;
      }

      if (showGuide) {
        // Guide navigation
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedGuideChannelIndex(prev => (prev > 0 ? prev - 1 : channels.length - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedGuideChannelIndex(prev => (prev < channels.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          setActiveChannelIndex(focusedGuideChannelIndex);
          setShowGuide(false);
          triggerOSD();
        }
        return;
      }

      // Normal TV Player navigation (Guide hidden)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveChannelIndex(prev => (prev > 0 ? prev - 1 : channels.length - 1));
        triggerOSD();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveChannelIndex(prev => (prev < channels.length - 1 ? prev + 1 : 0));
        triggerOSD();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        triggerOSD();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setShowGuide(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, focusedGuideChannelIndex, channels, channelInputDigits, isMuted]);

  const formatSeconds = (sec?: number) => {
    if (!sec) return '0:00';
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const curProg = playoutState?.currentProgram;
  const focusedChannel = channels[focusedGuideChannelIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none cursor-none hover:cursor-default font-sans"
      onMouseMove={triggerOSD}
    >
      {/* Background Live Video Player */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain bg-black"
      />

      {/* Top Floating Station Bug & Controls */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-30 pointer-events-none">
        {/* Back to Admin Button */}
        <button
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white backdrop-blur transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Exit TV</span>
        </button>

        {/* Station Bug / Channel watermark */}
        <div className="flex items-center gap-3">
          {channelInputDigits && (
            <div className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-black text-2xl font-mono shadow-2xl animate-pulse">
              {channelInputDigits}
            </div>
          )}

          {activeChannel && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 backdrop-blur flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs">
                {activeChannel.number}
              </span>
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                {activeChannel.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* QuasiTV On-Screen Display (OSD) Banner (Bottom) */}
      <div
        className={`absolute bottom-6 left-6 right-6 z-30 transition-all duration-300 transform ${
          showOSD && !showGuide ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-2xl backdrop-blur-md p-5 flex flex-col sm:flex-row gap-5">
          {/* Channel Logo / Number Badge */}
          <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 sm:w-28 bg-slate-900/80 rounded-xl border border-slate-800 shrink-0 text-center">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {activeChannel?.number}
            </span>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-1">
              {activeChannel?.name}
            </span>
            <span className="text-[10px] text-slate-500">{activeChannel?.groupTitle}</span>
          </div>

          {/* Program Details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase tracking-wider border border-cyan-500/30">
                  Now Playing
                </span>
                {curProg?.seriesName && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[11px] uppercase tracking-wider border border-purple-500/40">
                    {curProg.seriesName}
                  </span>
                )}
                {(curProg?.seasonNumber != null || curProg?.episodeNumber != null) && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-900/60 text-indigo-300 font-mono border border-indigo-700 font-bold">
                    S{String(curProg.seasonNumber || 1).padStart(2, '0')}E{String(curProg.episodeNumber || 1).padStart(2, '0')}
                  </span>
                )}
                <h2 className="text-lg font-bold text-white truncate">
                  {curProg?.title || 'Continuous Playout'}
                </h2>
                {curProg?.year && (
                  <span className="text-xs text-slate-400">({curProg.year})</span>
                )}
                {curProg?.contentRating && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700">
                    {curProg.contentRating}
                  </span>
                )}
              </div>

              {/* Guide hint */}
              <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
                Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-bold">G</kbd> for Guide
              </span>
            </div>

            {curProg?.overview && (
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {curProg.overview}
              </p>
            )}

            {/* Playout Progress Bar */}
            {curProg && (
              <div className="space-y-1 pt-1">
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    className="bg-cyan-400 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${curProg.progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{formatSeconds(curProg.elapsedSeconds)}</span>
                  <span>{formatSeconds(curProg.duration)}</span>
                </div>
              </div>
            )}

            {/* Up Next */}
            {playoutState?.nextProgram && (
              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-500">Up Next:</span>
                {playoutState.nextProgram.seriesName && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950 text-purple-300 font-semibold border border-purple-800">
                    {playoutState.nextProgram.seriesName}
                  </span>
                )}
                {(playoutState.nextProgram.seasonNumber != null || playoutState.nextProgram.episodeNumber != null) && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-950 text-indigo-300 font-mono border border-indigo-800 font-bold">
                    S{String(playoutState.nextProgram.seasonNumber || 1).padStart(2, '0')}E{String(playoutState.nextProgram.episodeNumber || 1).padStart(2, '0')}
                  </span>
                )}
                <span className="text-slate-300 font-medium truncate">
                  {playoutState.nextProgram.title}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QuasiTV Full-Screen Interactive Cable Guide Grid */}
      {showGuide && (
        <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex flex-col p-6 sm:p-10 space-y-6">
          {/* Guide Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center text-slate-950 font-bold">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-wider">MagicTV Cable Guide</h1>
                <p className="text-xs text-slate-400">
                  Use Arrow Keys to navigate channels • Press Enter to watch • Press Esc to close
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Close Guide (Esc)
            </button>
          </div>

          {/* Guide Body */}
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            {/* Channel List (Vertical) */}
            <div className="w-full md:w-80 overflow-y-auto space-y-2 pr-2">
              {channels.map((ch, idx) => {
                const isFocused = idx === focusedGuideChannelIndex;
                const isCurrent = idx === activeChannelIndex;
                return (
                  <div
                    key={ch.id}
                    onClick={() => {
                      setFocusedGuideChannelIndex(idx);
                      setActiveChannelIndex(idx);
                      setShowGuide(false);
                    }}
                    onMouseEnter={() => setFocusedGuideChannelIndex(idx)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isFocused
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-lg shadow-cyan-500/20 scale-[1.02]'
                        : isCurrent
                        ? 'bg-slate-900 border-cyan-800 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold font-mono shrink-0 ${
                          isFocused
                            ? 'bg-slate-950 text-cyan-400'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                        }`}
                      >
                        {ch.number}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{ch.name}</div>
                        <div className={`text-[11px] truncate ${isFocused ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                          {ch.currentProgram?.title || 'Movie Channel'}
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold bg-slate-950 text-cyan-400 border border-cyan-800 shrink-0">
                        Live
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Focused Channel Program Preview Card */}
            <div className="flex-1 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between overflow-y-auto">
              {focusedChannel?.currentProgram ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {focusedChannel.currentProgram.posterUrl && (
                      <img
                        src={
                          focusedChannel.currentProgram.posterUrl.startsWith('http')
                            ? focusedChannel.currentProgram.posterUrl
                            : `/api/proxy/image?mediaId=${focusedChannel.currentProgram.mediaItemId}`
                        }
                        alt=""
                        className="w-24 h-36 object-cover rounded-xl border border-slate-800 shadow-lg shrink-0"
                      />
                    )}
                    <div>
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Now Airing on Ch. {focusedChannel.number}
                      </span>
                      <h2 className="text-2xl font-black text-white mt-1">
                        {focusedChannel.currentProgram.title}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        {focusedChannel.currentProgram.year && <span>{focusedChannel.currentProgram.year}</span>}
                        {focusedChannel.currentProgram.contentRating && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {focusedChannel.currentProgram.contentRating}
                          </span>
                        )}
                        <span className="font-mono">
                          {Math.round(focusedChannel.currentProgram.duration / 60)} min
                        </span>
                      </div>

                      {focusedChannel.currentProgram.genres && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {focusedChannel.currentProgram.genres.map(g => (
                            <span key={g} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                    {focusedChannel.currentProgram.overview || 'Continuous movie broadcasting.'}
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setActiveChannelIndex(focusedGuideChannelIndex);
                        setShowGuide(false);
                      }}
                      className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 text-sm transition-all flex items-center gap-2"
                    >
                      <span>Tune In to Channel {focusedChannel.number}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500">
                  <Tv className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                  <p className="text-lg font-bold text-slate-400">Select a channel to preview</p>
                </div>
              )}

              {/* Navigation instructions footer */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>[▲ / ▼] Change Channel</span>
                <span>[Enter] Tune In</span>
                <span>[Esc / G] Close Guide</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
