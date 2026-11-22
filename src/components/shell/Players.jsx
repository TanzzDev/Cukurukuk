import React from 'react';
import { Heart, ListMusic, Maximize2, Mic2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayer, useProgress } from '../../context/PlayerContext';
import { toggleLikeSong, useIsLiked } from '../../services/library';
import { Cover, IconButton, Spinner, cn, fmtDur } from '../ui';

function MiniProgress() {
  const { currentTime, duration } = useProgress();
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return <div className="absolute inset-x-0 bottom-0 h-[3px] bg-fg/10" aria-hidden="true"><div className="h-full bg-fg" style={{ width: `${pct}%` }} /></div>;
}

/** Mini player (HP): melayang di atas navigasi bawah, tidak menutupi tombol navigasi. */
export function MiniPlayer() {
  const { currentTrack, isPlaying, isLoading, togglePlay, nextTrack, setIsFullPlayerOpen, setIsQueueOpen, isQueueLocked } = usePlayer();
  const liked = useIsLiked(currentTrack);
  if (!currentTrack) return null;
  return (
    <div className="fixed inset-x-0 z-[45] px-3 bottom-[calc(env(safe-area-inset-bottom)+82px)] md:hidden">
      <div className="slide-r relative mx-auto max-w-md overflow-hidden rounded-2xl border border-fg/10 bg-[var(--miniplayer-bg)] shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 p-2">
          <button type="button" onClick={() => setIsFullPlayerOpen(true)} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" aria-label={`Buka pemutar: ${currentTrack.title}`}>
            <Cover track={currentTrack} className="h-11 w-11 shrink-0 rounded-lg" />
            <span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{currentTrack.title}</span><span className="block truncate text-[12px] text-fg/55">{currentTrack.artist}</span></span>
          </button>
          <IconButton label={liked ? 'Batal suka' : 'Suka'} onClick={() => toggleLikeSong(currentTrack)} className="h-9 w-9"><Heart size={18} className={cn(liked && 'fill-current text-red-400')} /></IconButton>
          <IconButton label="Tampilkan Antrean" onClick={() => setIsQueueOpen(true)} className="h-9 w-9" active={isQueueLocked}><ListMusic size={19} /></IconButton>
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Jeda' : 'Putar'} className="press focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg">
            {isLoading ? <Spinner size={18} /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <IconButton label="Lagu berikutnya" onClick={nextTrack} className="h-9 w-9"><SkipForward size={19} /></IconButton>
        </div>
        <MiniProgress />
      </div>
    </div>
  );
}

function SeekBar() {
  const { seek } = usePlayer();
  const { currentTime, duration } = useProgress();
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="flex w-full items-center gap-3 text-[11.5px] tabular-nums text-fg/50">
      <span className="w-10 text-right">{fmtDur(currentTime)}</span>
      <input type="range" aria-label="Posisi lagu" className="dw-range" min={0} max={duration || 100} step={0.5} value={Math.min(currentTime, duration || 0)}
        style={{ '--pct': `${pct}%` }} onChange={(e) => seek(Number(e.target.value))} disabled={!duration} />
      <span className="w-10">{fmtDur(duration)}</span>
    </div>
  );
}

/** Bar pemutar (tablet & laptop): kontrol lengkap, antrean, lirik, volume — tidak menutupi konten (konten diberi ruang bawah). */
export function PlayerBar() {
  const p = usePlayer();
  const { currentTrack, isPlaying, isLoading, repeatMode, isShuffle, volume, isQueueOpen, isQueueLocked } = p;
  const liked = useIsLiked(currentTrack);
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const idle = !currentTrack;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden h-[88px] items-center gap-4 border-t border-fg/10 bg-[var(--dock-bg)] px-4 backdrop-blur-xl md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,520px)_minmax(0,1fr)] lg:px-6" role="region" aria-label="Pemutar musik">
      <div className="flex min-w-0 items-center gap-3">
        {idle ? <div className="h-14 w-14 shrink-0 rounded-lg bg-fg/[0.06]" /> : <button type="button" onClick={() => p.setIsFullPlayerOpen(true)} aria-label="Buka pemutar layar penuh" className="focus-ring shrink-0 rounded-lg"><Cover track={currentTrack} className="h-14 w-14 rounded-lg" /></button>}
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold">{idle ? 'Belum ada lagu' : currentTrack.title}</div>
          <div className="truncate text-[12.5px] text-fg/55">{idle ? 'Pilih lagu dari Dashboard atau Cari' : currentTrack.artist}</div>
        </div>
        {!idle && <IconButton label={liked ? 'Batal suka' : 'Suka'} onClick={() => toggleLikeSong(currentTrack)}><Heart size={18} className={cn(liked && 'fill-current text-red-400')} /></IconButton>}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <IconButton label="Acak" onClick={p.toggleShuffle} active={isShuffle} className={isShuffle ? 'text-fg' : 'text-fg/50'}><Shuffle size={17} /></IconButton>
          <IconButton label="Sebelumnya" onClick={() => p.prevTrack()} disabled={idle}><SkipBack size={20} fill="currentColor" /></IconButton>
          <button type="button" onClick={p.togglePlay} aria-label={isPlaying ? 'Jeda' : 'Putar'} className="press focus-ring grid h-11 w-11 place-items-center rounded-full bg-fg text-bg hover:opacity-90 disabled:opacity-40" disabled={idle && p.playlist.length === 0}>
            {isLoading ? <Spinner size={20} /> : isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
          <IconButton label="Berikutnya" onClick={p.nextTrack} disabled={idle}><SkipForward size={20} fill="currentColor" /></IconButton>
          <IconButton label={repeatMode === 'one' ? 'Ulangi satu lagu' : repeatMode === 'all' ? 'Ulangi semua' : 'Tidak mengulang'} onClick={p.toggleRepeat} className={repeatMode === 'off' ? 'text-fg/50' : 'text-fg'}>
            {repeatMode === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </IconButton>
        </div>
        <SeekBar />
      </div>
      <div className="flex items-center justify-end gap-1">
        <IconButton label="Lirik" onClick={() => p.setIsLyricsOverlayOpen(true)} disabled={idle}><Mic2 size={18} /></IconButton>
        <IconButton label={isQueueOpen ? 'Sembunyikan Antrean' : 'Tampilkan Antrean'} onClick={() => p.setIsQueueOpen(!isQueueOpen)} active={isQueueOpen} className={isQueueOpen || isQueueLocked ? 'bg-fg/10 text-fg' : ''}><ListMusic size={19} /></IconButton>
        <div className="ml-1 hidden w-[120px] items-center gap-1 lg:flex">
          <IconButton label={volume === 0 ? 'Suarakan' : 'Bisukan'} onClick={p.toggleMute} className="h-9 w-9"><VolIcon size={18} /></IconButton>
          <input type="range" aria-label="Volume" className="dw-range" min={0} max={1} step={0.01} value={Math.min(volume, 1)} style={{ '--pct': `${Math.min(volume, 1) * 100}%` }} onChange={(e) => p.setVolumeLevel(Number(e.target.value))} />
        </div>
        <IconButton label="Layar penuh" onClick={() => p.setIsFullPlayerOpen(true)} disabled={idle}><Maximize2 size={17} /></IconButton>
      </div>
    </div>
  );
}
