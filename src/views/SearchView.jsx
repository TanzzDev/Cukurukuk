import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, RefreshCw, Search, TrendingUp, X } from 'lucide-react';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';
import { readStore, useStore, writeStore } from '../services/storage';
import { useListening } from '../services/listening';
import { recentTracks, topTracks } from '../../shared/listening.js';
import TrackRow from '../components/TrackRow';
import { Cover, EmptyState, GhostButton, IconButton, PageHeader, SectionHeader, Shelf, SkelRow, cn } from '../components/ui';

const NONE = Object.freeze([]);
const TABS = [['all', 'Semua'], ['songs', 'Lagu'], ['albums', 'Album'], ['artists', 'Artis']];

function pushRecent(q) {
  const term = q.trim();
  if (term.length < 2) return;
  const list = readStore('recent_searches', NONE);
  writeStore('recent_searches', [term, ...list.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 8));
}

export default function SearchView() {
  const { searchQuery, setSearchQuery } = useNav();
  const p = usePlayer();
  const inputRef = useRef(null);
  const [text, setText] = useState(searchQuery);
  const [q, setQ] = useState(searchQuery);
  const [tab, setTab] = useState('all');
  const [res, setRes] = useState({ status: 'idle', songs: [], albums: [], artists: [], error: '' });
  const [sugs, setSugs] = useState([]);
  const [focused, setFocused] = useState(false);
  const [tick, setTick] = useState(0);
  const recent = useStore('recent_searches', NONE);
  const history = useListening();
  const recents = useMemo(() => recentTracks(history, 8), [history]);
  const top = useMemo(() => topTracks(history, { range: 'all', limit: 5 }), [history]);

  useEffect(() => { if (searchQuery !== text && searchQuery !== q) { setText(searchQuery); setQ(searchQuery); } }, [searchQuery]);
  useEffect(() => { if (!searchQuery) inputRef.current?.focus(); }, []);

  // debounce pengetikan -> pencarian
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q.trim()) { setQ(text.trim()); setSearchQuery(text.trim()); } }, 450);
    return () => clearTimeout(t);
  }, [text]);

  // saran saat mengetik
  useEffect(() => {
    const term = text.trim();
    if (term.length < 2 || !focused) { setSugs([]); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal, timeout: 6000 })
        .then((r) => setSugs((Array.isArray(r) ? r : r?.result || []).map((x) => (typeof x === 'string' ? x : x?.text)).filter(Boolean).slice(0, 6)))
        .catch(() => {});
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, focused]);

  // pencarian (membatalkan permintaan lama agar hasil tidak tertukar)
  useEffect(() => {
    const term = q.trim();
    if (!term) { setRes({ status: 'idle', songs: [], albums: [], artists: [], error: '' }); return undefined; }
    const ctl = new AbortController();
    setRes((r) => ({ ...r, status: 'loading', error: '' }));
    api(`/api/search?query=${encodeURIComponent(term)}&type=all`, { signal: ctl.signal, timeout: 20000 })
      .then((r) => {
        const x = r?.result || {};
        setRes({ status: 'ready', songs: x.songs || [], albums: x.albums || [], artists: x.artists || [], error: '' });
        pushRecent(term);
      })
      .catch((e) => { if (!ctl.signal.aborted) setRes({ status: 'error', songs: [], albums: [], artists: [], error: e.message }); });
    return () => ctl.abort();
  }, [q, tick]);

  const submit = (term) => { const v = (term ?? text).trim(); setText(v); setQ(v); setSearchQuery(v); setSugs([]); inputRef.current?.blur(); };
  const clear = () => { setText(''); setQ(''); setSearchQuery(''); inputRef.current?.focus(); };
  const { songs, albums, artists } = res;
  const empty = res.status === 'ready' && !songs.length && !albums.length && !artists.length;
  const show = (k) => tab === 'all' || tab === k;

  return (
    <div className="pb-4">
      <PageHeader title="Cari" />
      <div className="sticky top-0 z-20 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur md:px-0 pt-safe">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} role="search" className="relative">
          <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg/45" />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
            type="search" enterKeyHint="search" autoComplete="off" placeholder="Cari lagu, album, artis…" aria-label="Cari lagu, album, atau artis"
            className="h-12 w-full rounded-full border border-fg/10 bg-fg/[0.07] pl-12 pr-12 text-[15px] outline-none placeholder:text-fg/40 focus:border-fg/40" />
          {text && <IconButton label="Hapus teks" onClick={clear} className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2"><X size={18} /></IconButton>}
        </form>
        {focused && sugs.length > 0 && (
          <ul className="pop-in absolute inset-x-4 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-fg/10 bg-raised shadow-2xl md:inset-x-0" role="listbox" aria-label="Saran pencarian">
            {sugs.map((s) => <li key={s}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(s)} className="press flex w-full items-center gap-3 px-4 py-3 text-left text-[14.5px] hover:bg-fg/[0.08]"><Search size={15} className="text-fg/40" />{s}</button></li>)}
          </ul>
        )}
        {q && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Jenis hasil">
            {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('press shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold', tab === id ? 'bg-fg text-bg' : 'bg-fg/[0.08] text-fg/70')}>{label}</button>)}
          </div>
        )}
      </div>

      {!q && (
        <div className="space-y-8 pt-3">
          {recent.length > 0 && (
            <section aria-label="Pencarian terakhir" className="px-4 md:px-0">
              <SectionHeader title="Pencarian terakhir" action="Hapus semua" onAction={() => writeStore('recent_searches', NONE)} className="px-0" />
              <ul>{recent.map((r) => (
                <li key={r} className="flex items-center gap-1">
                  <button type="button" onClick={() => submit(r)} className="press flex flex-1 items-center gap-3 rounded-xl px-2 py-3 text-left text-[15px] hover:bg-fg/[0.06]"><Clock size={17} className="text-fg/40" />{r}</button>
                  <IconButton label={`Hapus ${r}`} onClick={() => writeStore('recent_searches', recent.filter((x) => x !== r))} className="h-9 w-9"><X size={16} /></IconButton>
                </li>
              ))}</ul>
            </section>
          )}
          {recents.length > 0 && (
            <section aria-label="Terakhir diputar"><SectionHeader title="Terakhir diputar" /><Shelf>{recents.map((t, i) => (
              <button key={t.id} type="button" onClick={() => p.playTrack(t, recents, i, 'recent')} className="press focus-ring w-[132px] shrink-0 snap-start text-left"><Cover track={t} hd className="aspect-square w-full rounded-2xl" /><div className="mt-2 truncate text-[13.5px] font-medium">{t.title}</div><div className="truncate text-[12px] text-fg/55">{t.artist}</div></button>
            ))}</Shelf></section>
          )}
          {top.length > 0 && (
            <section aria-label="Paling sering diputar" className="px-4 md:px-0"><SectionHeader title="Paling sering diputar" className="px-0" /><div className="-mx-2">{top.map((t) => <TrackRow key={t.id} rank={t.rank} track={{ ...t, videoId: t.id }} sub={`${t.artist} • ${t.plays}x`} onPlay={() => p.playTrack({ ...t, videoId: t.id }, top.map((x) => ({ ...x, videoId: x.id })), t.rank - 1, 'top')} />)}</div></section>
          )}
          {!recent.length && !recents.length && <EmptyState icon={TrendingUp} title="Temukan musikmu" text="Cari judul lagu, nama artis, atau album. Hasilnya langsung bisa diputar atau ditambahkan ke antrean." />}
        </div>
      )}

      {q && res.status === 'loading' && <div className="pt-2" aria-busy="true">{Array.from({ length: 7 }, (_, i) => <SkelRow key={i} />)}</div>}
      {q && res.status === 'error' && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><p className="text-sm text-fg/60">Pencarian gagal: {res.error}</p><GhostButton onClick={() => setTick((t) => t + 1)}><RefreshCw size={15} /> Coba lagi</GhostButton></div>
      )}
      {q && empty && <EmptyState icon={Search} title={`Tidak ada hasil untuk “${q}”`} text="Periksa ejaan atau coba kata kunci lain." />}

      {q && res.status === 'ready' && (
        <div className="space-y-8 pt-2">
          {show('songs') && songs.length > 0 && (
            <section aria-label="Lagu" className="px-2 md:px-0">
              {tab === 'all' && <SectionHeader title="Lagu" className="px-2" />}
              {(tab === 'all' ? songs.slice(0, 6) : songs).map((t, i) => <TrackRow key={t.videoId} track={t} onPlay={() => p.playTrack(t, songs, i, 'search')} />)}
              {tab === 'all' && songs.length > 6 && <button type="button" onClick={() => setTab('songs')} className="press mt-1 w-full rounded-xl py-2.5 text-[13px] font-semibold text-fg/60 hover:text-fg">Lihat semua lagu ({songs.length})</button>}
            </section>
          )}
          {show('albums') && albums.length > 0 && (
            <section aria-label="Album"><SectionHeader title="Album" />
              <div className={cn(tab === 'all' ? 'no-scrollbar flex gap-3 overflow-x-auto px-4 md:px-0' : 'grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 md:px-0 lg:grid-cols-5')}>
                {albums.map((al) => <button key={al.id} type="button" onClick={() => p.setActiveAlbum({ id: al.id, cover: al.cover })} className={cn('press focus-ring text-left', tab === 'all' && 'w-[140px] shrink-0')}><Cover src={al.cover} className="aspect-square w-full rounded-2xl" /><div className="mt-2 truncate text-[14px] font-medium">{al.title}</div><div className="truncate text-[12.5px] text-fg/55">{al.artist}</div></button>)}
              </div>
            </section>
          )}
          {show('artists') && artists.length > 0 && (
            <section aria-label="Artis"><SectionHeader title="Artis" />
              <div className={cn(tab === 'all' ? 'no-scrollbar flex gap-4 overflow-x-auto px-4 md:px-0' : 'grid grid-cols-3 gap-4 px-4 sm:grid-cols-4 md:grid-cols-5 md:px-0 lg:grid-cols-6')}>
                {artists.map((a) => <button key={a.id} type="button" onClick={() => p.setActiveArtist({ id: a.id, name: a.title, cover: a.cover })} className={cn('press focus-ring text-center', tab === 'all' && 'w-[100px] shrink-0')}><Cover src={a.cover} className="aspect-square w-full rounded-full" /><div className="mt-2 truncate text-[13.5px] font-medium">{a.title}</div></button>)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
