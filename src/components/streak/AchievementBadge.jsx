import React, { useId } from 'react';
import { Lock } from 'lucide-react';

const TIER = {
  spark: { a: '#ffd666', b: '#ffb02e', ring: '#ffb02e' },
  flame: { a: '#ff9a3c', b: '#ff5a00', ring: '#ff7a1a' },
  legend: { a: '#ff5a2a', b: '#b30000', ring: '#ffd0a0' },
};
const FLAME = 'M40 12C45 26 62 34 62 54C62 66 52 74 40 74C28 74 18 66 18 54C18 42 26 36 31 26C34 32 36 34 38 35C36 26 38 18 40 12Z';

/** Lencana achievement (SVG) — bukan emoji. Terkunci = abu-abu + gembok. */
export default function AchievementBadge({ milestone, size = 76, onClick }) {
  const uid = useId().replace(/:/g, '');
  const t = TIER[milestone.tier] || TIER.flame;
  const done = milestone.status === 'completed';
  const wrap = onClick ? { type: 'button', onClick, 'aria-label': `${milestone.name}: ${done ? 'terbuka' : 'terkunci'}` } : {};
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag {...wrap} className="press focus-ring flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center">
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.a} /><stop offset="1" stopColor={t.b} /></linearGradient>
        </defs>
        <circle cx="40" cy="40" r="36" fill={done ? 'rgba(255,122,26,.12)' : 'rgb(var(--fg-rgb) / .05)'} stroke={done ? t.ring : 'rgb(var(--fg-rgb) / .18)'} strokeWidth={done && milestone.tier === 'legend' ? 3 : 2} strokeDasharray={done ? '0' : '3 4'} />
        {milestone.tier === 'legend' && done && <circle cx="40" cy="40" r="31" fill="none" stroke={t.ring} strokeOpacity=".5" strokeWidth="1" />}
        <path d={FLAME} fill={done ? `url(#b${uid})` : 'rgb(var(--fg-rgb) / .16)'} transform="translate(0 -6) scale(1 .94)" />
        {done && <path d="M40 46C43 53 48 56 48 62C48 67 44 70 40 70C36 70 32 67 32 62C32 56 37 53 40 46Z" fill="#fff6d6" transform="translate(0 -4)" />}
        <text x="40" y="72" textAnchor="middle" fontSize="12" fontWeight="700" fill={done ? 'rgb(var(--fg-rgb))' : 'rgb(var(--fg-rgb) / .4)'} style={{ fontFamily: "'Unbounded Variable', sans-serif" }}>{milestone.days}</text>
      </svg>
      {!done && <Lock size={11} className="-mt-1 text-fg/35" aria-hidden="true" />}
    </Tag>
  );
}
