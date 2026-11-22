import React, { useEffect, useMemo, useState } from 'react';
import { Download, Heart, ListMusic, Plus, Search, Shuffle, Play, X } from 'lucide-react';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { useLiked, useLikedArtists, usePlaylists } from '../services/library';
import { useListening } from '../services/listening';
import { readStore } from '../services/storage';
import { historyGroups } from '../../shared/listening.js';
import { takeResume } from '../services/spotify';
import TrackRow from '../components/TrackRow';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import SpotifyImportModal from '../components/SpotifyImportModal';
import { ActionMenu, Cover, EmptyState, GhostButton, IconButton, PageHeader, PlaylistCover, PrimaryButton, SectionHeader, cn } from '../components/ui';
import { fmtDateKey } from '../lib/format';

const CATS = [['all', 'Semua'], ['playlist', 'Playlist'], ['liked', 'Lagu Disukai'], ['recent', 'Baru Diputar'], ['artist', 'Artis']];
const SORTS = [['added', 'Terbaru ditambahkan'], ['played', 'Terakhir diputar'], ['az', 'Nama A–Z'], ['za', 'Nama Z–A'], ['most', 'Paling sering diputar']];

function PlaylistCard({ pl, onOpen, onPlay }) {
  return (
    <div className="group">
      <div className="relative">
        <button type="button" onClick={onOpen} className="press focus-ring block w-full overflow-hidden rounded-2xl" aria-label={`Buka playlist ${pl.name}`}><PlaylistCover pl={pl} /></button>
        {pl.songs.length > 0 && <IconButton label={`Putar ${pl.name}`} onClick={onPlay} className="absolute bottom-2 right-2 h-10 w-10 bg-white text-black shadow-xl hover:!bg-white md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100"><Play size={17} fill="currentColor" className="ml-0.5" /></IconButton>}
      </div>
      <div className="mt-2 truncate text-[14.5px] font-medium">{pl.name}</div>
      <div className="truncate text-[12.5px] text-fg/55">{pl.songs.length} lagu{pl.description ? ` • ${pl.description}` : ''}</div>
      {pl.createdAt > 0 && <div className="hidden text-[11.5px] text-fg/35 md:block">Dibuat {fmtDateKey(new Date(pl.createdAt).toISOString().slice(0, 10))}</div>}
    </div>
  );
}

