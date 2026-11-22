import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Minus, Play, Shuffle, TrendingUp } from 'lucide-react';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { deviceTz, useListening } from '../services/listening';
import { topTracks } from '../../shared/listening.js';
import { fmtMinutes } from '../lib/format';
import TrackRow from '../components/TrackRow';
import { EmptyState, GhostButton, IconButton, PageHeader, PrimaryButton, cn } from '../components/ui';

const RANGES = [['all', 'Sepanjang masa'], ['30d', '30 hari'], ['7d', '7 hari']];

function Change({ c }) {
  if (c == null) return null;
  if (c === 'new') return <span className="rounded-full bg-fg/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">BARU</span>;
  if (c === 0) return <Minus size={13} className="text-fg/35" aria-label="Tetap" />;
  return <span className={cn('inline-flex items-center text-[11px] font-semibold', c > 0 ? 'text-emerald-400' : 'text-red-400')}>{c > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(c)}</span>;
}

export default function TopView() {
  const { back, navigate } = useNav();
  const p = usePlayer();
  const state = useListening();
  const [range, setRange] = useState('all');
  const items = useMemo(() => topTracks(state, { range, tz: deviceTz(), limit: 50 }), [state, range]);
  const list = useMemo(() => items.map((t) => ({ ...t, videoId: t.id, cover: t.cover })), [items]);
  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 px-3 pt-3 pt-safe md:px-0"><IconButton label="Kembali" onClick={() => back('profile')}><ArrowLeft size={21} /></IconButton></header>
      <PageHeader title="Teratas Saya" subtitle={items.length ? `${items.length} lagu • urut berdasarkan pemutaran valid` : 'Berdasarkan pemutaran valid'} className="!pt-2" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 md:px-0" role="tablist" aria-label="Rentang waktu">
        {RANGES.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={range === id} onClick={() => setRange(id)} className={cn('press shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold', range === id ? 'bg-fg text-bg' : 'bg-fg/[0.08] text-fg/70')}>{l}</button>)}
      </div>
      {items.length > 0 && (
        <div className="flex gap-2.5 px-4 pb-3 md:px-0"><PrimaryButton onClick={() => p.playTrack(list[0], list, 0, 'top')}><Play size={17} fill="currentColor" /> Putar</PrimaryButton><GhostButton className="!h-11" onClick={() => p.playShuffled(list, 'top')}><Shuffle size={16} /> Acak</GhostButton></div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Belum ada data" text={range === 'all' ? 'Dengarkan beberapa lagu dan peringkatmu muncul di sini. Tidak ada lagu contoh.' : 'Belum ada pemutaran valid pada rentang ini.'} action={<button type="button" onClick={() => navigate('search')} className="press mt-5 rounded-full bg-fg px-6 py-2.5 text-sm font-semibold text-bg">Cari lagu</button>} />
      ) : (
        <div className="px-2 md:px-0">{list.map((t, i) => (
          <div key={t.id} className="flex items-center">
            <div className="min-w-0 flex-1"><TrackRow rank={t.rank} track={t} sub={`${t.artist} • ${t.plays}x • ${fmtMinutes(t.seconds)}`} onPlay={() => p.playTrack(t, list, i, 'top')} /></div>
            {range !== 'all' && <div className="w-10 shrink-0 text-center"><Change c={t.change} /></div>}
          </div>
        ))}</div>
      )}
      {items.length > 0 && items.length < 50 && <p className="px-4 pt-3 text-[12px] text-fg/40 md:px-0">Hanya {items.length} lagu yang memenuhi kriteria; tidak ada lagu tambahan untuk menggenapi 50.</p>}
    </div>
  );
}
