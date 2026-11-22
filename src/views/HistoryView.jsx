import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock, Search, Trash2 } from 'lucide-react';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { clearHistory, deviceTz, useListening } from '../services/listening';
import { historyGroups } from '../../shared/listening.js';
import { fmtDateKey, fmtMinutes } from '../lib/format';
import TrackRow from '../components/TrackRow';
import { ConfirmDialog, EmptyState, IconButton, PageHeader } from '../components/ui';

const time = (t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: deviceTz() }).replace('.', ':');

export default function HistoryView() {
  const { back, navigate } = useNav();
  const p = usePlayer();
  const state = useListening();
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);
  const groups = useMemo(() => historyGroups(state, { tz: deviceTz(), query: q }), [state, q]);
  const all = useMemo(() => groups.flatMap((g) => g.items.map((it) => ({ videoId: it.k, id: it.k, title: it.title, artist: it.artist, cover: it.cover, artistId: it.artistId }))), [groups]);
  let cursor = 0;
  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 px-3 pt-3 pt-safe md:px-0"><IconButton label="Kembali" onClick={() => back('profile')}><ArrowLeft size={21} /></IconButton></header>
      <PageHeader title="Riwayat" subtitle="Hanya pemutaran valid: audio benar-benar berjalan, bukan klik tombol Play." right={state.history.length > 0 && <IconButton label="Hapus riwayat" onClick={() => setConfirm(true)} className="bg-fg/[0.07]"><Trash2 size={19} /></IconButton>} className="!pt-2" />
      {state.history.length > 0 && (
        <div className="px-4 pb-3 md:px-0"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari di riwayat" aria-label="Cari di riwayat" className="h-11 w-full rounded-full border border-fg/10 bg-fg/[0.06] pl-11 pr-4 text-[14.5px] outline-none placeholder:text-fg/40 focus:border-fg/40" /></div></div>
      )}
      {state.history.length === 0 && <EmptyState icon={Clock} title="Belum ada riwayat" text="Lagu yang kamu dengarkan minimal 30 detik akan tercatat di sini." action={<button type="button" onClick={() => navigate('search')} className="press mt-5 rounded-full bg-fg px-6 py-2.5 text-sm font-semibold text-bg">Cari lagu</button>} />}
      {state.history.length > 0 && groups.length === 0 && <EmptyState title={`Tidak ada hasil untuk “${q}”`} />}
      <div className="px-2 md:px-0">
        {groups.map((g) => (
          <section key={g.key} className="mb-5" aria-label={g.label}>
            <h2 className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wider text-fg/45">{g.label}</h2>
            {g.items.map((it) => {
              const idx = cursor++;
              const t = all[idx];
              return <TrackRow key={it.id} track={t} sub={`${it.artist} • ${g.key === 'earlier' || g.key === 'week' ? `${fmtDateKey(it.d, { day: 'numeric', month: 'short' })}, ` : ''}${time(it.t)}`} right={fmtMinutes(it.s)} onPlay={() => p.playTrack(t, all, idx, 'history')} />;
            })}
          </section>
        ))}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger title="Hapus riwayat?" text="Riwayat dan data Teratas Saya akan dihapus. Drowify Streak, rekor, dan hari aktifmu tidak berubah." confirmLabel="Hapus" onConfirm={clearHistory} />
    </div>
  );
}
