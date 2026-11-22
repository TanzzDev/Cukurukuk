import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNav } from '../../context/NavContext';
import { useStreak } from '../../services/listening';
import { statusCopy } from '../../lib/format';
import StreakFlame from './StreakFlame';
import StreakBadge from './StreakBadge';
import { cn } from '../ui';

/** Kartu Drowify Streak di Dashboard & Kamu: data dari SATU sumber (useStreak), seluruh kartu dapat ditekan. */
export default function StreakCard({ className = '' }) {
  const { navigate } = useNav();
  const { streak } = useStreak(60000);
  const copy = statusCopy(streak);
  const p = streak.progress;
  const lit = streak.status === 'ACTIVE';
  return (
    <button type="button" onClick={() => navigate('streak')} aria-label={`Drowify Streak: ${streak.current} hari, ${streak.status}. Buka detail.`}
      className={cn('press focus-ring group relative w-full overflow-hidden rounded-3xl border border-fg/10 bg-card p-4 text-left transition-colors hover:bg-fg/[0.04] md:p-5', className)}>
      {lit && <div className="pointer-events-none absolute -left-10 top-0 h-full w-48 bg-[radial-gradient(closest-side,rgba(255,122,26,.22),transparent)]" aria-hidden="true" />}
      <div className="relative flex items-center gap-4">
        <div className="shrink-0"><StreakFlame status={streak.status} days={streak.current} size={72} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg/50">Drowify Streak</span>
            <StreakBadge status={streak.status} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[34px] font-semibold leading-none tabular-nums">{streak.current}</span>
            <span className="text-sm font-medium text-fg/60">hari</span>
            <span className="ml-auto hidden text-xs text-fg/45 sm:block">Rekor {streak.best} hari</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg/65">
            {streak.status === 'DORMANT' && streak.recovery ? `${copy.title} ${copy.text} Tersisa ${streak.recovery.daysLeft} hari.` : `${copy.title} ${copy.text}`}
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-fg/30 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      {lit && streak.nextMilestone && (
        <div className="relative mt-4">
          <div className="mb-1.5 flex justify-between text-[12px] text-fg/55">
            <span>Berikutnya: {p.to} hari</span><span>sisa {p.remaining} hari</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#ffb02e] transition-[width] duration-700" style={{ width: `${Math.max(3, p.percent)}%` }} />
          </div>
        </div>
      )}
    </button>
  );
}
