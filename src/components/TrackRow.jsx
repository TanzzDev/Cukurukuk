import React from 'react';
import { Check, Heart, Info, ListPlus, ListStart, Lock, Play, Plus, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useIsLiked, toggleLikeSong } from '../services/library';
import { trackId } from '../../shared/queue';
import { ActionMenu, Cover, cn } from './ui';

/** Tombol tambah ke antrean yang mengikuti status: belum ada / sudah di antrean / antrean dikunci. */
export function AddQueueButton({ track, className = '', showLabel = false }) {
  const { isInQueue, isQueueLocked, addToQueue } = usePlayer();
  const inQueue = isInQueue(track);
  const state = inQueue ? 'in' : isQueueLocked ? 'locked' : 'idle';
  const label = { in: 'Sudah di Antrean', locked: 'Antrean dikunci', idle: 'Tambahkan ke Antrean' }[state];
  const Icon = { in: Check, locked: Lock, idle: Plus }[state];
  return (
    <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
      className={cn('press focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors',
        showLabel ? 'px-3.5' : 'w-9',
        state === 'in' ? 'bg-fg/10 text-emerald-400' : state === 'locked' ? 'bg-fg/5 text-fg/40' : 'bg-fg/10 text-fg hover:bg-fg hover:text-bg', className)}>
      <Icon key={state} size={17} className={state === 'in' ? 'pop-in' : ''} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

export function useTrackMenu(track) {
  const { playNow, playNextInQueue, addToQueue, openMix, setDetailTrack, openAddToPlaylist } = usePlayer();
  const liked = useIsLiked(track);
  return [
    { label: 'Putar Sekarang', icon: Play, onClick: () => playNow(track) },
    { label: 'Putar Berikutnya', icon: ListStart, onClick: () => playNextInQueue(track) },
    { label: 'Tambahkan ke Antrean', icon: ListPlus, onClick: () => addToQueue(track) },
    { label: 'Mix Antrean dari lagu ini', icon: Sparkles, onClick: () => openMix(track) },
    { label: 'Tambahkan ke Playlist', icon: Plus, onClick: () => openAddToPlaylist(track) },
    { label: liked ? 'Hapus dari Lagu Disukai' : 'Suka', icon: Heart, onClick: () => toggleLikeSong(track) },
    { label: 'Buka Detail Lagu', icon: Info, onClick: () => setDetailTrack(track) },
  ];
}

/** Baris lagu standar: Cari, Pustaka, Riwayat, Top 50. Seluruh tindakan memakai data lagu yang sama dengan player & antrean. */
export default function TrackRow({ track, index, rank, onPlay, right, showQueue = true, extraMenu = [], className = '', sub }) {
  const { currentTrack, isPlaying } = usePlayer();
  const active = currentTrack && trackId(currentTrack) === trackId(track);
  const menu = useTrackMenu(track);
  return (
    <div role="button" tabIndex={0} onClick={onPlay} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPlay?.())}
      className={cn('group focus-ring flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-fg/[0.06] md:gap-4 md:px-3', active && 'bg-fg/[0.07]', className)}>
      {(rank != null || index != null) && <span className="w-6 shrink-0 text-center text-sm tabular-nums text-fg/40">{rank ?? index + 1}</span>}
      <div className="relative shrink-0">
        <Cover track={track} className="h-12 w-12 rounded-lg md:h-14 md:w-14" />
        {active && (
          <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/55 text-white">
            <span className={cn('eq-bars flex h-4 items-end', !isPlaying && 'paused')}><i /><i /><i /></span>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-[15px] font-medium', active && 'text-fg')}>{track.title}</div>
        <div className="truncate text-[13px] text-fg/55">{sub ?? track.artist}</div>
      </div>
      {right != null && <div className="hidden shrink-0 text-[13px] tabular-nums text-fg/45 sm:block">{right}</div>}
      {showQueue && <AddQueueButton track={track} />}
      <ActionMenu items={[...menu, ...extraMenu]} label={`Menu untuk ${track.title}`} />
    </div>
  );
}
