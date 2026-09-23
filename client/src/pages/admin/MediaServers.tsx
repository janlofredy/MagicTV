import React, { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Server, HardDrive } from 'lucide-react';
import { MediaServer } from '../../types';

export const MediaServers: React.FC = () => {
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'plex' | 'jellyfin'>('plex');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) setServers(await res.json());
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url, token, userId: userId || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Connected successfully to ${data.serverName || 'Server'} (v${data.version || ''})`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          url,
          token,
          userId: userId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save server');
      }

      setIsAddOpen(false);
      setName('');
      setUrl('');
      setToken('');
      setUserId('');
      setTestResult(null);
      await fetchServers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/servers/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchServers();
      } else {
        alert(`Sync error: ${data.error}`);
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete media server "${name}"? Cached items will be removed.`)) return;
    try {
      await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      await fetchServers();
    } catch (err) {
      console.error('Failed to delete server:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-cyan-400" />
            <span>Media Servers</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your Plex and Jellyfin media libraries to populate channels and metadata.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Server</span>
        </button>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {servers.map(server => (
          <div
            key={server.id}
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    server.type === 'plex'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : server.type === 'jellyfin'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {server.type === 'plex' ? 'PLEX' : server.type === 'jellyfin' ? 'JELLY' : 'DEMO'}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{server.name}</h3>
                  <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{server.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(server.id)}
                  disabled={syncingId === server.id}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
                  title="Sync Library"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingId === server.id ? 'animate-spin text-cyan-400' : ''}`} />
                </button>

                {server.type !== 'demo' && (
                  <button
                    onClick={() => handleDelete(server.id, server.name)}
                    className="p-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-all"
                    title="Delete Server"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Indexed Movies: <strong className="text-white">{server._count?.mediaItems || 0}</strong></span>
              <span>
                {server.lastSyncAt
                  ? `Synced ${new Date(server.lastSyncAt).toLocaleTimeString()}`
                  : 'Never synced'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Connect Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              <span>Connect Media Server</span>
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Server Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('plex')}
                    className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                      type === 'plex'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Plex Media Server
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('jellyfin')}
                    className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                      type === 'jellyfin'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Jellyfin / Emby
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Friendly Server Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Living Room Plex"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Server URL</label>
                <input
                  type="url"
                  required
                  placeholder={type === 'plex' ? 'http://192.168.1.100:32400' : 'http://192.168.1.100:8096'}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {type === 'plex' ? 'Plex Token (X-Plex-Token)' : 'API Key or User Token'}
                </label>
                <input
                  type="password"
                  required
                  placeholder={type === 'plex' ? 'e.g. aB12cD34eF56' : 'e.g. 7f8a3c...'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {type === 'jellyfin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">User ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="Optional Jellyfin User UUID"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              )}

              {/* Test Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !url || !token}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                  <span>{testing ? 'Testing Connection...' : 'Test Connection'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="border-t border-slate-800 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm shadow-md"
                >
                  {saving ? 'Saving...' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
