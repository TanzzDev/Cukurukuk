import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Heart, ListPlus, ListStart, Pencil, Play, Plus, Search, Shuffle, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';
import { addSongToPlaylist, deleteUserPlaylist, moveSongInPlaylist, removeSongFromPlaylist, useLiked, usePlaylists } from '../services/library';
import { readStore, writeStore } from '../services/storage';
import { queueDurationSeconds } from '../../shared/queue';
import TrackRow from '../components/TrackRow';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import { ActionMenu, ConfirmDialog, Cover, EmptyState, GhostButton, IconButton, PlaylistCover, PrimaryButton, Sheet, SkelRow, fmtLong, cn } from '../components/ui';
import { fmtDateKey } from '../lib/format';

function AddSongsSheet({ pl, onClose }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState({ status: 'idle', songs: [] });
  const live = usePlaylists().find((x) => x.id === pl.id) || pl;
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setState({ status: 'idle', songs: [] }); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setState((s) => ({ ...s, status: 'loading' }));
      api(`/api/search?query=${encodeURIComponent(term)}&type=songs`, { signal: ctl.signal, timeout: 15000 })
        .then((r) => setState({ status: 'ready', songs: r?.result?.songs || [] }))
        .catch(() => { if (!ctl.signal.aborted) setState({ status: 'error', songs: [] }); });
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  return (
    <Sheet open onClose={onClose} title="Tambah Lagu" wide z={215} className="md:h-[78vh]">
      <div className="px-5 pb-3"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari lagu untuk ditambahkan" aria-label="Cari lagu" className="h-11 w-full rounded-full border border-fg/10 bg-fg/[0.06] pl-11 pr-4 text-[14.5px] outline-none placeholder:text-fg/40 focus:border-fg/40" /></div></div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {state.status === 'loading' && Array.from({ length: 5 }, (_, i) => <SkelRow key={i} />)}
        {state.status === 'error' && <p className="px-4 py-8 text-center text-sm text-fg/55">Pencarian gagal. Coba lagi.</p>}
        {state.status === 'ready' && state.songs.length === 0 && <p className="px-4 py-8 text-center text-sm text-fg/55">Tidak ada hasil.</p>}
        {state.status === 'idle' && <p className="px-4 py-8 text-center text-sm text-fg/45">Ketik minimal 2 huruf untuk mencari.</p>}
        {state.songs.map((t) => {
          const has = live.songs.some((s) => (s.videoId || s.id) === t.videoId);
          return (
            <div key={t.videoId} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-fg/[0.05]">
              <Cover track={t} className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1"><div className="truncate text-[14.5px] font-medium">{t.title}</div><div className="truncate text-[12.5px] text-fg/55">{t.artist}</div></div>
              <button type="button" disabled={has} onClick={() => addSongToPlaylist(pl.id, t)} aria-label={has ? 'Sudah di playlist' : `Tambahkan ${t.title}`} className={cn('press grid h-9 w-9 place-items-center rounded-full', has ? 'bg-fg/10 text-emerald-400' : 'bg-fg/10 hover:bg-fg hover:text-bg')}>{has ? <Check size={17} /> : <Plus size={17} />}</button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

const SORTS = [['manual', 'Urutan saya'], ['az', 'Judul A–Z'], ['artist', 'Artis A–Z']];

export default function PlaylistView({ likedMode = false }) {
  const { route, back, navigate } = useNav();
  const { profile } = useApp();
  const p = usePlayer();
  const playlists = usePlaylists();
  const liked = useLiked();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState('manual');
  const pl = likedMode ? { id: 'liked', name: 'Lagu Disukai', description: 'Lagu yang kamu sukai di Drowify.', songs: liked, image: '', createdAt: 0 } : playlists.find((x) => x.id === route.id);

  const rows = useMemo(() => {
    if (!pl) return [];
    const list = pl.songs.map((s, i) => ({ s, i }));
    if (sort === 'az') list.sort((a, b) => a.s.title.localeCompare(b.s.title, 'id'));
    if (sort === 'artist') list.sort((a, b) => (a.s.artist || '').localeCompare(b.s.artist || '', 'id'));
    return list;
  }, [pl, sort]);

  if (!pl) {
    return <div className="pt-16"><EmptyState title="Playlist tidak ditemukan" text="Playlist ini mungkin sudah dihapus." action={<PrimaryButton className="mt-5" onClick={() => navigate('library')}>Ke Pustaka</PrimaryButton>} /></div>;
  }
  const songs = pl.songs;
  const dur = queueDurationSeconds(songs);
  const markPlayed = () => writeStore('playlist_played', { ...readStore('playlist_played', {}), [pl.id]: Date.now() });
  const play = (list, i) => { markPlayed(); p.playTrack(list[i], list, i, 'playlist'); };
  const manual = sort === 'manual' && !likedMode;

  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 px-3 py-3 pt-safe md:px-0"><IconButton label="Kembali" onClick={() => back('library')}><ArrowLeft size={21} /></IconButton></header>
      <section className="flex flex-col items-center gap-5 px-4 pb-5 text-center md:flex-row md:items-end md:gap-8 md:px-0 md:text-left">
        <div className="w-[200px] shrink-0 overflow-hidden rounded-3xl shadow-2xl md:w-[220px]">
          {likedMode ? <div className="grid aspect-square place-items-center bg-gradient-to-br from-fg/30 to-fg/5"><Heart size={64} className="fill-current" /></div> : <PlaylistCover pl={pl} />}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/45">{likedMode ? 'Koleksi' : pl.source === 'spotify' ? 'Playlist • Diimpor dari Spotify' : 'Playlist'}</div>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight md:text-[40px]">{pl.name}</h1>
          {pl.description && <p className="mt-2 max-w-xl text-[14px] text-fg/60">{pl.description}</p>}
          <p className="mt-2 text-[13px] text-fg/50">{profile.name} • {songs.length} lagu{dur ? ` • ${fmtLong(dur)}` : ''}{pl.createdAt ? ` • dibuat ${fmtDateKey(new Date(pl.createdAt).toISOString().slice(0, 10))}` : ''}</p>
        </div>
      </section>

      <div className="flex items-center justify-center gap-2.5 px-4 pb-4 md:justify-start md:px-0">
        <PrimaryButton onClick={() => play(songs, 0)} disabled={!songs.length}><Play size={18} fill="currentColor" /> Putar</PrimaryButton>
        <GhostButton className="!h-11" onClick={() => { markPlayed(); p.playShuffled(songs, 'playlist'); }} disabled={!songs.length}><Shuffle size={16} /> Acak</GhostButton>
        {!likedMode && <IconButton label="Ubah playlist" onClick={() => setEdit(true)} className="bg-fg/10"><Pencil size={18} /></IconButton>}
        {!likedMode && <IconButton label="Tambah lagu" onClick={() => setAdding(true)} className="bg-fg/10"><Plus size={20} /></IconButton>}
        <ActionMenu label="Menu playlist" className="bg-fg/10" items={[
          { label: 'Tambahkan semua ke Antrean', icon: ListPlus, onClick: () => p.addToQueue(songs), disabled: !songs.length },
          { label: 'Putar semua berikutnya', icon: ListStart, onClick: () => p.playNextInQueue(songs), disabled: !songs.length },
          !likedMode && { label: 'Hapus Playlist', icon: Trash2, danger: true, onClick: () => setDel(true) },
        ]} />
      </div>

      {songs.length > 1 && (
        <div className="flex justify-end px-4 pb-2 md:px-0">
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan lagu" className="rounded-full bg-fg/10 px-3 py-1.5 text-[12.5px] font-medium outline-none">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}

      <div className="px-2 md:px-0">
        {songs.length === 0 ? (
          <EmptyState icon={Plus} title="Playlist ini masih kosong" text="Tambahkan lagu dengan tombol + di atas atau dari menu tiga titik pada lagu mana pun." action={!likedMode && <PrimaryButton className="mt-5" onClick={() => setAdding(true)}>Tambah lagu</PrimaryButton>} />
        ) : rows.map(({ s, i }, pos) => (
          <TrackRow key={`${i}-${s.videoId || s.id}`} index={pos} track={s} onPlay={() => play(sort === 'manual' ? songs : rows.map((r) => r.s), sort === 'manual' ? i : pos)}
            extraMenu={likedMode ? [] : [
              manual && i > 0 && { label: 'Naikkan', icon: ArrowUp, onClick: () => moveSongInPlaylist(pl.id, i, i - 1) },
              manual && i < songs.length - 1 && { label: 'Turunkan', icon: ArrowDown, onClick: () => moveSongInPlaylist(pl.id, i, i + 1) },
              { label: 'Hapus dari Playlist', icon: Trash2, danger: true, onClick: () => removeSongFromPlaylist(pl.id, i) },
            ]} />
        ))}
      </div>

      {!likedMode && <CreatePlaylistModal open={edit} onClose={() => setEdit(false)} playlist={pl} />}
      {adding && <AddSongsSheet pl={pl} onClose={() => setAdding(false)} />}
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Hapus playlist?" text={`"${pl.name}" akan dihapus dari pustakamu. Lagu aslinya tidak terpengaruh.`} confirmLabel="Hapus" onConfirm={() => { deleteUserPlaylist(pl.id); navigate('library'); }} />
    </div>
  );
}
