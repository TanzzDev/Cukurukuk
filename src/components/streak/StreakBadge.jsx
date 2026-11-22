import React from 'react';

const MAP = {
  ACTIVE: { label: 'ACTIVE', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', dot: 'bg-emerald-400' },
  DORMANT: { label: 'DORMANT', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30', dot: 'bg-amber-400' },
  EXPIRED: { label: 'EXPIRED', cls: 'text-red-400 bg-red-400/10 border-red-400/30', dot: 'bg-red-400' },
  NEW: { label: 'BELUM MULAI', cls: 'text-fg/60 bg-fg/5 border-fg/15', dot: 'bg-fg/40' },
};

export default function StreakBadge({ status = 'ACTIVE', className = '' }) {
  const m = MAP[status] || MAP.NEW;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-semibold tracking-[0.12em] ${m.cls} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
}
