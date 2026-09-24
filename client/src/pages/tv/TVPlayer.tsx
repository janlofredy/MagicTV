import React, { useState, useEffect, useRef } from 'react';
import { Channel } from '../../types.js';
import Hls from 'hls.js';
import { ArrowLeft, Tv, Clock, Radio, Sparkles, Volume2, VolumeX, RotateCcw, FastForward, Play, Pause, Sliders, Settings } from 'lucide-react';

interface TVPlayerProps {
  initialChannelNumber?: number;
  onExit: () => void;
}

interface GuideProgramItem {
  id: string;
  channelId: string;
  mediaItemId: string;
  title: string;
  type?: 'movie' | 'episode';
  seriesName?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  overview?: string | null;
  year?: number | null;
  rating?: number | null;
  contentRating?: string | null;
  posterUrl?: string | null;
  genres: string[];
  startTime: string;
  endTime: string;
  duration: number;
}

interface GuideChannelData {
  channel: Channel;
  programs: GuideProgramItem[];
}

export const TVPlayer: React.FC<TVPlayerProps> = ({ initialChannelNumber = 1, onExit }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelIndex, setActiveChannelIndex] = useState(0);
  const [showOSD, setShowOSD] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedQuality, setSelectedQuality] = useState<'auto' | '1080p' | '720p' | '480p' | '360p'>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const activeProgramIdRef = useRef<string | null>(null);
  const [playoutState, setPlayoutState] = useState<any>(null);
  const [channelInputDigits, setChannelInputDigits] = useState('');

  // Guide Grid State
  const [guideData, setGuideData] = useState<GuideChannelData[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideFocusedRow, setGuideFocusedRow] = useState(0); // channel index in guide
  const [guideFocusedCol, setGuideFocusedCol] = useState(0); // program index in that channel
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const osdTimerRef = useRef<any>(null);
  const digitTimerRef = useRef<any>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const programRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  // Tracks the movie-position offset (in seconds) at which the current HLS stream was loaded.
  // The HLS stream's time 0 corresponds to this position in the movie.
  const loadedOffsetRef = useRef<number>(0);

  const activeChannel = channels[activeChannelIndex];

  // Keep a running clock for EPG timeline red line
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all channels
  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (data.length > 0) {
          const foundIdx = data.findIndex(c => c.number === initialChannelNumber);
          const defaultIdx = foundIdx >= 0 ? foundIdx : 0;
          setActiveChannelIndex(defaultIdx);
          setGuideFocusedRow(defaultIdx);
        }
      })
      .catch(console.error);
  }, [initialChannelNumber]);

  // Fetch guide timeline data whenever guide opens or active channel changes
  const fetchGuideData = async () => {
    try {
      setGuideLoading(true);
      const res = await fetch('/api/channels/guide?hours=4');
      if (res.ok) {
        const json = await res.json();
        setGuideData(json.channels || []);
      }
    } catch (e) {
      console.error('Failed to load guide data:', e);
    } finally {
      setGuideLoading(false);
    }
  };

  useEffect(() => {
    if (showGuide) {
      fetchGuideData();
    }
  }, [showGuide]);

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

  // Track current video playhead time & duration for scrubber
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setVideoDuration(video.duration || 0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // When the current video ends naturally, transition to the latest live playout program!
    const handleEnded = () => {
      console.log('[TVPlayer] Video item ended naturally. Loading next program...');
      setIsLiveMode(true);
      activeProgramIdRef.current = null;
      // Force reload stream for current channel
      if (activeChannel) {
        loadStream(activeChannel.number);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [activeChannel]);

  // Synchronize playback position with live broadcast offset ONLY when in Live TV mode.
  // The HLS stream starts at loadedOffsetRef.current, so video.currentTime=0 already
  // corresponds to elapsedSeconds at load time. We only correct for drift > 30s.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playoutState?.currentProgram || !isLiveMode) return;

    const prog = playoutState.currentProgram;
    if (!activeProgramIdRef.current) {
      activeProgramIdRef.current = prog.id;
    }

    // Expected HLS position = how much time has passed since we loaded the stream
    const expectedHlsTime = prog.elapsedSeconds - loadedOffsetRef.current;
    if (
      expectedHlsTime >= 0 &&
      video.readyState >= 1 &&
      video.duration > expectedHlsTime &&
      Math.abs(video.currentTime - expectedHlsTime) > 30
    ) {
      console.log(`[TVPlayer PlayoutSync] Drift ${(video.currentTime - expectedHlsTime).toFixed(0)}s — correcting to HLS time ${expectedHlsTime.toFixed(0)}s`);
      video.currentTime = expectedHlsTime;
    }
  }, [playoutState, isLiveMode]);

  const loadStream = async (channelNumber: number, customOffset?: number, quality: string = selectedQuality) => {
    const video = videoRef.current;
    if (!video) return;

    let targetOffset: number;
    if (customOffset !== undefined) {
      targetOffset = Math.max(0, customOffset);
    } else {
      // Live mode: fetch current playout offset to avoid desync
      try {
        const res = await fetch(`/api/channels/${channelNumber}/playout`);
        if (res.ok) {
          const state = await res.json();
          setPlayoutState(state);
          targetOffset = state?.currentProgram?.elapsedSeconds ?? 0;
        } else {
          targetOffset = playoutState?.currentProgram?.elapsedSeconds ?? 0;
        }
      } catch {
        targetOffset = playoutState?.currentProgram?.elapsedSeconds ?? 0;
      }
    }

    loadedOffsetRef.current = targetOffset;
    setVideoCurrentTime(0);

    const params = new URLSearchParams();
    if (customOffset !== undefined) {
      params.set('offset', String(Math.floor(targetOffset)));
    }
    if (quality && quality !== 'auto') {
      params.set('quality', quality);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const hlsUrl = `/channels/${channelNumber}/stream.m3u8${queryString}`;
    const directUrl = `/channels/${channelNumber}/stream${queryString}`;

    let started = false;
    const startPlayback = () => {
      if (started) return;
      started = true;
      video.play().catch(e => console.log('Autoplay prevented:', e));
    };

    video.addEventListener('loadedmetadata', startPlayback, { once: true });
    video.addEventListener('canplay', startPlayback, { once: true });

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        startPlayback();
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('HLS fatal error encountered, switching to direct stream:', data);
          hls.destroy();
          hlsRef.current = null;
          video.src = directUrl;
          startPlayback();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    } else {
      video.src = directUrl;
      video.play().catch(() => {});
    }
  };

  // Handle Video Stream Loading on channel change
  useEffect(() => {
    if (!activeChannel) return;

    // Reset scrubber / live mode on channel switch
    setIsLiveMode(true);
    activeProgramIdRef.current = null;

    loadStream(activeChannel.number);
    triggerOSD();

    return () => {
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
            setGuideFocusedRow(idx);
            setGuideFocusedCol(0);
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
        toggleMute();
        return;
      }

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        restartFromBeginning();
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        jumpToLive();
        return;
      }

      if (e.key === 'ArrowLeft' && !showGuide) {
        // Seek backward 10s if Shift is held or in OSD, otherwise open Guide
        if (e.shiftKey || showOSD) {
          e.preventDefault();
          seekDelta(-15);
          return;
        } else {
          e.preventDefault();
          setShowGuide(true);
          return;
        }
      }

      if (e.key === 'ArrowRight' && !showGuide) {
        // Seek forward 15s if Shift is held or in OSD
        if (e.shiftKey || showOSD) {
          e.preventDefault();
          seekDelta(15);
          return;
        } else {
          e.preventDefault();
          triggerOSD();
          return;
        }
      }

      if (e.key === '[' || e.key === 'j') {
        e.preventDefault();
        seekDelta(-15);
        return;
      }

      if (e.key === ']' || e.key === 'l') {
        e.preventDefault();
        seekDelta(15);
        return;
      }

      if (showGuide) {
        // Guide Grid Navigation
        const currentRow = guideData[guideFocusedRow];
        const programs = currentRow?.programs || [];

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setGuideFocusedRow(prev => {
            const nextRow = prev > 0 ? prev - 1 : guideData.length - 1;
            setGuideFocusedCol(0);
            return nextRow;
          });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setGuideFocusedRow(prev => {
            const nextRow = prev < guideData.length - 1 ? prev + 1 : 0;
            setGuideFocusedCol(0);
            return nextRow;
          });
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setGuideFocusedCol(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setGuideFocusedCol(prev => Math.min(programs.length - 1, prev + 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (guideData[guideFocusedRow]) {
            const selectedChannel = guideData[guideFocusedRow].channel;
            const chIdx = channels.findIndex(c => c.id === selectedChannel.id);
            if (chIdx >= 0) {
              setActiveChannelIndex(chIdx);
            }
          }
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
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerOSD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, guideFocusedRow, guideFocusedCol, guideData, channels, channelInputDigits, isMuted, showOSD, isLiveMode]);

  // Player controls: Unmute, Play/Pause, Seek, Restart, Jump to Live
  const unmuteAndPlay = () => {
    setIsMuted(false);
    setShowUnmutePrompt(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      if (!next) setShowUnmutePrompt(false);
      return next;
    });
    triggerOSD();
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    triggerOSD();
  };

  const seekDelta = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    setIsLiveMode(false);
    const targetTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    
    // If seeking backwards close to 0 or target is out of current media range, reload from backend
    if (targetTime < 3 && activeChannel) {
      restartFromBeginning();
      return;
    }

    video.currentTime = targetTime;
    setVideoCurrentTime(targetTime);
    triggerOSD();
  };

  const restartFromBeginning = () => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    setIsLiveMode(false);
    console.log('[TVPlayer] Restarting current program from beginning (0s)');
    
    // Always reload stream at offset 0 so browser receives whole media from 0:00
    loadStream(activeChannel.number, 0, selectedQuality);
    triggerOSD();
  };

  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video || !playoutState?.currentProgram || !activeChannel) return;
    setIsLiveMode(true);
    console.log('[TVPlayer] Jumping to live broadcast position');
    // Reload live stream to sync with server playout
    loadStream(activeChannel.number, undefined, selectedQuality);
    triggerOSD();
  };

  const handleQualityChange = (newQuality: 'auto' | '1080p' | '720p' | '480p' | '360p') => {
    setSelectedQuality(newQuality);
    setShowQualityMenu(false);
    if (!activeChannel) return;
    
    const currentPos = videoRef.current?.currentTime;
    console.log(`[TVPlayer] Switching quality to ${newQuality} at position ${currentPos?.toFixed(1)}s`);
    
    if (isLiveMode) {
      loadStream(activeChannel.number, undefined, newQuality);
    } else {
      const moviePos = loadedOffsetRef.current + (currentPos || 0);
      loadStream(activeChannel.number, moviePos, newQuality);
    }
    triggerOSD();
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Scrubber operates in movie-position space (0 → full movie duration)
    const moviePos = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    setIsLiveMode(false);
    // Store as HLS-relative time for internal consistency
    setVideoCurrentTime(Math.max(0, moviePos - loadedOffsetRef.current));
  };

  const handleScrubberCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const moviePos = parseFloat((e.currentTarget as HTMLInputElement).value);
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    setIsLiveMode(false);

    // Convert movie position to HLS-relative time
    const hlsTime = moviePos - loadedOffsetRef.current;

    // Seeking before the HLS stream start → reload from the target position
    if (hlsTime < 0 || moviePos <= 5) {
      loadStream(activeChannel.number, Math.max(0, moviePos), selectedQuality);
      return;
    }

    try {
      video.currentTime = hlsTime;
      setVideoCurrentTime(hlsTime);
    } catch {
      loadStream(activeChannel.number, moviePos, selectedQuality);
    }
    triggerOSD();
  };

  // Keep focused program visible in guide scroll
  useEffect(() => {
    if (showGuide) {
      const activeEl = programRefs.current[`${guideFocusedRow}-${guideFocusedCol}`];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [guideFocusedRow, guideFocusedCol, showGuide]);

  const formatSeconds = (sec?: number) => {
    const total = Math.max(0, Math.floor(sec ?? 0));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatClockTime = (dateInput: string | Date) => {
    const d = new Date(dateInput);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const curProg = playoutState?.currentProgram;

  // Timeline slots generation for QuasiTV Grid Header (30-min intervals)
  // Window: 30 mins ago to 3.5 hours from now = 4 hours total = 8 intervals of 30 mins
  const timelineIntervals: Date[] = [];
  const startSlot = new Date(currentTime);
  startSlot.setMinutes(Math.floor(startSlot.getMinutes() / 30) * 30, 0, 0); // snap to last 30 min mark
  const windowStartTime = new Date(startSlot.getTime() - 30 * 60 * 1000); // 1 slot prior
  for (let i = 0; i < 8; i++) {
    timelineIntervals.push(new Date(windowStartTime.getTime() + i * 30 * 60 * 1000));
  }

  // Pixels per minute scaling factor (e.g., 30 mins = 220px, so 1 min = 7.33px)
  const PIXELS_PER_MINUTE = 7.5;
  const PIXELS_PER_30_MIN = 30 * PIXELS_PER_MINUTE; // 225px

  // Calculate live red vertical line offset
  const timelineStartMs = windowStartTime.getTime();
  const currentElapsedMinutes = Math.max(0, (currentTime.getTime() - timelineStartMs) / (60 * 1000));
  const liveIndicatorLeftPx = currentElapsedMinutes * PIXELS_PER_MINUTE;

  const currentFocusedData = guideData[guideFocusedRow];
  const focusedProgram = currentFocusedData?.programs?.[guideFocusedCol] || currentFocusedData?.channel.currentProgram;

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
        onClick={triggerOSD}
        className="w-full h-full object-contain bg-black"
      />

      {/* Prominent Tap to Unmute Overlay */}
      {isMuted && showUnmutePrompt && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 animate-bounce">
          <button
            onClick={unmuteAndPlay}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-2xl shadow-cyan-500/50 backdrop-blur transition-all"
          >
            <VolumeX className="w-5 h-5 text-slate-950 animate-pulse" />
            <span>Click or Press [M] to Unmute</span>
          </button>
        </div>
      )}

      {/* Top Floating Station Bug & Exit Button */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-30 pointer-events-none">
        <button
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white backdrop-blur transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Exit TV</span>
        </button>

        <div className="flex items-center gap-3">
          {channelInputDigits && (
            <div className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-black text-2xl font-mono shadow-2xl animate-pulse">
              {channelInputDigits}
            </div>
          )}

          {/* Volume Mute Toggle Badge */}
          <button
            onClick={toggleMute}
            className={`pointer-events-auto px-3.5 py-1.5 rounded-xl border backdrop-blur flex items-center gap-2 transition-all text-xs font-bold shadow-lg ${
              isMuted
                ? 'bg-red-950/80 hover:bg-red-900 border-red-500/50 text-red-200 animate-pulse'
                : 'bg-slate-950/70 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title={isMuted ? 'Muted — Click or press [M] to Unmute' : 'Audio Active — Click or press [M] to Mute'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-red-400" />
                <span className="text-red-300">MUTED</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Audio</span>
              </>
            )}
          </button>

          {activeChannel && (
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 backdrop-blur flex items-center gap-2.5">
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

      {/* Bottom OSD Banner (When Guide is hidden) */}
      <div
        className={`absolute bottom-6 left-6 right-6 z-30 transition-all duration-300 transform ${
          showOSD && !showGuide ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-2xl backdrop-blur-md p-5 flex flex-col sm:flex-row gap-5">
          <div className="flex sm:flex-col items-center justify-between sm:justify-center p-3 sm:w-28 bg-slate-900/80 rounded-xl border border-slate-800 shrink-0 text-center">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {activeChannel?.number}
            </span>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-1">
              {activeChannel?.name}
            </span>
            <span className="text-[10px] text-slate-500">{activeChannel?.groupTitle}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider border ${
                  isLiveMode 
                    ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isLiveMode ? '● LIVE TV' : '⟲ WATCHING REPLAY'}
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

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-bold">G</kbd> for Guide
                </span>
              </div>
            </div>

            {curProg?.overview && (
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {curProg.overview}
              </p>
            )}

            {/* Interactive Timeline Scrubber & Quick Actions */}
            <div className="space-y-1.5 pt-2">
              <div className="relative flex items-center group">
                <input
                  type="range"
                  min={0}
                  max={curProg?.duration || (loadedOffsetRef.current + videoDuration) || 100}
                  value={loadedOffsetRef.current + videoCurrentTime}
                  onChange={handleScrubberChange}
                  onMouseUp={handleScrubberCommit}
                  onTouchEnd={handleScrubberCommit}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <span>{formatSeconds(loadedOffsetRef.current + videoCurrentTime)}</span>
                  <span>/</span>
                  <span>{formatSeconds(curProg?.duration || loadedOffsetRef.current + videoDuration)}</span>
                </div>

                {/* Scrubber Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={togglePlayPause}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-semibold"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                    )}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    onClick={() => seekDelta(-15)}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-[11px]"
                    title="Rewind 15s ([ / Shift+◄)"
                  >
                    -15s
                  </button>

                  <button
                    onClick={() => seekDelta(15)}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-[11px]"
                    title="Forward 15s (] / Shift+►)"
                  >
                    +15s
                  </button>

                  {/* Quality Selector Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowQualityMenu(prev => !prev); setShowSettingsMenu(false); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-semibold"
                      title="Select Streaming Quality"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{selectedQuality === 'auto' ? 'Auto Quality' : selectedQuality}</span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl p-1.5 z-50 backdrop-blur space-y-1">
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          Video Quality
                        </div>
                        {[
                          { id: 'auto', label: 'Auto (Original)' },
                          { id: '1080p', label: '1080p (4 Mbps)' },
                          { id: '720p', label: '720p (2 Mbps)' },
                          { id: '480p', label: '480p (1 Mbps)' },
                          { id: '360p', label: '360p (0.6 Mbps)' },
                        ].map(q => (
                          <button
                            key={q.id}
                            onClick={() => handleQualityChange(q.id as any)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                              selectedQuality === q.id
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{q.label}</span>
                            {selectedQuality === q.id && <span className="text-cyan-400 text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ⚙ Settings — Watch from Start & Jump to Live */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowSettingsMenu(prev => !prev); setShowQualityMenu(false); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all text-[11px] font-semibold ${
                        showSettingsMenu
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title="More options"
                    >
                      <Settings className="w-3.5 h-3.5 text-cyan-400" />
                    </button>

                    {showSettingsMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl p-1.5 z-50 backdrop-blur space-y-1">
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          Playback
                        </div>

                        <button
                          onClick={() => { restartFromBeginning(); setShowSettingsMenu(false); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          title="Watch from Start (R)"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Watch from Start</span>
                          <kbd className="ml-auto px-1 py-0.5 bg-slate-800 rounded text-[9px] text-slate-400 border border-slate-700">R</kbd>
                        </button>

                        <button
                          onClick={() => { jumpToLive(); setShowSettingsMenu(false); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                            !isLiveMode
                              ? 'text-red-300 hover:bg-red-950 hover:text-white font-semibold'
                              : 'text-slate-500 cursor-not-allowed opacity-50'
                          }`}
                          title="Jump to Live (L)"
                          disabled={isLiveMode}
                        >
                          <FastForward className="w-3.5 h-3.5 shrink-0" />
                          <span>Jump to Live</span>
                          {!isLiveMode && <kbd className="ml-auto px-1 py-0.5 bg-slate-800 rounded text-[9px] text-slate-400 border border-slate-700">L</kbd>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {playoutState?.nextProgram && (
              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-500">Up Next:</span>
                {playoutState.nextProgram.seriesName && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950 text-purple-300 font-semibold border border-purple-800">
                    {playoutState.nextProgram.seriesName}
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

      {/* OPTION 1: CLASSIC QUASITV / CABLE EPG TIMELINE GRID */}
      {showGuide && (
        <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex flex-col p-4 sm:p-8 space-y-4">
          {/* Top Bar: Title, Live Clock, and Guide Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-wider flex items-center gap-2">
                  <span>MagicTV Cable EPG</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-mono">
                    QuasiTV Grid
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  D-Pad [▲ ▼ ◄ ►] Browse Schedule • [Enter] Tune In • [G / Esc] Close
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cyan-400">
                <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>{formatClockTime(currentTime)}</span>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300"
              >
                Close (Esc)
              </button>
            </div>
          </div>

          {/* Focused Show Preview Header Banner */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 flex gap-4 min-h-[110px] items-center">
            {focusedProgram?.posterUrl && (
              <img
                src={
                  focusedProgram.posterUrl.startsWith('http')
                    ? focusedProgram.posterUrl
                    : `/api/proxy/image?mediaId=${focusedProgram.mediaItemId}`
                }
                alt=""
                className="w-16 h-24 object-cover rounded-lg border border-slate-800 shadow shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {currentFocusedData?.channel && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-xs font-extrabold border border-cyan-800">
                    Ch. {currentFocusedData.channel.number} • {currentFocusedData.channel.name}
                  </span>
                )}
                {focusedProgram?.seriesName && (
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-xs font-bold border border-purple-800">
                    {focusedProgram.seriesName}
                  </span>
                )}
                {(focusedProgram?.seasonNumber != null || focusedProgram?.episodeNumber != null) && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] bg-indigo-950 text-indigo-300 font-mono font-bold border border-indigo-800">
                    S{String(focusedProgram.seasonNumber || 1).padStart(2, '0')}E{String(focusedProgram.episodeNumber || 1).padStart(2, '0')}
                  </span>
                )}
                <span className="text-white font-black text-lg truncate">
                  {focusedProgram?.title || 'Continuous Playout'}
                </span>
                {focusedProgram?.year && (
                  <span className="text-xs text-slate-400">({focusedProgram.year})</span>
                )}
                {focusedProgram?.startTime && focusedProgram?.endTime && (
                  <span className="text-xs font-mono text-cyan-400 font-medium">
                    [{formatClockTime(focusedProgram.startTime)} - {formatClockTime(focusedProgram.endTime)}]
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {focusedProgram?.overview || 'Broadcast schedule managed by MagicTV Smart Automation.'}
              </p>
            </div>
            <div className="shrink-0 hidden md:block">
              <button
                onClick={() => {
                  if (currentFocusedData?.channel) {
                    const idx = channels.findIndex(c => c.id === currentFocusedData.channel.id);
                    if (idx >= 0) setActiveChannelIndex(idx);
                  }
                  setShowGuide(false);
                }}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-cyan-500/20"
              >
                Tune In (Enter)
              </button>
            </div>
          </div>

          {/* EPG Timeline Grid Container */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden">
            {/* Top Fixed Time Scale Header */}
            <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs font-mono text-slate-400 sticky top-0 z-20">
              {/* Channel Header Column */}
              <div className="w-56 sm:w-64 p-3 font-bold uppercase tracking-wider text-slate-400 shrink-0 border-r border-slate-800 flex items-center justify-between">
                <span>Channels ({guideData.length})</span>
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
              </div>

              {/* Time Slots (Scrollable along with grid) */}
              <div className="flex-1 overflow-hidden relative">
                <div className="flex relative" style={{ width: `${timelineIntervals.length * PIXELS_PER_30_MIN}px` }}>
                  {timelineIntervals.map((interval, i) => (
                    <div
                      key={i}
                      style={{ width: `${PIXELS_PER_30_MIN}px` }}
                      className="p-3 border-r border-slate-800 text-center font-bold text-slate-300 shrink-0 select-none"
                    >
                      {formatClockTime(interval)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Channels & Programs Rows (Vertical & Horizontal Scrollable Area) */}
            <div ref={gridContainerRef} className="flex-1 overflow-y-auto overflow-x-auto relative">
              {/* Vertical Live "Now" Indicator Line */}
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                style={{ left: `${224 + liveIndicatorLeftPx}px` }} // 224px channel column offset
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50 -mt-1" />
                <div className="w-0.5 flex-1 bg-red-500 shadow-lg shadow-red-500" />
              </div>

              {guideLoading && guideData.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <Sparkles className="w-8 h-8 mx-auto text-cyan-500 animate-spin mb-3" />
                  <p className="font-bold text-slate-300">Loading Electronic Program Guide...</p>
                </div>
              ) : (
                guideData.map((row, rowIdx) => {
                  const isCurrentActive = channels[activeChannelIndex]?.id === row.channel.id;
                  const isRowFocused = guideFocusedRow === rowIdx;

                  return (
                    <div
                      key={row.channel.id}
                      className={`flex border-b border-slate-800/80 transition-colors ${
                        isRowFocused ? 'bg-slate-900/60' : 'hover:bg-slate-900/30'
                      }`}
                    >
                      {/* Left Channel Card */}
                      <div
                        onClick={() => {
                          const idx = channels.findIndex(c => c.id === row.channel.id);
                          if (idx >= 0) setActiveChannelIndex(idx);
                          setShowGuide(false);
                        }}
                        className={`w-56 sm:w-64 p-3 shrink-0 border-r border-slate-800 flex items-center justify-between cursor-pointer sticky left-0 z-10 ${
                          isRowFocused
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg'
                            : isCurrentActive
                            ? 'bg-slate-900 border-r-cyan-500 text-white'
                            : 'bg-slate-950/95 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black font-mono shrink-0 ${
                              isRowFocused
                                ? 'bg-slate-950 text-cyan-400'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                            }`}
                          >
                            {row.channel.number}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-black truncate">{row.channel.name}</div>
                            <div className={`text-[10px] truncate ${isRowFocused ? 'text-slate-900' : 'text-slate-400'}`}>
                              {row.channel.groupTitle}
                            </div>
                          </div>
                        </div>

                        {isCurrentActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-950 text-cyan-400 border border-cyan-800 shrink-0">
                            Live
                          </span>
                        )}
                      </div>

                      {/* Right Programs Timeline Bar */}
                      <div className="flex-1 relative flex items-center h-14 overflow-hidden">
                        <div
                          className="flex h-full items-center relative"
                          style={{ width: `${timelineIntervals.length * PIXELS_PER_30_MIN}px` }}
                        >
                          {row.programs.length === 0 ? (
                            <div className="w-full px-4 text-xs text-slate-500 italic">
                              Continuous 24/7 Playout
                            </div>
                          ) : (
                            row.programs.map((prog, colIdx) => {
                              const durationMinutes = Math.max(15, prog.duration / 60);
                              const widthPx = Math.max(80, durationMinutes * PIXELS_PER_MINUTE);

                              const isColFocused = isRowFocused && guideFocusedCol === colIdx;

                              return (
                                <div
                                  key={prog.id}
                                  ref={el => {
                                    programRefs.current[`${rowIdx}-${colIdx}`] = el;
                                  }}
                                  onClick={() => {
                                    setGuideFocusedRow(rowIdx);
                                    setGuideFocusedCol(colIdx);
                                    const idx = channels.findIndex(c => c.id === row.channel.id);
                                    if (idx >= 0) setActiveChannelIndex(idx);
                                    setShowGuide(false);
                                  }}
                                  onMouseEnter={() => {
                                    setGuideFocusedRow(rowIdx);
                                    setGuideFocusedCol(colIdx);
                                  }}
                                  style={{
                                    width: `${widthPx}px`,
                                    minWidth: '80px',
                                  }}
                                  className={`h-11 my-1.5 mx-0.5 px-3 rounded-xl border flex flex-col justify-center cursor-pointer transition-all shrink-0 ${
                                    isColFocused
                                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold shadow-md shadow-cyan-500/30 scale-[1.01] z-10'
                                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                    {prog.seriesName && (
                                      <span className={`text-[10px] uppercase font-semibold ${isColFocused ? 'text-slate-950' : 'text-purple-400'}`}>
                                        {prog.seriesName} •
                                      </span>
                                    )}
                                    <span className="truncate">{prog.title}</span>
                                  </div>
                                  <div
                                    className={`text-[10px] font-mono flex items-center justify-between ${
                                      isColFocused ? 'text-slate-900 font-medium' : 'text-slate-400'
                                    }`}
                                  >
                                    <span>{formatClockTime(prog.startTime)}</span>
                                    <span>{Math.round(prog.duration / 60)}m</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

