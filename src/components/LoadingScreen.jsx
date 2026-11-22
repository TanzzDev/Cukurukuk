import React, { useEffect, useState } from 'react';
import { DrowifyMark } from './brand/DrowifyMark';

// Alur: intro (gelombang → D + DROWIFY) → loading (gelombang audio, hanya selama inisialisasi NYATA belum selesai)
//       → exit (D terbelah membuka aplikasi). Hanya tampil saat aplikasi dibuka/dimuat ulang, bukan saat pindah halaman.
const WAVE = 'M0 30 C 20 30, 20 8, 40 8 S 60 52, 80 52 S 100 8, 120 8 S 140 52, 160 52 S 180 30, 200 30';

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return undefined;
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

export default function LoadingScreen({ ready, onDone }) {
  const [phase, setPhase] = useState('intro');
  const [late, setLate] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => { document.getElementById('boot')?.remove(); }, []); // layar statis HTML diganti mulus oleh React

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === 'intro' ? 'loading' : p)), reduced ? 250 : 1300);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const t = setTimeout(() => setLate(true), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading' || !ready) return undefined;
    const t = setTimeout(() => setPhase('exit'), reduced ? 0 : 450);
    return () => clearTimeout(t);
  }, [phase, ready, reduced]);

  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const t = setTimeout(() => { setPhase('done'); onDone?.(); }, reduced ? 150 : 950);
    return () => clearTimeout(t);
  }, [phase, reduced, onDone]);

  if (phase === 'done') return null;
  return (
    <div className={`dw-splash dw-phase-${phase}`} role="status" aria-live="polite" aria-label="Memuat Drowify Music">
      <div className="dw-splash-bg" />
      <div className="dw-stage">
        <svg className="dw-line" viewBox="0 0 200 60" aria-hidden="true">
          <path className="dw-line-path" d={WAVE} pathLength="1" />
        </svg>
        <div className="dw-logo">
          <DrowifyMark size={88} split className="dw-mark" />
          <div className="dw-word">DROWIFY</div>
        </div>
        <div className="dw-wave" aria-hidden="true">
          <svg viewBox="0 0 200 60" preserveAspectRatio="none">
            <g className="dw-wave-a">
              <path d={WAVE} /><path d={WAVE} transform="translate(200 0)" /><path d={WAVE} transform="translate(400 0)" />
            </g>
          </svg>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="dw-wave-2">
            <g className="dw-wave-b">
              <path d={WAVE} /><path d={WAVE} transform="translate(200 0)" /><path d={WAVE} transform="translate(400 0)" />
            </g>
          </svg>
        </div>
        <div className="dw-caption">{late ? 'Hampir siap' : 'Menyiapkan musikmu'}</div>
      </div>
    </div>
  );
}
