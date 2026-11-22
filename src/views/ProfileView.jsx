import React, { useMemo, useState } from 'react';
import { ChevronRight, Clock, LogIn, LogOut, Pencil, Settings, TrendingUp, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNav } from '../context/NavContext';
import { useLiked, usePlaylists } from '../services/library';
import { useListening, useStreak } from '../services/listening';
import { listeningStats } from '../../shared/listening.js';
import { fmtMinutes } from '../lib/format';
import Avatar from '../components/Avatar';
import StreakCard from '../components/streak/StreakCard';
import AchievementBadge from '../components/streak/AchievementBadge';
import ProfileEditModal from '../components/ProfileEditModal';
import { openAuth } from '../components/AuthSheet';
import { ConfirmDialog, GhostButton, IconButton, PageHeader, PrimaryButton, SectionHeader } from '../components/ui';

function Row({ icon: Icon, label, hint, onClick }) {
  return (
    <button type="button" onClick={onClick} className="press focus-ring flex w-full items-center gap-4 border-b border-fg/[0.06] px-4 py-3.5 text-left last:border-0 hover:bg-fg/[0.04]">
      <Icon size={20} className="shrink-0 text-fg/70" />
      <span className="flex-1"><span className="block text-[15px] font-medium">{label}</span>{hint && <span className="block text-[12.5px] text-fg/50">{hint}</span>}</span>
      <ChevronRight size={18} className="text-fg/30" />
    </button>
  );
}

export default function ProfileView() {
  const { profile, logout, features, config } = useApp();
  const { navigate } = useNav();
  const state = useListening();
  const { streak } = useStreak();
  const playlists = usePlaylists();
  const liked = useLiked();
  const stats = useMemo(() => listeningStats(state, { rules: streak.rules }), [state, streak.rules]);
  const [edit, setEdit] = useState(false);
  const [out, setOut] = useState(false);
  const dash = (v, f = (x) => x) => (v ? f(v) : '–');
  const tiles = [
    ['Lagu diputar', dash(stats.totalPlays)], ['Lagu berbeda', dash(stats.uniqueTracks)],
    ['Waktu mendengarkan', dash(stats.totalSeconds, fmtMinutes)], ['Hari aktif', dash(stats.activeDays)],
    ['Playlist', dash(playlists.length)], ['Lagu disukai', dash(liked.length)],
    ['Streak saat ini', `${streak.current} hari`], ['Rekor streak', dash(streak.best, (x) => `${x} hari`)],
  ];
  return (
    <div className="pb-4">
      <PageHeader title="Kamu" right={<IconButton label="Pengaturan" onClick={() => navigate('settings')} className="bg-fg/[0.07]"><Settings size={20} /></IconButton>} />

      <section className="mx-4 rounded-3xl border border-fg/10 bg-card p-5 md:mx-0" aria-label="Profil">
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[20px] font-semibold">{profile.name}</h2>
            <p className="truncate text-[13px] text-fg/55">{profile.isGuest ? 'Mode tamu • data tersimpan di perangkat ini' : profile.email}</p>
          </div>
          {!profile.isGuest && <IconButton label="Edit profil" onClick={() => setEdit(true)} className="bg-fg/10"><Pencil size={18} /></IconButton>}
        </div>
        {profile.isGuest && (
          <div className="mt-4">
            {features.auth ? <PrimaryButton className="w-full" onClick={openAuth}><LogIn size={17} /> Masuk dengan Google</PrimaryButton>
              : <p className="rounded-xl bg-fg/[0.06] p-3 text-[12.5px] text-fg/60">{config?.offline ? 'Server tidak dapat dihubungi.' : 'Login Google belum dikonfigurasi di server ini.'} Kamu tetap bisa memakai semua fitur sebagai tamu.</p>}
          </div>
        )}
      </section>

      <div className="mt-4 px-4 md:px-0"><StreakCard /></div>

      <section className="mt-8 px-4 md:px-0" aria-label="Statistik">
        <SectionHeader title="Statistik musikmu" className="px-0" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {tiles.map(([a, b]) => <div key={a} className="rounded-2xl border border-fg/10 bg-card p-4"><div className="text-[12px] text-fg/50">{a}</div><div className="mt-1 font-display text-[18px] font-semibold">{b}</div></div>)}
        </div>
        <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
          <div className="rounded-2xl border border-fg/10 bg-card p-4"><div className="text-[12px] text-fg/50">Lagu paling sering diputar</div><div className="mt-1 truncate text-[15px] font-semibold">{stats.topTrack ? `${stats.topTrack.title} • ${stats.topTrack.plays}x` : '–'}</div><div className="truncate text-[12.5px] text-fg/50">{stats.topTrack?.artist}</div></div>
          <div className="rounded-2xl border border-fg/10 bg-card p-4"><div className="text-[12px] text-fg/50">Artis paling sering diputar</div><div className="mt-1 truncate text-[15px] font-semibold">{stats.topArtist ? `${stats.topArtist.artist} • ${stats.topArtist.plays}x` : '–'}</div></div>
        </div>
        {!stats.totalPlays && <p className="mt-3 text-[12.5px] text-fg/45">Statistik muncul setelah kamu mendengarkan lagu. Tidak ada data contoh.</p>}
      </section>

      <section className="mt-8 px-4 md:px-0" aria-label="Achievement">
        <SectionHeader title="Achievement" action={`${streak.completedCount}/${streak.milestones.length}`} onAction={() => navigate('streak')} className="px-0" />
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">{streak.milestones.slice(0, 8).map((m) => <div key={m.days} className="shrink-0"><AchievementBadge milestone={m} size={62} onClick={() => navigate('streak')} /></div>)}</div>
      </section>

      <section className="mx-4 mt-8 overflow-hidden rounded-3xl border border-fg/10 bg-card md:mx-0" aria-label="Menu">
        <Row icon={Clock} label="Riwayat mendengarkan" hint="Lagu yang benar-benar kamu putar" onClick={() => navigate('history')} />
        <Row icon={TrendingUp} label="Teratas Saya 50" hint="Berdasarkan pemutaran valid" onClick={() => navigate('top')} />
        <Row icon={Trophy} label="Drowify Streak" hint="Kalender, milestone, achievement" onClick={() => navigate('streak')} />
        <Row icon={Settings} label="Pengaturan" onClick={() => navigate('settings')} />
      </section>

      {!profile.isGuest && <div className="mt-6 px-4 md:px-0"><GhostButton className="w-full !text-red-300" onClick={() => setOut(true)}><LogOut size={16} /> Keluar</GhostButton></div>}
      <ProfileEditModal open={edit} onClose={() => setEdit(false)} />
      <ConfirmDialog open={out} onClose={() => setOut(false)} title="Keluar dari akun?" text="Data akunmu tetap aman di server. Setelah keluar, aplikasi memakai data tamu di perangkat ini." confirmLabel="Keluar" onConfirm={logout} />
    </div>
  );
}
