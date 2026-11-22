import React, { useId } from 'react';
import { flameLevel } from '../../../shared/config';

// Api asli (SVG berlapis + CSS transform/opacity, tanpa emoji, tanpa filter blur yang berat).
// ACTIVE  : menyala, intensitas mengikuti panjang streak (level 1–5)
// DORMANT : padam bertahap → bara redup, angka tetap, tanpa partikel
// EXPIRED / NEW : padam total, tanpa animasi
const OUTER = 'M50 4C58 28 88 46 88 84C88 108 70 126 50 126C30 126 12 108 12 84C12 62 26 50 34 34C38 44 42 48 46 50C44 36 46 18 50 4Z';
const MID = 'M52 30C58 50 76 62 76 90C76 110 64 124 50 124C36 124 24 110 24 92C24 76 34 68 40 56C44 64 46 66 48 66C46 52 48 40 52 30Z';
const INNER = 'M50 62C55 74 66 82 66 98C66 112 58 122 50 122C42 122 34 112 34 100C34 90 40 86 44 78C46 84 48 86 49 86C48 76 49 68 50 62Z';
const CORE = 'M50 88C55 96 60 102 60 110C60 118 55 122 50 122C45 122 40 118 40 110C40 102 45 96 50 88Z';
const SIDE_L = 'M20 70C24 78 30 82 30 94C30 104 24 112 18 112C12 112 8 104 8 96C8 88 14 84 16 78C18 82 19 80 20 70Z';
const SIDE_R = 'M80 66C84 76 92 82 92 96C92 106 87 114 80 114C73 114 68 106 68 98C68 88 76 84 77 76C78 80 79 78 80 66Z';
const PARTICLES = [
  { x: 40, dx: -8, d: 2.2, w: 0 }, { x: 58, dx: 7, d: 2.6, w: 0.5 }, { x: 48, dx: -3, d: 1.9, w: 1.1 },
  { x: 66, dx: 11, d: 2.8, w: 0.3 }, { x: 34, dx: -12, d: 2.4, w: 1.4 }, { x: 54, dx: 4, d: 2.1, w: 0.9 },
  { x: 44, dx: -6, d: 3.0, w: 1.7 }, { x: 62, dx: 9, d: 2.3, w: 0.2 }, { x: 50, dx: 1, d: 2.5, w: 1.3 },
];
const PARTICLE_COUNT = [0, 2, 3, 5, 7, 9];

export default function StreakFlame({ status = 'ACTIVE', days = 0, size = 96, burst = false, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const lit = status === 'ACTIVE';
  const level = lit ? Math.max(1, flameLevel(days)) : 0;
  const mode = lit ? '' : status === 'DORMANT' ? 'out dormant' : 'out dead';
  const L = Math.max(level, 1);
  return (
    <svg viewBox="0 0 100 130" width={size} height={size * 1.3} className={`dw-flame lv${L} ${mode} ${burst ? 'burst' : ''} ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`g${uid}`} cx="50%" cy="68%" r="50%">
          <stop offset="0%" stopColor="#ff9a3c" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ff6a00" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`o${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff3d00" /><stop offset="0.55" stopColor="#ff7a1a" /><stop offset="1" stopColor="#ffb02e" /></linearGradient>
        <linearGradient id={`m${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a00" /><stop offset="0.6" stopColor="#ffb02e" /><stop offset="1" stopColor="#ffd666" /></linearGradient>
        <linearGradient id={`i${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc23d" /><stop offset="1" stopColor="#fff1b8" /></linearGradient>
      </defs>
      <circle className="fl-glow" cx="50" cy="92" r="60" fill={`url(#g${uid})`} />
      <g className="fl-fire">
        <path className="fl-l fl-side fl-sl" d={SIDE_L} fill={`url(#m${uid})`} />
        <path className="fl-l fl-side fl-sr" d={SIDE_R} fill={`url(#m${uid})`} />
        <path className="fl-l fl-outer" d={OUTER} fill={`url(#o${uid})`} />
        <path className="fl-l fl-mid" d={MID} fill={`url(#m${uid})`} />
        <path className="fl-l fl-inner" d={INNER} fill={`url(#i${uid})`} />
        <path className="fl-l fl-core" d={CORE} fill="#fffdf2" />
      </g>
      {PARTICLES.slice(0, PARTICLE_COUNT[L]).map((p, i) => (
        <circle key={i} className="fl-p" cx={p.x} cy="62" r={i % 3 === 0 ? 1.9 : 1.4} fill="#ffb02e" style={{ '--x': `${p.dx}px`, animationDuration: `${p.d}s`, animationDelay: `${p.w}s` }} />
      ))}
      <g className="fl-ember">
        <path d={OUTER} fill="#3f3f46" opacity="0.5" />
        <path d={INNER} fill="#27272a" opacity="0.7" />
        <ellipse className="fl-ash" cx="50" cy="124" rx="30" ry="5" fill="#52525b" opacity="0.55" />
        <circle className="fl-coal" cx="50" cy="116" r="5.5" fill="#ff7a1a" />
        <circle className="fl-coal fl-coal2" cx="38" cy="120" r="3" fill="#ff7a1a" />
      </g>
    </svg>
  );
}
