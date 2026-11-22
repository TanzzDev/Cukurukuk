import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Info, ListStart, Lock, LockOpen, Play, Sparkles, Trash2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useMediaQuery } from '../hooks/useMedia';
import { parseDurationText, queueDurationSeconds } from '../../shared/queue';
import { ActionMenu, ConfirmDialog, Cover, EmptyState, IconButton, Sheet, cn, fmtDur, fmtLong } from './ui';
import SimilarSection from './SimilarSection';

function QueueRow({ track, number, actual, current, upcoming, lastIndex, style, handlers, dragging }) {
  const { isPlaying, playFromQueue, removeFromQueue, moveQueueItem, playlistIndex, setDetailTrack, togglePlay } = usePlayer();
  const dur = parseDurationText(track.duration);
  const items = [
    !current && { label: 'Putar Sekarang', icon: Play, onClick: () => playFromQueue(actual) },
    upcoming && actual > playlistIndex + 1 && { label: 'Putar Berikutnya', icon: ListStart, onClick: () => moveQueueItem(actual, playlistIndex + 1) },
    upcoming && actual > playlistIndex + 1 && { label: 'Naikkan', icon: ArrowUp, onClick: () => moveQueueItem(actual, actual - 1) },
    upcoming && actual < lastIndex && { label: 'Turunkan', icon: ArrowDown, onClick: () => moveQueueItem(actual, actual + 1) },
    !current && { label: 'Hapus dari Antrean', icon: Trash2, danger: true, onClick: () => removeFromQueue(actual) },
    { label: 'Lihat Detail Lagu', icon: Info, onClick: () => setDetailTrack(track) },
  ];
  return (
    <div data-qrow={upcoming ? actual : undefined} style={style}
      className={cn('flex items-center gap-2.5 rounded-xl px-2 py-2 transition-[background-color,transform] duration-150', current ? 'bg-fg/[0.1]' : 'hover:bg-fg/[0.06]', !upcoming && !current && 'opacity-55', dragging && 'bg-raised shadow-2xl')}>
      <div className="w-7 shrink-0 text-center text-xs tabular-nums text-fg/40" aria-hidden="true">
        {current ? <span className={cn('eq-bars inline-flex h-4 items-end text-fg', !isPlaying && 'paused')}><i /><i /><i /></span> : String(number).padStart(2, '0')}
      </div>
      <button type="button" onClick={() => (current ? togglePlay() : playFromQueue(actual))} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left" aria-label={current ? `Sedang diputar: ${track.title}` : `Putar ${track.title}`}>
        <Cover track={track} className="h-11 w-11 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[14.5px] font-medium', current && 'text-fg')}>{track.title}</span>
          <span className="block truncate text-[12.5px] text-fg/55">{track.artist}</span>
        </span>
      </button>
      <span className="shrink-0 text-xs tabular-nums text-fg/45">{dur != null ? fmtDur(dur) : '–'}</span>
      <ActionMenu items={items} label={`Menu antrean untuk ${track.title}`} className="h-8 w-8" />
      {upcoming ? (
        <button type="button" aria-label={`Geser urutan ${track.title}. Gunakan panah atas/bawah.`} title="Seret untuk mengubah urutan"
          {...handlers} className="focus-ring grid h-8 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-fg/40 hover:text-fg active:cursor-grabbing"><GripVertical size={17} /></button>
      ) : <span className="w-7 shrink-0" />}
    </div>
  );
}

