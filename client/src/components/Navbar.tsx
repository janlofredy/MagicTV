import React from 'react';
import { Tv, Sliders, Calendar, Database, PlaySquare, Radio, HelpCircle } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Tv },
    { id: 'channels', label: 'Channels', icon: Radio },
    { id: 'schedule', label: 'EPG Schedule', icon: Calendar },
    { id: 'servers', label: 'Media Servers', icon: Database },
    { id: 'media', label: 'Movie Library', icon: Sliders },
    { id: 'guide', label: 'Setup Guide', icon: HelpCircle },
  ];

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                Magic<span className="text-cyan-400">TV</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">
                IPTV Server
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action: Launch 10-Foot TV Mode */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentTab('tv')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlaySquare className="w-4 h-4" />
              <span>Launch 10ft TV</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
