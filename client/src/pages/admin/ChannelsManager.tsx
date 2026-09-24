import React, { useState, useEffect } from 'react';
import { Plus, Radio, RefreshCw, Trash2, Edit, Play, Shuffle, Layers, Sparkles, Tv, Film } from 'lucide-react';
import { Channel } from '../../types';
import { ChannelEditorModal } from './ChannelEditorModal';

interface ChannelsManagerProps {
  onLaunchTV: (channelNumber: number) => void;
}

export const ChannelsManager: React.FC<ChannelsManagerProps> = ({ onLaunchTV }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        setChannels(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreate = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setIsModalOpen(true);
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setGenerateMsg(null);
    try {
      const res = await fetch('/api/channels/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createMixedBlockChannels: true,
          createSeriesChannels: true,
          createLibraryChannels: true,
          createGenreChannels: true,
          createStudioChannels: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGenerateMsg(`Created ${data.createdCount} channels automatically!`);
        await fetchChannels();
        setTimeout(() => setGenerateMsg(null), 5000);
      } else {
        const err = await res.json();
        setGenerateMsg(`Failed: ${err.error}`);
      }
    } catch (err: any) {
      setGenerateMsg(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      await fetchChannels();
    } catch (err) {
      console.error('Failed to delete channel:', err);
    }
  };

  const handleRefreshSchedule = async (id: string) => {
    setRefreshingId(id);
    try {
      await fetch(`/api/channels/${id}/refresh-schedule`, { method: 'POST' });
      await fetchChannels();
    } finally {
      setRefreshingId(null);
    }
  };

  // Extract unique groups
  const groups = ['All', ...Array.from(new Set(channels.map(c => c.groupTitle))).filter(Boolean)];
  const filteredChannels = selectedGroup === 'All'
    ? channels
    : channels.filter(c => c.groupTitle === selectedGroup);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-cyan-400" />
            <span>Channel Lineup</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure movie & TV series channels, rules, scheduling formats, and custom lineups.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
            title="Automatically generate channels for TV series, libraries, top genres and studios like QuasiTV"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : 'Auto-Generate (QuasiTV)'}</span>
          </button>

          <button
            onClick={handleCreate}
            className="flex items-center space-x-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Channel</span>
          </button>
        </div>
      </div>

      {generateMsg && (
        <div className="p-3 bg-purple-950/60 border border-purple-800 text-purple-200 text-sm rounded-xl flex items-center justify-between">
          <span>{generateMsg}</span>
          <button onClick={() => setGenerateMsg(null)} className="text-purple-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Filter Tabs */}
      {groups.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedGroup === g
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Channel Grid / List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-800/80">
          {filteredChannels.map(channel => (
            <div
              key={channel.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
            >
              {/* Channel Info */}
              <div className="flex items-start sm:items-center space-x-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-300 font-extrabold text-lg shrink-0">
                  {channel.number}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-white text-base truncate">{channel.name}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {channel.groupTitle}
                    </span>
                    {channel.type === 'series' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                        <Tv className="w-3 h-3" /> TV Series
                      </span>
                    )}
                    {channel.type === 'movie' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 flex items-center gap-1">
                        <Film className="w-3 h-3" /> Movies
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-800/40 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {channel.mode === 'slotted' ? `${channel.slotDuration}m Time-Slotted` : 'Continuous'}
                    </span>
                    {channel.playMode === 'sequential' ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                        Sequential (S01E01 → ...)
                      </span>
                    ) : channel.shuffle ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 flex items-center gap-1">
                        <Shuffle className="w-3 h-3" /> Shuffle
                      </span>
                    ) : null}
                  </div>

                  {channel.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{channel.description}</p>
                  )}

                  {channel.currentProgram && (
                    <div className="mt-2 text-xs text-slate-300 flex items-center gap-1.5">
                      <span className="text-cyan-400 font-semibold">On Air:</span>
                      <span className="font-medium text-white">{channel.currentProgram.title}</span>
                      <span className="text-slate-500">({channel.currentProgram.progressPercentage}%)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => onLaunchTV(channel.number)}
                  className="p-2 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 rounded-lg border border-slate-700 transition-all"
                  title="Watch Channel in TV Player"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={() => handleRefreshSchedule(channel.id)}
                  disabled={refreshingId === channel.id}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
                  title="Force Regenerate Schedule"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingId === channel.id ? 'animate-spin text-cyan-400' : ''}`} />
                </button>

                <button
                  onClick={() => handleEdit(channel)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
                  title="Edit Rules & Settings"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(channel.id, channel.name)}
                  className="p-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-all"
                  title="Delete Channel"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {channels.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Radio className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-semibold text-slate-400">No channels created yet</p>
              <p className="text-xs text-slate-500 mt-1">Create your first smart channel to start streaming.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <ChannelEditorModal
          channel={editingChannel}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            fetchChannels();
          }}
        />
      )}
    </div>
  );
};
