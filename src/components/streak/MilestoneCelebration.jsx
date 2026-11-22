import React from 'react';
import { ackCelebrations, usePendingCelebrations, useStreak } from '../../services/listening';
import StreakFlame from './StreakFlame';
import { PrimaryButton } from '../ui';

/** Perayaan hanya untuk pencapaian yang BARU terjadi hari ini dan belum pernah dilihat; tidak muncul lagi setelah ditutup. */
export default function MilestoneCelebration({ enabled = true }) {
  const pending = usePendingCelebrations();
  const { streak } = useStreak();
  const c = pending[0];
  if (!enabled || !c) return null;
  const isRec = c.kind === 'recovered';
  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={isRec ? 'Api menyala kembali' : 'Milestone tercapai'}>
      <div className="absolute inset-0 bg-black/80 fade-in" onClick={() => ackCelebrations([c.id])} />
      <div className="pop-in relative w-full max-w-sm rounded-[28px] border border-fg/10 bg-card p-7 text-center shadow-2xl">
        <div className="mx-auto -mt-2 flex justify-center"><StreakFlame status="ACTIVE" days={isRec ? c.streak : c.days} size={132} burst /></div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/50">{isRec ? 'Api menyala kembali' : 'Milestone tercapai'}</div>
        <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight">{isRec ? `Streak ${c.streak} hari dipulihkan!` : c.name}</h2>
        <p className="mt-2 text-sm text-fg/60">
          {isRec ? `Kamu kembali setelah ${c.missedDays} hari. Streak sebelumnya tetap dipertahankan, hari aktif berikutnya melanjutkan perhitungan.` : `${c.days} hari berturut-turut. Achievement terbuka dan tanggalnya tersimpan.`}
        </p>
        <p className="mt-1 text-xs text-fg/40">Streak sekarang: {streak.current} hari</p>
        <PrimaryButton className="mt-6 w-full" onClick={() => ackCelebrations([c.id])}>Lanjut</PrimaryButton>
      </div>
    </div>
  );
}
