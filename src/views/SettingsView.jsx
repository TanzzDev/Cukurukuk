import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Gauge, Github, Globe, LogIn, LogOut, Moon, Pencil, SlidersHorizontal, Smartphone, Sun, Timer, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNav } from '../context/NavContext';
import { usePlayer } from '../context/PlayerContext';
import { clearHistory, deviceTz, useRules } from '../services/listening';
import Avatar from '../components/Avatar';
import ApkCard from '../components/ApkCard';
import ProfileEditModal from '../components/ProfileEditModal';
import { openAuth } from '../components/AuthSheet';
import { DrowifyMark } from '../components/brand/DrowifyMark';
import { ConfirmDialog, IconButton, PageHeader, Switch } from '../components/ui';

const Group = ({ title, children }) => (
  <section className="mt-7 px-4 md:px-0" aria-label={title}>
    <h2 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg/45">{title}</h2>
    <div className="overflow-hidden rounded-3xl border border-fg/10 bg-card">{children}</div>
  </section>
);
const Item = ({ icon: Icon, label, hint, right, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="press flex w-full items-center gap-4 border-b border-fg/[0.06] px-4 py-3.5 text-left last:border-0 hover:bg-fg/[0.03]">
      {Icon && <Icon size={19} className="shrink-0 text-fg/65" />}
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{label}</span>{hint && <span className="block text-[12.5px] text-fg/50">{hint}</span>}</span>
      {right}
    </Tag>
  );
};

function useInstall() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  return evt;
}

export default function SettingsView() {
  const { back } = useNav();
  const { profile, logout, features, config } = useApp();
  const p = usePlayer();
  const rules = useRules();
  const install = useInstall();
  const [edit, setEdit] = useState(false);
  const [wipe, setWipe] = useState(false);
  const light = p.theme === 'light';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const sync = !profile.isGuest && features.sync ? `Aktif (${config?.storage === 'upstash' ? 'database cloud' : config?.storage})` : profile.isGuest ? 'Nonaktif: data tamu hanya di perangkat ini' : 'Nonaktif: database server belum dikonfigurasi';
  return (
    <div className="pb-6">
      <header className="flex items-center gap-2 px-3 pt-3 pt-safe md:px-0"><IconButton label="Kembali" onClick={() => back('profile')}><ArrowLeft size={21} /></IconButton></header>
      <PageHeader title="Pengaturan" className="!pt-2" />

      <Group title="Akun">
        <div className="flex items-center gap-4 border-b border-fg/[0.06] px-4 py-4"><Avatar profile={profile} size={52} /><div className="min-w-0 flex-1"><div className="truncate text-[16px] font-semibold">{profile.name}</div><div className="truncate text-[12.5px] text-fg/55">{profile.isGuest ? 'Mode tamu' : profile.email}</div></div></div>
        {profile.isGuest ? (
          <Item icon={LogIn} label="Masuk dengan Google" hint={features.auth ? 'Simpan & sinkronkan data ke akunmu' : 'Belum dikonfigurasi di server ini'} onClick={features.auth ? openAuth : undefined} />
        ) : (
          <>
            <Item icon={Pencil} label="Edit profil" hint="Nama tampilan dan foto" onClick={() => setEdit(true)} />
            <Item icon={LogOut} label="Keluar" onClick={logout} />
          </>
        )}
        <Item label="Sinkronisasi" hint={sync} />
      </Group>

      <Group title="Pemutaran">
        <Item icon={SlidersHorizontal} label="Putar lagu berikutnya otomatis" right={<Switch checked={p.autoNext} onChange={p.setAutoNext} label="Putar berikutnya otomatis" />} />
        <Item icon={Gauge} label="Kecepatan pemutaran" hint={`${p.playbackRate}x`} onClick={() => p.setIsSpeedOpen(true)} />
        <Item icon={SlidersHorizontal} label="Ekualiser" hint={p.eqValues.preset} onClick={() => p.setIsEqualizerOpen(true)} />
        <Item icon={Timer} label="Timer tidur" hint={p.sleepSecondsLeft > 0 ? 'Aktif' : 'Mati'} onClick={() => p.setIsSleepTimerOpen(true)} />
        <div className="flex items-center gap-4 px-4 py-3.5"><span className="w-[19px]" /><span className="w-24 text-[15px] font-medium">Volume</span>
          <input type="range" aria-label="Volume" className="dw-range flex-1" min={0} max={1} step={0.01} value={Math.min(p.volume, 1)} style={{ '--pct': `${Math.min(p.volume, 1) * 100}%` }} onChange={(e) => p.setVolumeLevel(Number(e.target.value))} /></div>
      </Group>

      <Group title="Tampilan">
        <Item icon={light ? Sun : Moon} label="Tema" hint={light ? 'Terang' : 'Gelap'} right={<Switch checked={light} onChange={() => p.toggleTheme()} label="Tema terang" />} />
        <Item label="Latar warna dari sampul" right={<Switch checked={p.bgGlowEnabled} onChange={p.toggleBgGlow} label="Latar warna dari sampul" />} />
      </Group>

      <Group title="Aplikasi">
        <Item icon={Smartphone} label="Versi aplikasi" hint={`Drowify Music ${__APP_VERSION__}`} />
        <Item label="Aturan Drowify Streak" hint={`${rules.minPlays} pemutaran valid per hari • pemulihan ${rules.recoveryDays} hari • zona waktu ${deviceTz()}`} />
        {!standalone && <Item icon={Smartphone} label="Pasang sebagai aplikasi (PWA)" hint={install ? 'Tambahkan ke layar utama' : 'Gunakan menu browser: “Tambahkan ke layar utama”'} onClick={install ? () => install.prompt() : undefined} />}
        <Item icon={Trash2} label="Hapus riwayat dengar" hint="Streak dan rekor tidak berubah" onClick={() => setWipe(true)} />
      </Group>
      <section className="mt-4 px-4 md:px-0"><ApkCard /></section>

      <Group title="Tentang">
        <div className="flex items-center gap-4 border-b border-fg/[0.06] px-4 py-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-fg text-bg"><DrowifyMark size={26} /></span><div><div className="font-display text-[16px] font-semibold">Drowify Music</div><div className="text-[12.5px] text-fg/55">Streaming musik dengan lirik sinkron, antrean pintar, dan Drowify Streak.</div></div></div>
        <Item label="Developer" hint="Sulthan Nazirul Asrofi" />
        <a href="https://github.com/TanzzDev" target="_blank" rel="noopener noreferrer"><Item icon={Github} label="GitHub" hint="TanzzDev" right={<ExternalLink size={15} className="text-fg/40" />} /></a>
        <a href="https://sulthan-porto.web.id" target="_blank" rel="noopener noreferrer"><Item icon={Globe} label="Portofolio" hint="sulthan-porto.web.id" right={<ExternalLink size={15} className="text-fg/40" />} /></a>
      </Group>

      <ProfileEditModal open={edit} onClose={() => setEdit(false)} />
      <ConfirmDialog open={wipe} onClose={() => setWipe(false)} danger title="Hapus riwayat dengar?" text="Riwayat dan Teratas Saya dihapus. Drowify Streak, rekor, dan hari aktif tidak berubah." confirmLabel="Hapus" onConfirm={clearHistory} />
    </div>
  );
}
