import React, { useState } from 'react';
import { Check, ListStart, Lock, Plus, RefreshCw } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import useRelated from '../hooks/useRelated';
import { parseDurationText } from '../../shared/queue';
import { Cover, GhostButton, SkelRow, cn, fmtDur } from './ui';

export function RelatedRow({ track, children }) {
  const dur = parseDurationText(track.duration);
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-fg/[0.05]">
      <Cover track={track} className="h-11 w-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium">{track.title}</div>
        <div className="truncate text-[12.5px] text-fg/55">{track.artist}</div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-fg/45">{dur != null ? fmtDur(dur) : ''}</span>
      {children}
    </div>
  );
}

/** Konten Serupa: rekomendasi yang cocok dengan lagu yang sedang diputar. Putar Berikutnya ≠ Tambahkan ke Antrean. */
export default function SimilarSection({ limit = 8 }) {
  const { currentTrack, isInQueue, isQueueLocked, addToQueue, playNextInQueue } = usePlayer();
  const { items, loading, status, error, retry, partial } = useRelated(currentTrack, { limit: 24 });
  const [all, setAll] = useState(false);
  if (!currentTrack) return null;
  const shown = all ? items : items.slice(0, limit);
  return (
    <section aria-label="Konten Serupa">
      <div className="mb-1 px-2">
        <h3 className="font-display text-[15px] font-semibold">Konten Serupa</h3>
        <p className="mt-0.5 text-[11.5px] leading-snug text-fg/45">
          <ListStart size={11} className="mr-1 inline -mt-0.5" />Putar Berikutnya: setelah lagu ini &nbsp;•&nbsp; <Plus size={11} className="mr-0.5 inline -mt-0.5" />Tambahkan ke Antrean: paling akhir
        </p>
      </div>
      {loading && <div aria-busy="true">{Array.from({ length: 4 }, (_, i) => <SkelRow key={i} />)}</div>}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <p className="text-sm text-fg/60">{error || 'Rekomendasi tidak dapat dimuat.'}</p>
          <GhostButton onClick={retry}><RefreshCw size={15} /> Coba lagi</GhostButton>
        </div>
      )}
      {status === 'ready' && items.length === 0 && <p className="px-3 py-6 text-center text-sm text-fg/55">Belum ada lagu yang cocok ditemukan.</p>}
      {shown.map((t) => {
        const inQ = isInQueue(t);
        return (
          <RelatedRow key={t.videoId} track={t}>
            <button type="button" aria-label={`Putar Berikutnya: ${t.title}`} title="Putar Berikutnya" disabled={inQ && false} onClick={() => playNextInQueue(t)}
              className={cn('press focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full', isQueueLocked ? 'bg-fg/5 text-fg/35' : 'bg-fg/10 hover:bg-fg hover:text-bg')}>
              {isQueueLocked ? <Lock size={15} /> : <ListStart size={17} />}
            </button>
            <button type="button" aria-label={inQ ? `Sudah di Antrean: ${t.title}` : `Tambahkan ke Antrean: ${t.title}`} title={inQ ? 'Sudah di Antrean' : 'Tambahkan ke Antrean'} onClick={() => addToQueue(t)}
              className={cn('press focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full', inQ ? 'bg-fg/10 text-emerald-400' : isQueueLocked ? 'bg-fg/5 text-fg/35' : 'bg-fg/10 hover:bg-fg hover:text-bg')}>
              {inQ ? <Check size={17} className="pop-in" /> : isQueueLocked ? <Lock size={15} /> : <Plus size={17} />}
            </button>
          </RelatedRow>
        );
      })}
      {items.length > limit && !all && <button type="button" onClick={() => setAll(true)} className="press mt-1 w-full rounded-lg py-2 text-[13px] font-medium text-fg/60 hover:text-fg">Tampilkan lebih banyak ({items.length - limit})</button>}
      {partial && status === 'ready' && items.length > 0 && <p className="px-3 pt-2 text-[11.5px] text-fg/40">Sebagian sumber rekomendasi tidak tersedia; hasil berdasarkan data yang ada.</p>}
    </section>
  );
}
