import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { Channel } from '../../types';

interface ChannelEditorModalProps {
  channel: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ChannelEditorModal: React.FC<ChannelEditorModalProps> = ({
  channel,
  onClose,
  onSaved,
}) => {
  const [number, setNumber] = useState(channel ? channel.number : 1);
  const [name, setName] = useState(channel ? channel.name : '');
  const [description, setDescription] = useState(channel?.description || '');
  const [groupTitle, setGroupTitle] = useState(channel?.groupTitle || 'Movies');
  const [mode, setMode] = useState<'continuous' | 'slotted'>(channel?.mode || 'continuous');
  const [slotDuration, setSlotDuration] = useState(channel?.slotDuration || 120);
  const [shuffle, setShuffle] = useState(channel ? channel.shuffle : true);

  // Smart Rules
  const initialRules = channel?.rules ? JSON.parse(channel.rules) : {};
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialRules.genres || []);
  const [minYear, setMinYear] = useState<string>(initialRules.minYear ? String(initialRules.minYear) : '');
  const [maxYear, setMaxYear] = useState<string>(initialRules.maxYear ? String(initialRules.maxYear) : '');
  const [minRating, setMinRating] = useState<string>(initialRules.minRating ? String(initialRules.minRating) : '');
  const [sortBy, setSortBy] = useState<string>(initialRules.sortBy || 'random');

  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/media/genres')
      .then(res => res.json())
      .then(genres => setAvailableGenres(genres))
      .catch(console.error);
  }, []);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const rulesObj: any = {
      sortBy,
    };
    if (selectedGenres.length > 0) rulesObj.genres = selectedGenres;
    if (minYear) rulesObj.minYear = parseInt(minYear, 10);
    if (maxYear) rulesObj.maxYear = parseInt(maxYear, 10);
    if (minRating) rulesObj.minRating = parseFloat(minRating);

    const payload = {
      number: Number(number),
      name,
      description,
      groupTitle,
      mode,
      slotDuration: Number(slotDuration),
      shuffle,
      rules: JSON.stringify(rulesObj),
      enabled: true,
    };

    try {
      const url = channel ? `/api/channels/${channel.id}` : '/api/channels';
      const method = channel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save channel');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>{channel ? `Edit Channel #${channel.number}` : 'Create New Movie Channel'}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Channel Number</label>
              <input
                type="number"
                min="1"
                required
                value={number}
                onChange={e => setNumber(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Channel Name</label>
              <input
                type="text"
                required
                placeholder="e.g. 80s Action Cinema"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Category / Group Title</label>
              <input
                type="text"
                value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
                placeholder="e.g. Movies, Sci-Fi, Classics"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Playout Timing Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="continuous">Continuous (Back-to-Back)</option>
                <option value="slotted">Time-Slotted Grid (Top-of-Hour)</option>
              </select>
            </div>
          </div>

          {mode === 'slotted' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Slot Length (Minutes)
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={slotDuration}
                onChange={e => setSlotDuration(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Movies align to recurring slots (e.g. every 120 mins). Shorter movies feature an intermission screen until the next slot.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description (Optional)</label>
            <input
              type="text"
              placeholder="Brief overview of what airs on this channel..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Smart Rules Section */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
              Smart Channel Rules & Filters
            </h3>

            {/* Genre Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Match Genres</label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                {availableGenres.map(g => {
                  const isSelected = selectedGenres.includes(g);
                  return (
                    <button
                      type="button"
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {g}
                    </button>
                  );
                })}
                {availableGenres.length === 0 && (
                  <span className="text-xs text-slate-500 p-1">No genres indexed yet.</span>
                )}
              </div>
            </div>

            {/* Year & Rating Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Min Release Year</label>
                <input
                  type="number"
                  placeholder="e.g. 1980"
                  value={minYear}
                  onChange={e => setMinYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Max Release Year</label>
                <input
                  type="number"
                  placeholder="e.g. 1989"
                  value={maxYear}
                  onChange={e => setMaxYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Min Rating (0 - 10)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="e.g. 7.5"
                  value={minRating}
                  onChange={e => setMinRating(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            {/* Sort Order & Shuffle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Schedule Order</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="random">Shuffle / Random</option>
                  <option value="year_asc">Chronological (Oldest First)</option>
                  <option value="year_desc">Reverse Chronological (Newest First)</option>
                  <option value="title">Alphabetical (Title A-Z)</option>
                  <option value="rating">Highest Rated First</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="shuffleToggle"
                  checked={shuffle}
                  onChange={e => setShuffle(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-800 focus:ring-cyan-500"
                />
                <label htmlFor="shuffleToggle" className="text-xs text-slate-300 select-none cursor-pointer">
                  Shuffle playout sequence automatically
                </label>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm shadow-md transition-all"
            >
              {saving ? 'Saving...' : channel ? 'Update Channel' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
