import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Heart, Play, RefreshCw, Search, Shuffle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNav } from '../context/NavContext';
import { usePlayer, useProgress } from '../context/PlayerContext';
import { api } from '../services/api';
import { useLiked, usePlaylists } from '../services/library';
import { useListening, useStreak } from '../services/listening';
import { listeningStats, recentTracks, topTracks } from '../../shared/listening.js';
import { trackId } from '../../shared/queue';
import Avatar from '../components/Avatar';
import StreakCard from '../components/streak/StreakCard';
import TrackRow, { AddQueueButton } from '../components/TrackRow';
import { Cover, EmptyState, GhostButton, IconButton, PlaylistCover, PrimaryButton, SectionHeader, Shelf, SkelCard, Spinner, cn } from '../components/ui';

const greet = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
};

let homeCache = null;
function useHome() {
  const fresh = homeCache && Date.now() - homeCache.t < 5 * 60 * 1000;
  const [s, setS] = useState({ status: fresh ? 'ready' : 'loading', data: fresh ? homeCache.data : null, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (fresh && tick === 0) return undefined;
    const ctl = new AbortController();
    setS((p) => ({ ...p, status: 'loading', error: '' }));
    api('/api/home', { signal: ctl.signal, timeout: 20000 })
      .then((r) => { homeCache = { t: Date.now(), data: r.result }; setS({ status: 'ready', data: r.result, error: '' }); })
      .catch((e) => { if (!ctl.signal.aborted) setS({ status: 'error', data: null, error: e.message }); });
    return () => ctl.abort();
  }, [tick]);
  return { ...s, retry: () => setTick((t) => t + 1) };
}

// Rekomendasi "berdasarkan yang sering kamu dengar": lagu dari artis yang benar-benar sering diputar (riwayat nyata)
const artistCache = new Map();
function useArtistSongs(names) {
  const key = names.join('|');
  const [state, setState] = useState({ status: names.length ? 'loading' : 'idle', items: [] });
  useEffect(() => {
    if (!names.length) { setState({ status: 'idle', items: [] }); return undefined; }
    const ctl = new AbortController();
    (async () => {
      try {
        const lists = await Promise.all(names.map(async (n) => {
          if (artistCache.has(n)) return artistCache.get(n);
          const r = await api(`/api/search?query=${encodeURIComponent(n)}&type=songs`, { signal: ctl.signal, timeout: 15000 });
          const songs = (r?.result?.songs || []).slice(0, 8);
          artistCache.set(n, songs);
          return songs;
        }));
        const seen = new Set();
        const items = [];
        for (let i = 0; items.length < 14 && i < 8; i++) for (const l of lists) { const t = l[i]; if (t && !seen.has(t.videoId)) { seen.add(t.videoId); items.push(t); } }
        setState({ status: 'ready', items });
      } catch (_) { if (!ctl.signal.aborted) setState({ status: 'error', items: [] }); }
    })();
    return () => ctl.abort();
  }, [key]);
  return state;
}

function TrackCard({ track, list, index, source }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const active = currentTrack && trackId(currentTrack) === trackId(track);
  return (
    <div className="group w-[140px] shrink-0 snap-start md:w-[164px]">
      <div className="relative">
        <button type="button" onClick={() => playTrack(track, list, index, source)} aria-label={`Putar ${track.title}`} className="press focus-ring block w-full overflow-hidden rounded-2xl">
          <Cover track={track} hd className={cn('aspect-square w-full', active && isPlaying && 'opacity-80')} />
        </button>
        <div className="absolute bottom-2 right-2"><AddQueueButton track={track} className="bg-black/60 text-white backdrop-blur hover:!bg-white hover:!text-black" /></div>
      </div>
      <div className="mt-2 truncate text-[14px] font-medium">{track.title}</div>
      <div className="truncate text-[12.5px] text-fg/55">{track.artist}</div>
    </div>
  );
}