export function QueuePanel({ onClose, docked = false }) {
  const { playlist, playlistIndex, queueInfo, isQueueLocked, toggleQueueLock, clearQueue, moveQueueItem, openMix, currentTrack, detour } = usePlayer();
  const [showPlayed, setShowPlayed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drag, setDrag] = useState(null);
  const listRef = useRef(null);
  const scrollRef = useRef(null);

  const start = Math.max(0, playlistIndex);
  const played = playlist.slice(0, Math.max(0, playlistIndex));
  const visible = playlist.slice(start);
  const dur = queueDurationSeconds(visible);
  const durationText = dur == null ? 'durasi belum lengkap' : `${queueInfo.exact ? '' : '± '}${fmtLong(dur)}`;
  const lastIndex = playlist.length - 1;

  // Seret-urut: keadaan seret disimpan di ref (tanpa efek samping di dalam updater React) dan hanya untuk tampilan di state.
  const dragRef = useRef(null);
  const setDragBoth = (d) => { dragRef.current = d; setDrag(d); };
  const handlersFor = (actual) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      const rows = [...listRef.current.querySelectorAll('[data-qrow]')];
      const rects = rows.map((r) => { const b = r.getBoundingClientRect(); return { idx: Number(r.dataset.qrow), top: b.top, h: b.height }; });
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragBoth({ from: actual, over: actual, dy: 0, h: rects[0]?.h || 56, startY: e.clientY, rects });
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = e.clientY - d.startY;
      const fromRect = d.rects.find((r) => r.idx === d.from);
      const center = (fromRect?.top || 0) + (fromRect?.h || 0) / 2 + dy;
      let over = d.from;
      let best = Infinity;
      for (const r of d.rects) {
        const dist = Math.abs(r.top + r.h / 2 - center);
        if (dist < best) { best = dist; over = r.idx; }
      }
      const sc = scrollRef.current;
      if (sc) {
        const bb = sc.getBoundingClientRect();
        if (e.clientY < bb.top + 40) sc.scrollTop -= 10;
        else if (e.clientY > bb.bottom - 40) sc.scrollTop += 10;
      }
      setDragBoth({ ...d, dy, over });
    },
    onPointerUp: () => {
      const d = dragRef.current;
      setDragBoth(null);
      if (d && d.over !== d.from) moveQueueItem(d.from, d.over);
    },
    onPointerCancel: () => setDragBoth(null),
    onKeyDown: (e) => {
      if (e.key === 'ArrowUp' && actual > playlistIndex + 1) { e.preventDefault(); moveQueueItem(actual, actual - 1); }
      if (e.key === 'ArrowDown' && actual < lastIndex) { e.preventDefault(); moveQueueItem(actual, actual + 1); }
    },
  });

  const styleFor = (actual) => {
    if (!drag) return undefined;
    if (actual === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 20, position: 'relative', transition: 'none' };
    if (drag.from < drag.over && actual > drag.from && actual <= drag.over) return { transform: `translateY(${-drag.h}px)` };
    if (drag.from > drag.over && actual < drag.from && actual >= drag.over) return { transform: `translateY(${drag.h}px)` };
    return undefined;
  };

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Antrean">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Antrean</h2>
          <p className="mt-0.5 text-[13px] text-fg/55" aria-live="polite">{queueInfo.count} lagu • {durationText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={isQueueLocked ? 'Buka Antrean' : 'Kunci Antrean'} onClick={toggleQueueLock} active={isQueueLocked} className={isQueueLocked ? 'bg-fg text-bg hover:bg-fg hover:text-bg' : ''}>
            {isQueueLocked ? <Lock size={18} /> : <LockOpen size={18} />}
          </IconButton>
          <IconButton label="Bersihkan Antrean" onClick={() => setConfirm(true)} disabled={queueInfo.upcomingCount === 0}><Trash2 size={18} /></IconButton>
          <IconButton label="Tutup antrean" onClick={onClose}><X size={19} /></IconButton>
        </div>
      </div>

      {isQueueLocked && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-fg/[0.08] px-3 py-2 text-[12.5px]" role="status">
          <Lock size={14} className="shrink-0" />
          <span className="flex-1">Antrean sedang dikunci. Penambahan lagu dinonaktifkan.</span>
          <button type="button" onClick={toggleQueueLock} className="press font-semibold underline underline-offset-2">Buka</button>
        </div>
      )}
      {detour && <div className="mx-5 mb-2 rounded-xl bg-fg/[0.06] px-3 py-2 text-[12.5px] text-fg/70">Sedang memutar lagu di luar antrean. Antrean berlanjut setelahnya.</div>}

      <div className="px-5 pb-3">
        <button type="button" onClick={() => openMix()} disabled={!currentTrack}
          className="press focus-ring flex w-full items-center gap-3 rounded-2xl border border-fg/10 bg-fg/[0.05] px-4 py-3 text-left hover:bg-fg/[0.09] disabled:opacity-50">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-fg text-bg"><Sparkles size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold">Mix Antrean</span>
            <span className="block truncate text-[12.5px] text-fg/55">Temukan lagu yang cocok dengan lagu ini</span>
          </span>
          <ChevronRight size={18} className="text-fg/40" />
        </button>
      </div>

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {playlist.length === 0 ? (
          <EmptyState icon={Sparkles} title="Antrean masih kosong" text="Tambahkan lagu dari halaman Cari, Mix Antrean, atau Konten Serupa." />
        ) : (
          <div ref={listRef}>
            {played.length > 0 && (
              <button type="button" onClick={() => setShowPlayed((v) => !v)} className="press mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-fg/55 hover:text-fg" aria-expanded={showPlayed}>
                {showPlayed ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Sudah diputar ({played.length})
              </button>
            )}
            {showPlayed && played.map((t, i) => <QueueRow key={`p${i}-${t.videoId || t.id}`} track={t} number={i + 1} actual={i} lastIndex={lastIndex} />)}
            {visible.map((t, i) => {
              const actual = start + i;
              const isCur = playlistIndex >= 0 && actual === playlistIndex;
              return (
                <QueueRow key={`${actual}-${t.videoId || t.id}`} track={t} number={i + 1} actual={actual} current={isCur} upcoming={!isCur} lastIndex={lastIndex}
                  style={styleFor(actual)} dragging={drag?.from === actual} handlers={!isCur ? handlersFor(actual) : undefined} />
              );
            })}
          </div>
        )}
        <div className="mt-4 border-t border-fg/10 pt-4"><SimilarSection /></div>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger title="Bersihkan Antrean?"
        text={`${queueInfo.upcomingCount} lagu yang menunggu akan dihapus. Lagu yang sedang diputar tidak berhenti, dan playlist atau pustakamu tidak berubah.`}
        confirmLabel="Bersihkan" onConfirm={clearQueue} />
    </div>
  );
}

/** Desktop lebar: panel menempel di kanan. Tablet/HP: lembar samping/bawah. */
export default function QueueHost() {
  const { isQueueOpen, setIsQueueOpen, isFullPlayerOpen } = usePlayer();
  const docked = useMediaQuery('(min-width: 1280px)') && !isFullPlayerOpen;
  const close = () => setIsQueueOpen(false);
  if (!isQueueOpen) return null;
  if (docked) {
    return (
      <aside className="slide-r fixed bottom-[88px] right-0 top-0 z-40 w-[380px] border-l border-fg/10 bg-card" aria-label="Panel antrean">
        <QueuePanel onClose={close} docked />
      </aside>
    );
  }
  return <Sheet open onClose={close} side z={200} title={null} className="h-[86vh] md:h-full"><QueuePanel onClose={close} /></Sheet>;
}
