import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/admin/Dashboard';
import { ChannelsManager } from './pages/admin/ChannelsManager';
import { ScheduleGrid } from './pages/admin/ScheduleGrid';
import { MediaServers } from './pages/admin/MediaServers';
import { MediaLibrary } from './pages/admin/MediaLibrary';
import { SetupGuide } from './pages/admin/SetupGuide';
import { TVPlayer } from './pages/tv/TVPlayer';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeTVChannelNumber, setActiveTVChannelNumber] = useState<number>(1);

  const handleLaunchTV = (channelNumber?: number) => {
    if (channelNumber) {
      setActiveTVChannelNumber(channelNumber);
    }
    setCurrentTab('tv');
  };

  if (currentTab === 'tv') {
    return (
      <TVPlayer
        initialChannelNumber={activeTVChannelNumber}
        onExit={() => setCurrentTab('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        {currentTab === 'dashboard' && (
          <Dashboard
            onSelectChannel={ch => handleLaunchTV(ch.number)}
            onLaunchTV={handleLaunchTV}
            onOpenGuide={() => setCurrentTab('guide')}
          />
        )}
        {currentTab === 'channels' && (
          <ChannelsManager onLaunchTV={handleLaunchTV} />
        )}
        {currentTab === 'schedule' && <ScheduleGrid />}
        {currentTab === 'servers' && <MediaServers />}
        {currentTab === 'media' && <MediaLibrary />}
        {currentTab === 'guide' && <SetupGuide onLaunchTV={handleLaunchTV} />}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        MagicTV • Pseudo-Live Movie Channels Playout Server for Plex & Jellyfin
      </footer>
    </div>
  );
};
