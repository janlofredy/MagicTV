import React, { useState, useEffect } from 'react';
import { Film, Search, Star, Clock } from 'lucide-react';
import { MediaItem } from '../../types';

export const MediaLibrary: React.FC = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/media/genres')
      .then(res => res.json())
      .then(setGenres)
      .catch(console.error);
  }, []);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedGenre) params.set('genre', selectedGenre);
      params.set('limit', '40');

      const res = await fetch(`/api/media?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [selectedGenre]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMedia();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Film className="w-6 h-6 text-cyan-400" />
            <span>Movie Catalog</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse movies indexed from your Plex and Jellyfin media servers ({total} total).
          </p>
        </div>

        {/* Search & Genre filters */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search movies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-60"
            />
          </form>

          <select
            value={selectedGenre}
            onChange={e => setSelectedGenre(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Genres</option>
            {genres.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movies Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading catalog...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map(movie => {
          let movieGenres: string[] = [];
          try {
            movieGenres = JSON.parse(movie.genres || '[]');
          } catch {}

          return (
            <div
              key={movie.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col group hover:border-cyan-500/50 transition-all"
            >
              <div className="relative aspect-[2/3] bg-slate-950 overflow-hidden">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl.startsWith('http') ? movie.posterUrl : `/api/proxy/image?mediaId=${movie.id}`}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    No Poster
                  </div>
                )}

                {movie.rating && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] font-bold text-amber-400 flex items-center gap-1 border border-amber-500/30">
                    <Star className="w-3 h-3 fill-current" />
                    {movie.rating.toFixed(1)}
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs truncate group-hover:text-cyan-300" title={movie.title}>
                    {movie.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.duration && (
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="w-3 h-3" />
                        {Math.round(movie.duration / 60)}m
                      </span>
                    )}
                  </div>
                </div>

                {movieGenres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {movieGenres.slice(0, 2).map(g => (
                      <span key={g} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
