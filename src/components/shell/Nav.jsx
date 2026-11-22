import React from 'react';
import { Clock, Heart, Home, Library, Search, TrendingUp, User } from 'lucide-react';
import { useNav } from '../../context/NavContext';
import { useApp } from '../../context/AppContext';
import { useLiked, usePlaylists } from '../../services/library';
import { useStreak } from '../../services/listening';
import { DrowifyMark } from '../brand/DrowifyMark';
import StreakFlame from '../streak/StreakFlame';
import Avatar from '../Avatar';
import { cn } from '../ui';

export const NAV = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'search', label: 'Cari', icon: Search },
  { id: 'library', label: 'Pustaka', icon: Library },
  { id: 'profile', label: 'Kamu', icon: User },
];

/** Navigasi bawah (HP): pil melayang, indikator halaman aktif jelas, aman terhadap safe-area. */
export function BottomNav() {
  const { primary, navigate } = useNav();
  return (
    <nav aria-label="Navigasi utama" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 md:hidden">
      <ul className="pointer-events-auto mx-auto flex max-w-md items-center rounded-full border border-fg/10 bg-[var(--dock-bg)] p-1.5 shadow-2xl backdrop-blur-xl">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = primary === id;
          return (
            <li key={id} className="flex-1">
              <button type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(id)}
                className={cn('press focus-ring flex w-full flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition-colors', active ? 'bg-fg text-bg' : 'text-fg/60')}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />{label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideItem({ icon: Icon, label, active, onClick, badge, wide }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} title={label}
      className={cn('press focus-ring group flex w-full items-center rounded-xl text-[14.5px] font-medium transition-colors',
        wide ? 'gap-3.5 px-3.5 py-2.5' : 'flex-col gap-1 px-1 py-2.5 text-[10.5px]',
        active ? 'bg-fg text-bg' : 'text-fg/70 hover:bg-fg/[0.07] hover:text-fg')}>
      <Icon size={wide ? 20 : 22} className="shrink-0" />
      <span className={cn('truncate', wide && 'flex-1 text-left')}>{label}</span>
      {wide && badge}
    </button>
  );
}

/** Tablet: rail ikon 88px. Laptop (≥1024px): sidebar penuh dengan koleksi, playlist, dan Streak. */
export function Sidebar() {
  const { primary, route, navigate } = useNav();
  const { profile } = useApp();
  const playlists = usePlaylists();
  const liked = useLiked();
  const { streak } = useStreak();
  return (
    <aside aria-label="Sidebar" className="fixed bottom-[88px] left-0 top-0 z-30 hidden w-[88px] flex-col border-r border-fg/10 bg-bg md:flex lg:w-[248px]">
      <button type="button" onClick={() => navigate('home')} className="press focus-ring mx-auto mt-6 mb-5 flex items-center gap-3 rounded-xl p-2 lg:mx-4 lg:mt-7" aria-label="Drowify Music — Dashboard">
        <DrowifyMark size={30} />
        <span className="hidden font-display text-[15px] font-semibold tracking-[0.22em] lg:inline">DROWIFY</span>
      </button>
      <nav className="space-y-1 px-2 lg:px-3" aria-label="Navigasi utama">
        {NAV.map(({ id, label, icon }) => (
          <React.Fragment key={id}>
            <span className="lg:hidden"><SideItem icon={icon} label={label} active={primary === id} onClick={() => navigate(id)} /></span>
            <span className="hidden lg:block"><SideItem wide icon={icon} label={label} active={primary === id} onClick={() => navigate(id)} /></span>
          </React.Fragment>
        ))}
      </nav>
      <div className="mt-6 hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
        <div className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg/40">Koleksimu</div>
        <div className="space-y-0.5 px-3">
          <SideItem wide icon={Heart} label="Lagu Disukai" active={route.name === 'liked'} onClick={() => navigate('liked')} badge={<span className="text-xs tabular-nums opacity-60">{liked.length || ''}</span>} />
          <SideItem wide icon={Clock} label="Riwayat" active={route.name === 'history'} onClick={() => navigate('history')} />
          <SideItem wide icon={TrendingUp} label="Teratas Saya" active={route.name === 'top'} onClick={() => navigate('top')} />
          <button type="button" onClick={() => navigate('streak')} aria-current={route.name === 'streak' ? 'page' : undefined}
            className={cn('press focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-medium', route.name === 'streak' ? 'bg-fg text-bg' : 'text-fg/70 hover:bg-fg/[0.07] hover:text-fg')}>
            <span className="grid h-6 w-6 place-items-center"><StreakFlame status={streak.status} days={streak.current} size={20} /></span>
            <span className="flex-1 text-left">Drowify Streak</span>
            <span className="text-xs tabular-nums opacity-60">{streak.current || ''}</span>
          </button>
        </div>
        <div className="mt-5 px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg/40">Playlist</div>
        <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {playlists.length === 0 && <p className="px-3 py-2 text-[13px] text-fg/40">Belum ada playlist.</p>}
          {playlists.map((p) => (
            <button key={p.id} type="button" onClick={() => navigate('playlist', { id: p.id })} aria-current={route.name === 'playlist' && route.id === p.id ? 'page' : undefined}
              className={cn('press focus-ring flex w-full items-center gap-3 truncate rounded-lg px-3 py-2 text-left text-[14px]', route.name === 'playlist' && route.id === p.id ? 'bg-fg/[0.1] text-fg' : 'text-fg/65 hover:bg-fg/[0.06] hover:text-fg')}>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto p-3 lg:mt-0">
        <button type="button" onClick={() => navigate('profile')} className="press focus-ring flex w-full items-center justify-center gap-3 rounded-xl p-2 hover:bg-fg/[0.07] lg:justify-start" aria-label={`Profil ${profile.name}`}>
          <Avatar profile={profile} size={34} />
          <span className="hidden min-w-0 flex-1 text-left lg:block"><span className="block truncate text-[14px] font-semibold">{profile.name}</span><span className="block truncate text-[12px] text-fg/50">{profile.isGuest ? 'Mode tamu' : profile.email}</span></span>
        </button>
      </div>
    </aside>
  );
}
