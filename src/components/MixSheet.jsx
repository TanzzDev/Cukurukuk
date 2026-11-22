import React, { useEffect, useMemo, useState } from 'react';
import { Check, ListPlus, Lock, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import useRelated from '../hooks/useRelated';
import { parseDurationText, trackId } from '../../shared/queue';
import { Cover, GhostButton, IconButton, PrimaryButton, Sheet, SkelRow, cn, fmtDur } from './ui';

/** Mix Antrean: lagu yang COCOK dengan lagu pilihan (bukan acak), berperingkat, dengan alasan kecocokan yang jujur. */
export default function MixSheet() {
  const { mixSeed, closeMix, playlist, playlistIndex, isInQueue, isQueueLocked, toggleQueueLock, addToQueue, removeFromQueue } = usePlayer();
  const open = !!mixSeed;
  const { items, loading, status, error, retry, partial } = useRelated(mixSeed, { limit: 30, enabled: open });
  const [picked, setPicked] = useState(() => new Set());
  const seedId = mixSeed && trackId(mixSeed);
  useEffect(() => setPicked(new Set()), [seedId]);

  const waiting = useMemo(() => items.filter((t) => !isInQueue(t)), [items, playlist, playlistIndex]);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addPicked = () => {
    const list = items.filter((t) => picked.has(t.videoId) && !isInQueue(t));
    if (list.length) addToQueue(list);
    setPicked(new Set());
  };
  const removeFromMix = (t) => {
    const idx = playlist.findIndex((x, i) => i > playlistIndex && trackId(x) === t.videoId);
    if (idx !== -1) removeFromQueue(idx);
  };

  return (
    <Sheet open={open} onClose={closeMix} title="Mix Antrean" wide z={205} className="md:h-[80vh]">
      {mixSeed && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-5 mb-3 flex items-center gap-3 rounded-2xl bg-fg/[0.06] p-3">
            <Cover track={mixSeed} className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-fg/45">Dari lagu</div>
              <div className="truncate text-[15px] font-semibold">{mixSeed.title}</div>
              <div className="truncate text-[12.5px] text-fg/55">{mixSeed.artist}</div>
            </div>
            <Sparkles size={20} className="shrink-0 text-fg/50" />
          </div>
          <p className="mx-5 mb-2 text-[13px] text-fg/65" aria-live="polite">
            {loading ? 'Mencari lagu yang cocok…' : status === 'ready' && items.length ? 'Menemukan lagu yang cocok untuk diputar berikutnya.' : status === 'ready' ? 'Belum ada lagu yang cocok ditemukan.' : ''}
          </p>
          {isQueueLocked && (
            <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-fg/[0.08] px-3 py-2 text-[12.5px]" role="status">
              <Lock size={14} /><span className="flex-1">Antrean dikunci. Buka kunci untuk menambah lagu.</span>
              <button type="button" onClick={toggleQueueLock} className="press font-semibold underline underline-offset-2">Buka</button>
            </div>
          )}

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3">
            {loading && Array.from({ length: 6 }, (_, i) => <SkelRow key={i} />)}
            {status === 'error' && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <p className="text-sm text-fg/60">{error || 'Rekomendasi tidak dapat dimuat.'}</p>
                <GhostButton onClick={retry}><RefreshCw size={15} /> Coba lagi</GhostButton>
              </div>
            )}
            {items.map((t) => {
              const inQ = isInQueue(t);
              const isCur = playlist[playlistIndex] && trackId(playlist[playlistIndex]) === t.videoId;
              const dur = parseDurationText(t.duration);
              const pct = Math.round((t.score || 0) * 100);
              return (
                <div key={t.videoId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-fg/[0.05]">
                  <button type="button" role="checkbox" aria-checked={picked.has(t.videoId)} aria-label={`Pilih ${t.title}`} disabled={inQ || isQueueLocked} onClick={() => toggle(t.videoId)}
                    className={cn('press focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-md border', picked.has(t.videoId) ? 'border-fg bg-fg text-bg' : 'border-fg/30', (inQ || isQueueLocked) && 'opacity-30')}>
                    {picked.has(t.videoId) && <Check size={15} />}
                  </button>
                  <Cover track={t} className="h-12 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium">{t.title}</div>
                    <div className="truncate text-[12.5px] text-fg/55">{t.artist}{dur != null ? ` • ${fmtDur(dur)}` : ''}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-fg/10" aria-hidden="true"><span className="block h-full rounded-full bg-fg/70" style={{ width: `${Math.max(6, pct)}%` }} /></span>
                      <span className="truncate text-[11px] text-fg/45">{(t.reasons && t.reasons.length ? t.reasons.slice(0, 2).join(' • ') : 'Kecocokan terbaik yang tersedia')}</span>
                    </div>
                  </div>
                  {isCur ? (
                    <span className="shrink-0 rounded-full bg-fg/10 px-3 py-1.5 text-xs font-semibold">Diputar</span>
                  ) : inQ ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-fg/10 px-2 py-1 text-[10.5px] font-semibold text-emerald-400 sm:px-2.5 sm:py-1.5 sm:text-[11.5px]">Sudah di Antrean</span>
                      <IconButton label={`Hapus ${t.title} dari antrean`} onClick={() => removeFromMix(t)} className="h-9 w-9"><Trash2 size={16} /></IconButton>
                    </div>
                  ) : (
                    <button type="button" onClick={() => addToQueue(t)} aria-label={`Tambahkan ${t.title}`} disabled={isQueueLocked}
                      className="press focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fg/10 px-3.5 text-[13px] font-semibold hover:bg-fg hover:text-bg disabled:opacity-40">
                      {isQueueLocked ? <Lock size={14} /> : <ListPlus size={15} />}<span>Tambahkan</span>
                    </button>
                  )}
                </div>
              );
            })}
            {partial && status === 'ready' && items.length > 0 && <p className="px-3 pb-3 pt-1 text-[11.5px] text-fg/40">Sebagian sumber rekomendasi tidak tersedia; hasil berdasarkan data yang ada.</p>}
          </div>

          <div className="flex gap-3 border-t border-fg/10 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <GhostButton onClick={addPicked} disabled={picked.size === 0 || isQueueLocked} className="flex-1">Tambahkan terpilih{picked.size ? ` (${picked.size})` : ''}</GhostButton>
            <PrimaryButton onClick={() => addToQueue(waiting)} disabled={waiting.length === 0 || isQueueLocked} className="flex-1">Tambahkan semua{waiting.length ? ` (${waiting.length})` : ''}</PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}