function ContinueCard() {
  const { currentTrack, isPlaying, isLoading, togglePlay, setIsFullPlayerOpen } = usePlayer();
  const { currentTime, duration } = useProgress();
  if (!currentTrack) return null;
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="mx-4 flex items-center gap-4 rounded-3xl border border-fg/10 bg-card p-3 md:mx-0">
      <button type="button" onClick={() => setIsFullPlayerOpen(true)} className="focus-ring shrink-0 rounded-2xl" aria-label="Buka pemutar"><Cover track={currentTrack} hd className="h-16 w-16 rounded-2xl" /></button>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg/45">Lanjutkan mendengarkan</div>
        <div className="truncate text-[15px] font-semibold">{currentTrack.title}</div>
        <div className="truncate text-[12.5px] text-fg/55">{currentTrack.artist}</div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} /></div>
      </div>
      <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Jeda' : 'Lanjutkan'} className="press focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fg text-bg">
        {isLoading ? <Spinner size={20} /> : isPlaying ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <Play size={20} fill="currentColor" className="ml-0.5" />}
      </button>
    </div>
  );
}

const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
};

export default function HomeView() {
  const { profile } = useApp();
  const { navigate } = useNav();
  const p = usePlayer();
  const liked = useLiked();
  const playlists = usePlaylists();
  const state = useListening();
  const { streak } = useStreak();
  const home = useHome();

  const recents = useMemo(() => recentTracks(state, 12), [state]);
  const stats = useMemo(() => listeningStats(state, { rules: streak.rules }), [state, streak.rules]);
  const top = useMemo(() => topTracks(state, { range: 'all', limit: 5 }), [state]);
  const favNames = useMemo(() => stats.topArtists.slice(0, 2).map((a) => a.artist), [stats]);
  const mix = useArtistSongs(favNames);
  const hasHistory = recents.length > 0;

  const tiles = [
    { key: 'liked', title: 'Lagu Disukai', sub: `${liked.length} lagu`, icon: Heart, onClick: () => navigate('liked') },
    ...playlists.slice(0, 3).map((pl) => ({ key: pl.id, title: pl.name, sub: `${pl.songs.length} lagu`, pl, onClick: () => navigate('playlist', { id: pl.id }) })),
    ...recents.slice(0, 3).map((t, i) => ({ key: `r${t.id}`, title: t.title, sub: t.artist, track: t, onClick: () => p.playTrack(t, recents, i, 'recent') })),
  ].slice(0, 6);

  const picks = home.data?.quickPicks || [];
  return (
    <div className="pb-4">
      <header className="flex items-center justify-between gap-3 px-4 pb-4 pt-5 pt-safe md:px-0 md:pt-8">
        <div className="min-w-0">
          <p className="text-[13px] text-fg/55">{greet()},</p>
          <h1 className="truncate font-display text-[24px] font-semibold leading-tight md:text-[30px]">{profile.isGuest ? 'Selamat datang' : profile.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Cari musik" onClick={() => navigate('search')} className="bg-fg/[0.07]"><Search size={20} /></IconButton>
          <button type="button" onClick={() => navigate('profile')} aria-label="Buka profil" className="press focus-ring rounded-full"><Avatar profile={profile} size={42} /></button>
        </div>
      </header>

      <section aria-label="Akses cepat" className="px-4 md:px-0">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {tiles.map((t) => (
            <button key={t.key} type="button" onClick={t.onClick} className="press focus-ring flex items-center gap-3 overflow-hidden rounded-2xl bg-fg/[0.07] text-left hover:bg-fg/[0.11]">
              <div className="h-14 w-14 shrink-0 overflow-hidden bg-fg/10">
                {t.icon ? <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fg/25 to-fg/5"><t.icon size={22} /></div> : t.pl ? <PlaylistCover pl={t.pl} className="h-full w-full" /> : <Cover track={t.track} className="h-full w-full" />}
              </div>
              <div className="min-w-0 pr-2"><div className="truncate text-[13.5px] font-semibold">{t.title}</div><div className="truncate text-[11.5px] text-fg/50">{t.sub}</div></div>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 space-y-3"><ContinueCard /><div className="px-4 md:px-0"><StreakCard /></div></div>

      {!hasHistory && (
        <div className="mx-4 mt-6 rounded-3xl border border-dashed border-fg/15 p-2 md:mx-0">
          <EmptyState icon={Play} title="Mulai dengarkan musik" text="Belum ada riwayat. Setelah kamu mendengarkan, rekomendasi, Teratas Saya, dan statistikmu muncul di sini." action={<PrimaryButton className="mt-5" onClick={() => navigate('search')}>Cari lagu</PrimaryButton>} />
        </div>
      )}

      {hasHistory && (
        <section className="mt-8" aria-label="Baru diputar">
          <SectionHeader title="Baru diputar" action="Riwayat lengkap" onAction={() => navigate('history')} />
          <Shelf>{recents.map((t, i) => <div key={t.id} className="relative"><TrackCard track={t} list={recents} index={i} source="recent" /><div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg/40"><Clock size={11} />{ago(t.playedAt)}</div></div>)}</Shelf>
        </section>
      )}

      {hasHistory && favNames.length > 0 && (
        <section className="mt-8" aria-label="Berdasarkan yang sering kamu dengar">
          <SectionHeader title="Berdasarkan yang sering kamu dengar" />
          <p className="-mt-2 mb-3 px-4 text-[12.5px] text-fg/45 md:px-0">Lagu dari {favNames.join(' dan ')}, artis yang paling sering kamu putar.</p>
          {mix.status === 'loading' && <Shelf>{Array.from({ length: 5 }, (_, i) => <SkelCard key={i} className="w-[140px] md:w-[164px]" />)}</Shelf>}
          {mix.status === 'error' && <p className="px-4 text-sm text-fg/50 md:px-0">Rekomendasi belum dapat dimuat.</p>}
          {mix.status === 'ready' && mix.items.length > 0 && <Shelf>{mix.items.map((t, i) => <TrackCard key={t.videoId} track={t} list={mix.items} index={i} source="mix" />)}</Shelf>}
        </section>
      )}

      {stats.topArtists.length > 0 && (
        <section className="mt-8" aria-label="Artis favoritmu">
          <SectionHeader title="Artis favoritmu" />
          <Shelf>{stats.topArtists.slice(0, 8).map((a) => (
            <button key={a.artist} type="button" onClick={() => navigate('search', { q: a.artist })} className="press focus-ring w-[104px] shrink-0 snap-start text-center md:w-[120px]">
              <div className="mx-auto grid aspect-square w-full place-items-center rounded-full bg-gradient-to-br from-fg/20 to-fg/[0.04] font-display text-2xl font-semibold">{a.artist.slice(0, 1).toUpperCase()}</div>
              <div className="mt-2 truncate text-[13px] font-medium">{a.artist}</div><div className="text-[11.5px] text-fg/45">{a.plays}x diputar</div>
            </button>
          ))}</Shelf>
        </section>
      )}

      <section className="mt-8" aria-label="Playlistmu">
        <SectionHeader title="Playlistmu" action={playlists.length ? 'Lihat semua' : undefined} onAction={() => navigate('library')} />
        {playlists.length === 0 ? (
          <div className="mx-4 flex items-center gap-4 rounded-2xl bg-fg/[0.05] p-4 md:mx-0"><p className="flex-1 text-sm text-fg/60">Kamu belum punya playlist. Buat satu atau impor dari Spotify di Pustaka.</p><GhostButton onClick={() => navigate('library')}>Ke Pustaka</GhostButton></div>
        ) : (
          <Shelf>{playlists.map((pl) => (
            <div key={pl.id} className="group w-[140px] shrink-0 snap-start md:w-[164px]">
              <div className="relative">
                <button type="button" onClick={() => navigate('playlist', { id: pl.id })} className="press focus-ring block w-full overflow-hidden rounded-2xl" aria-label={`Buka playlist ${pl.name}`}><PlaylistCover pl={pl} /></button>
                {pl.songs.length > 0 && (
                  <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <IconButton label={`Acak ${pl.name}`} onClick={() => p.playShuffled(pl.songs, 'playlist')} className="h-9 w-9 bg-black/60 text-white backdrop-blur"><Shuffle size={15} /></IconButton>
                    <IconButton label={`Putar ${pl.name}`} onClick={() => p.playTrack(pl.songs[0], pl.songs, 0, 'playlist')} className="h-9 w-9 bg-white text-black hover:!bg-white"><Play size={16} fill="currentColor" className="ml-0.5" /></IconButton>
                  </div>
                )}
              </div>
              <div className="mt-2 truncate text-[14px] font-medium">{pl.name}</div><div className="text-[12.5px] text-fg/55">{pl.songs.length} lagu</div>
            </div>
          ))}</Shelf>
        )}
      </section>

      {top.length > 0 && (
        <section className="mt-8 px-4 md:px-0" aria-label="Teratas saya">
          <SectionHeader title="Teratas Saya" action="Lihat Semua" onAction={() => navigate('top')} className="px-0" />
          <div className="-mx-2">{top.map((t) => <TrackRow key={t.id} rank={t.rank} track={{ ...t, videoId: t.id }} sub={`${t.artist} • ${t.plays}x diputar`} onPlay={() => p.playTrack({ ...t, videoId: t.id }, top.map((x) => ({ ...x, videoId: x.id })), t.rank - 1, 'top')} />)}</div>
        </section>
      )}

      <section className="mt-8" aria-label="Pilihan musik">
        <SectionHeader title={hasHistory ? 'Pilihan populer' : 'Populer untuk memulai'} />
        {home.status === 'loading' && <Shelf>{Array.from({ length: 6 }, (_, i) => <SkelCard key={i} className="w-[140px] md:w-[164px]" />)}</Shelf>}
        {home.status === 'error' && (
          <div className="mx-4 flex flex-col items-center gap-3 rounded-2xl bg-fg/[0.05] p-6 text-center md:mx-0"><p className="text-sm text-fg/60">Konten musik belum dapat dimuat. {home.error}</p><GhostButton onClick={home.retry}><RefreshCw size={15} /> Coba lagi</GhostButton></div>
        )}
        {home.status === 'ready' && picks.length > 0 && <Shelf>{picks.slice(0, 14).map((t, i) => <TrackCard key={t.videoId} track={t} list={picks} index={i} source="home" />)}</Shelf>}
        {home.status === 'ready' && (home.data?.trending || []).length > 0 && (
          <div className="mt-8"><SectionHeader title="Sedang tren" /><div className="grid gap-x-6 px-4 md:grid-cols-2 md:px-0">{home.data.trending.slice(0, 8).map((t, i) => <TrackRow key={t.videoId} track={t} index={i} onPlay={() => p.playTrack(t, home.data.trending, i, 'home')} />)}</div></div>
        )}
        {home.status === 'ready' && (home.data?.albums || []).length > 0 && (
          <div className="mt-8"><SectionHeader title="Album" /><Shelf>{home.data.albums.slice(0, 12).map((al) => (
            <button key={al.id} type="button" onClick={() => p.setActiveAlbum({ id: al.id, cover: al.cover })} className="press focus-ring w-[140px] shrink-0 snap-start text-left md:w-[164px]"><Cover src={al.cover} className="aspect-square w-full rounded-2xl" /><div className="mt-2 truncate text-[14px] font-medium">{al.title}</div><div className="truncate text-[12.5px] text-fg/55">{al.artist}</div></button>
          ))}</Shelf></div>
        )}
      </section>
    </div>
  );
}
