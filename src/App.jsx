import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import { useNav } from './context/NavContext';
import { usePlayer } from './context/PlayerContext';
import { useMediaQuery } from './hooks/useMedia';
import { emit, on } from './services/bus';
import { finishLogin, setResume } from './services/spotify';
import LoadingScreen from './components/LoadingScreen';
import { BottomNav, Sidebar } from './components/shell/Nav';
import { MiniPlayer, PlayerBar } from './components/shell/Players';
import ToastHost from './components/ToastHost';
import QueueHost from './components/QueuePanel';
import MixSheet from './components/MixSheet';
import TrackDetailSheet from './components/TrackDetailSheet';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import AuthSheet from './components/AuthSheet';
import MergeGuestModal from './components/MergeGuestModal';
import MilestoneCelebration from './components/streak/MilestoneCelebration';
import FullPlayer from './components/FullPlayer';
import LyricsOverlay from './components/LyricsOverlay';
import EqualizerModal from './components/EqualizerModal';
import SleepTimerModal from './components/SleepTimerModal';
import SpeedModal from './components/SpeedModal';
import ShareCardModal from './components/ShareCardModal';
import ArtistModal from './components/ArtistModal';
import AlbumModal from './components/AlbumModal';
import HomeView from './views/HomeView';
import SearchView from './views/SearchView';
import LibraryView from './views/LibraryView';
import PlaylistView from './views/PlaylistView';
import ProfileView from './views/ProfileView';
import { cn } from './components/ui';

// Halaman yang jarang dibuka dimuat saat diperlukan (bundle awal lebih ringan).
const StreakView = lazy(() => import('./views/StreakView'));
const HistoryView = lazy(() => import('./views/HistoryView'));
const TopView = lazy(() => import('./views/TopView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

const TITLES = { home: 'Dashboard', search: 'Cari', library: 'Pustaka', profile: 'Kamu', streak: 'Drowify Streak', history: 'Riwayat', top: 'Teratas Saya', liked: 'Lagu Disukai', settings: 'Pengaturan', playlist: 'Playlist' };
const VIEWS = { home: HomeView, search: SearchView, library: LibraryView, profile: ProfileView, streak: StreakView, history: HistoryView, top: TopView, settings: SettingsView };

const PageFallback = () => (
  <div className="space-y-4 px-4 pt-10 md:px-0" aria-busy="true"><div className="skel h-8 w-40 rounded-lg" /><div className="skel h-28 w-full rounded-3xl" /><div className="skel h-28 w-full rounded-3xl" /></div>
);

export default function App() {
  const { ready } = useApp();
  const { route, navigate } = useNav();
  const { isQueueOpen, isFullPlayerOpen, activeArtist, activeAlbum } = usePlayer();
  const xl = useMediaQuery('(min-width: 1280px)');
  const [splashDone, setSplashDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => on('auth:open', () => setAuthOpen(true)), []);
  useEffect(() => { document.title = route.name === 'home' ? 'Drowify Music' : `${TITLES[route.name] || 'Drowify'} • Drowify Music`; }, [route.name]);

  // Callback OAuth Spotify (PKCE): tukar kode, lalu lanjutkan import di Pustaka.
  useEffect(() => {
    if (!route.spotifyCallback) return;
    (async () => {
      try { const resume = await finishLogin(window.location.search); if (resume) setResume(resume); }
      catch (e) { emit('toast', e.message || 'Login Spotify gagal.'); }
      finally { navigate('library'); }
    })();
  }, [route.spotifyCallback]);

  let view;
  if (route.name === 'playlist') view = <PlaylistView key={route.id} />;
  else if (route.name === 'liked') view = <PlaylistView likedMode />;
  else { const V = VIEWS[route.name] || HomeView; view = <V />; }
  const docked = isQueueOpen && xl && !isFullPlayerOpen;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">Lewati ke konten</a>
      {!splashDone && <LoadingScreen ready={ready} onDone={() => setSplashDone(true)} />}
      <Sidebar />
      <main id="main" className={cn('pb-[calc(env(safe-area-inset-bottom)+190px)] md:pb-[130px] md:pl-[88px] lg:pl-[248px]', docked && 'xl:pr-[380px]')}>
        <div className="mx-auto w-full max-w-[1120px] md:px-8 lg:px-10">
          <Suspense fallback={<PageFallback />}><div key={`${route.name}${route.id || ''}`} className="fade-in">{view}</div></Suspense>
        </div>
      </main>
      <MiniPlayer />
      <PlayerBar />
      <BottomNav />

      <FullPlayer />
      <LyricsOverlay />
      <QueueHost />
      <MixSheet />
      <TrackDetailSheet />
      <AddToPlaylistModal />
      <EqualizerModal />
      <SleepTimerModal />
      <SpeedModal />
      <ShareCardModal />
      {activeArtist && <ArtistModal />}
      {activeAlbum && <AlbumModal />}
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <MergeGuestModal />
      <MilestoneCelebration enabled={splashDone} />
      <ToastHost />
    </div>
  );
}
