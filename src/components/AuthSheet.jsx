import React from 'react';
import { Cloud, History, ListMusic } from 'lucide-react';
import { emit } from '../services/bus';
import { useApp } from '../context/AppContext';
import { GhostButton, Sheet } from './ui';
import GoogleButton from './GoogleButton';
import { DrowifyMark } from './brand/DrowifyMark';

export const openAuth = () => emit('auth:open');

export default function AuthSheet({ open, onClose }) {
  const { features, config } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Masuk ke Drowify" z={240}>
      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-fg text-bg"><DrowifyMark size={34} /></div>
        <p className="text-[14.5px] text-fg/70">Simpan playlist, riwayat, Top 50, dan Drowify Streak ke akunmu dan buka di perangkat mana pun.</p>
        <ul className="mx-auto mt-4 max-w-xs space-y-2.5 text-left text-[13.5px] text-fg/70">
          <li className="flex items-center gap-3"><ListMusic size={17} className="shrink-0" /> Playlist & lagu disukai tersinkron</li>
          <li className="flex items-center gap-3"><History size={17} className="shrink-0" /> Riwayat & statistik tersimpan</li>
          <li className="flex items-center gap-3"><Cloud size={17} className="shrink-0" /> Streak aman dan terikat akunmu</li>
        </ul>
        <div className="mt-6">
          {features.auth ? <GoogleButton onSuccess={onClose} /> : (
            <p className="rounded-2xl bg-fg/[0.06] p-4 text-[13px] text-fg/65">{config?.offline ? 'Server tidak dapat dihubungi saat ini.' : 'Login Google belum dikonfigurasi di server ini (GOOGLE_CLIENT_ID, SESSION_SECRET, dan database).'} Kamu tetap bisa memakai Drowify sebagai tamu.</p>
          )}
        </div>
        <GhostButton className="mt-5 w-full" onClick={onClose}>Lanjut sebagai tamu</GhostButton>
        <p className="mt-3 text-[11.5px] text-fg/40">Data tamu tetap di perangkat ini dan tidak otomatis digabung ke akun.</p>
      </div>
    </Sheet>
  );
}
