import React, { useState } from 'react';
import { Check, Heart, Plus } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { addSongToPlaylist, createPlaylist, toggleLikeSong, useIsLiked } from '../services/library';
import { usePlaylists } from '../services/library';
import { Cover, EmptyState, Sheet, cn } from './ui';

export default function AddToPlaylistModal() {
  const { isAddToPlaylistOpen, setIsAddToPlaylistOpen, addTarget, currentTrack, showToast } = usePlayer();
  const track = addTarget || currentTrack;
  const playlists = usePlaylists();
  const liked = useIsLiked(track);
  const [name, setName] = useState('');
  const close = () => setIsAddToPlaylistOpen(false);
  if (!isAddToPlaylistOpen || !track) return null;

  const add = (pl) => {
    const r = addSongToPlaylist(pl.id, track);
    showToast(r === 'added' ? `Ditambahkan ke "${pl.name}"` : 'Sudah ada di playlist ini');
  };
  const create = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pl = createPlaylist(name.trim());
    addSongToPlaylist(pl.id, track);
    showToast(`Playlist "${pl.name}" dibuat`);
    setName('');
  };
  return (
    <Sheet open onClose={close} title="Tambahkan ke Playlist" z={215}>
      <div className="flex items-center gap-3 px-5 pb-3">
        <Cover track={track} className="h-11 w-11 rounded-lg" />
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{track.title}</div><div className="truncate text-xs text-fg/55">{track.artist}</div></div>
      </div>
      <form onSubmit={create} className="flex gap-2 px-5 pb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nama playlist baru" aria-label="Nama playlist baru"
          className="h-11 min-w-0 flex-1 rounded-full border border-fg/10 bg-fg/[0.06] px-4 text-sm outline-none placeholder:text-fg/40 focus:border-fg/40" />
        <button type="submit" disabled={!name.trim()} className="press grid h-11 w-11 place-items-center rounded-full bg-fg text-bg disabled:opacity-40" aria-label="Buat playlist"><Plus size={20} /></button>
      </form>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <button type="button" onClick={() => toggleLikeSong(track)} className="press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-fg/[0.06]">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-fg/10"><Heart size={18} className={cn(liked && 'fill-current')} /></span>
          <span className="flex-1 text-[14.5px] font-medium">Lagu Disukai</span>{liked && <Check size={17} className="text-emerald-400" />}
        </button>
        {playlists.length === 0 && <EmptyState title="Belum ada playlist" text="Buat playlist pertamamu di atas." className="py-6" />}
        {playlists.map((pl) => {
          const has = pl.songs.some((s) => (s.videoId || s.id) === (track.videoId || track.id));
          return (
            <button key={pl.id} type="button" onClick={() => add(pl)} className="press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-fg/[0.06]">
              <Cover src={pl.image || pl.songs[0]?.cover} className="h-11 w-11 rounded-lg" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{pl.name}</span><span className="block text-xs text-fg/50">{pl.songs.length} lagu</span></span>
              {has && <Check size={17} className="text-emerald-400" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