export default function LibraryView() {
  const { navigate } = useNav();
  const p = usePlayer();
  const playlists = usePlaylists();
  const liked = useLiked();
  const artists = useLikedArtists();
  const history = useListening();
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('added');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [create, setCreate] = useState(false);
  const [imp, setImp] = useState({ open: false, url: '' });

  useEffect(() => { const r = takeResume(); if (r) setImp({ open: true, url: r }); }, []);

  const plays = (t) => history.tracks[t.videoId || t.id]?.p || 0;
  const term = q.trim().toLowerCase();
  const hasPlays = Object.keys(history.tracks).length > 0;
  const playedMap = readStore('playlist_played', {}) || {};

  const sortedPlaylists = useMemo(() => {
    let l = playlists.filter((pl) => !term || pl.name.toLowerCase().includes(term) || pl.songs.some((s) => `${s.title} ${s.artist}`.toLowerCase().includes(term)));
    const by = {
      added: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      played: (a, b) => (playedMap[b.id] || 0) - (playedMap[a.id] || 0),
      az: (a, b) => a.name.localeCompare(b.name, 'id'),
      za: (a, b) => b.name.localeCompare(a.name, 'id'),
      most: (a, b) => b.songs.reduce((n, s) => n + plays(s), 0) - a.songs.reduce((n, s) => n + plays(s), 0),
    }[sort];
    return by ? [...l].sort(by) : l;
  }, [playlists, term, sort, history]);

  const sortedLiked = useMemo(() => {
    const l = liked.filter((s) => !term || `${s.title} ${s.artist}`.toLowerCase().includes(term));
    if (sort === 'az') return [...l].sort((a, b) => a.title.localeCompare(b.title, 'id'));
    if (sort === 'za') return [...l].sort((a, b) => b.title.localeCompare(a.title, 'id'));
    if (sort === 'most') return [...l].sort((a, b) => plays(b) - plays(a));
    if (sort === 'played') return [...l].sort((a, b) => (history.tracks[b.videoId || b.id]?.l || 0) - (history.tracks[a.videoId || a.id]?.l || 0));
    return l;
  }, [liked, term, sort, history]);

  const groups = useMemo(() => historyGroups(history, { query: q }), [history, q]);
  const artistList = artists.filter((a) => !term || `${a.name || a.title || ''}`.toLowerCase().includes(term));
  const nothing = !playlists.length && !liked.length && !artists.length;

  const openArtist = (a) => p.setActiveArtist({ id: a.artistId, name: a.name || a.title || a.artist, cover: a.cover || a.thumbnail });

  return (
    <div className="pb-4">
      <PageHeader title="Pustaka" right={<>
        <IconButton label="Cari di pustaka" onClick={() => setSearching((v) => !v)} active={searching} className="bg-fg/[0.07]"><Search size={20} /></IconButton>
        <ActionMenu label="Tambah" className="!rounded-full bg-fg text-bg hover:!bg-fg/90 hover:!text-bg" items={[
          { label: 'Playlist baru', icon: Plus, onClick: () => setCreate(true) },
          { label: 'Import dari Spotify', icon: Download, onClick: () => setImp({ open: true, url: '' }) },
        ]} />
      </>} />

      {searching && (
        <div className="px-4 pb-3 md:px-0"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari playlist, lagu, atau artis di pustakamu" aria-label="Cari di pustaka" className="h-11 w-full rounded-full border border-fg/10 bg-fg/[0.06] pl-11 pr-11 text-[14.5px] outline-none placeholder:text-fg/40 focus:border-fg/40" />{q && <IconButton label="Hapus" onClick={() => setQ('')} className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"><X size={16} /></IconButton>}</div></div>
      )}

      <div className="flex items-center gap-3 px-4 pb-4 md:px-0">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto" role="tablist" aria-label="Kategori pustaka">
          {CATS.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={cat === id} onClick={() => setCat(id)} className={cn('press shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold', cat === id ? 'bg-fg text-bg' : 'bg-fg/[0.08] text-fg/70')}>{l}</button>)}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan" className="max-w-[150px] shrink-0 rounded-full bg-fg/10 px-3 py-2 text-[12.5px] font-medium outline-none">
          {SORTS.filter(([id]) => id !== 'most' || hasPlays).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {nothing && cat !== 'recent' && (
        <EmptyState icon={ListMusic} title="Pustakamu masih kosong" text="Buat playlist, sukai lagu, atau impor playlist dari Spotify." action={<div className="mt-5 flex gap-3"><PrimaryButton onClick={() => setCreate(true)}>Buat playlist</PrimaryButton><GhostButton onClick={() => navigate('search')}>Cari musik</GhostButton></div>} />
      )}

      {(cat === 'all' || cat === 'playlist') && !nothing && (
        <section className="px-4 md:px-0" aria-label="Playlist">
          {cat === 'all' && <SectionHeader title="Koleksi" className="px-0" />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {cat === 'all' && (
              <div>
                <button type="button" onClick={() => navigate('liked')} className="press focus-ring grid aspect-square w-full place-items-center rounded-2xl bg-gradient-to-br from-fg/30 to-fg/[0.04]" aria-label="Buka Lagu Disukai"><Heart size={42} className="fill-current" /></button>
                <div className="mt-2 text-[14.5px] font-medium">Lagu Disukai</div><div className="text-[12.5px] text-fg/55">{liked.length} lagu</div>
              </div>
            )}
            {sortedPlaylists.map((pl) => <PlaylistCard key={pl.id} pl={pl} onOpen={() => navigate('playlist', { id: pl.id })} onPlay={() => p.playTrack(pl.songs[0], pl.songs, 0, 'playlist')} />)}
            <div><button type="button" onClick={() => setCreate(true)} className="press focus-ring grid aspect-square w-full place-items-center rounded-2xl border border-dashed border-fg/25 text-fg/60 hover:text-fg" aria-label="Buat playlist baru"><Plus size={34} /></button><div className="mt-2 text-[14px] font-medium text-fg/70">Playlist baru</div></div>
          </div>
          {term && sortedPlaylists.length === 0 && <p className="py-6 text-center text-sm text-fg/50">Tidak ada playlist yang cocok.</p>}
        </section>
      )}

      {(cat === 'all' || cat === 'liked') && liked.length > 0 && (
        <section className={cn('mt-8', cat === 'liked' && 'mt-0')} aria-label="Lagu Disukai">
          <div className="mb-2 flex items-center justify-between px-4 md:px-0"><h2 className="font-display text-[17px] font-semibold">Lagu Disukai</h2>
            <div className="flex gap-2"><IconButton label="Putar semua" onClick={() => p.playTrack(sortedLiked[0], sortedLiked, 0, 'liked')} className="bg-fg text-bg hover:!bg-fg/90 hover:!text-bg"><Play size={17} fill="currentColor" className="ml-0.5" /></IconButton><IconButton label="Acak" onClick={() => p.playShuffled(sortedLiked, 'liked')} className="bg-fg/10"><Shuffle size={17} /></IconButton></div></div>
          <div className="px-2 md:px-0">{(cat === 'all' ? sortedLiked.slice(0, 5) : sortedLiked).map((t, i) => <TrackRow key={t.videoId || t.id} track={t} index={i} onPlay={() => p.playTrack(t, sortedLiked, i, 'liked')} />)}</div>
          {cat === 'all' && liked.length > 5 && <button type="button" onClick={() => navigate('liked')} className="press mx-4 mt-2 rounded-full bg-fg/10 px-4 py-2 text-[13px] font-semibold md:mx-0">Lihat semua {liked.length} lagu</button>}
        </section>
      )}
      {cat === 'liked' && liked.length === 0 && !nothing && <EmptyState icon={Heart} title="Belum ada lagu yang disukai" text="Ketuk ikon hati pada lagu untuk menyimpannya di sini." />}

      {(cat === 'all' || cat === 'artist') && artistList.length > 0 && (
        <section className="mt-8" aria-label="Artis"><SectionHeader title="Artis" />
          <div className={cn(cat === 'all' ? 'no-scrollbar flex gap-4 overflow-x-auto px-4 md:px-0' : 'grid grid-cols-3 gap-4 px-4 sm:grid-cols-4 md:grid-cols-5 md:px-0')}>
            {artistList.map((a) => <button key={a.artistId} type="button" onClick={() => openArtist(a)} className={cn('press focus-ring text-center', cat === 'all' && 'w-[100px] shrink-0')}><Cover src={a.cover || a.thumbnail} className="aspect-square w-full rounded-full" /><div className="mt-2 truncate text-[13.5px] font-medium">{a.name || a.title}</div></button>)}
          </div>
        </section>
      )}
      {cat === 'artist' && artists.length === 0 && <EmptyState title="Belum ada artis favorit" text="Buka halaman artis lalu ketuk ikon hati untuk menyimpannya." />}

      {(cat === 'all' || cat === 'recent') && (
        <section className={cn('mt-8', cat === 'recent' && 'mt-0')} aria-label="Baru diputar">
          <SectionHeader title="Baru Diputar" action="Riwayat lengkap" onAction={() => navigate('history')} />
          {groups.length === 0 ? <EmptyState icon={ListMusic} title="Belum ada riwayat" text="Lagu yang kamu dengarkan akan muncul di sini." className="py-8" /> : (
            <div className="px-2 md:px-0">{groups.slice(0, cat === 'all' ? 1 : 4).map((g) => (
              <div key={g.key} className="mb-4"><div className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wider text-fg/40">{g.label}</div>
                {g.items.slice(0, cat === 'all' ? 4 : 20).map((it) => { const t = { videoId: it.k, id: it.k, title: it.title, artist: it.artist, cover: it.cover, artistId: it.artistId }; return <TrackRow key={it.id} track={t} onPlay={() => p.playTrack(t, g.items.map((x) => ({ videoId: x.k, id: x.k, title: x.title, artist: x.artist, cover: x.cover, artistId: x.artistId })), g.items.indexOf(it), 'history')} />; })}
              </div>
            ))}</div>
          )}
        </section>
      )}

      <CreatePlaylistModal open={create} onClose={() => setCreate(false)} onSaved={(pl) => navigate('playlist', { id: pl.id })} />
      <SpotifyImportModal open={imp.open} resumeUrl={imp.url} onClose={(pl) => { setImp({ open: false, url: '' }); if (pl?.id) navigate('playlist', { id: pl.id }); }} />
    </div>
  );
}
