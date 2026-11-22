import { useEffect, useRef, useState } from 'react';

/** Animasi angka halus (easing). Menghormati prefers-reduced-motion. */
export default function useCountUp(target, ms = 900) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(reduced ? target : 0);
  const from = useRef(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return undefined; }
    let raf;
    const t0 = performance.now();
    const a = from.current;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      const val = Math.round(a + (target - a) * e);
      setV(val);
      from.current = val;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return v;
}
