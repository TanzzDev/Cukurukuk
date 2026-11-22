import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Spinner } from './ui';

// Tombol "Continue with Google" resmi (Google Identity Services). Verifikasi identitas dilakukan di BACKEND;
// frontend hanya meneruskan ID token — nama/email dari frontend tidak pernah dianggap bukti login.
let gsi;
const loadGsi = () => (gsi ||= new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) { resolve(); return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.defer = true;
  s.onload = () => resolve();
  s.onerror = () => { gsi = null; reject(new Error('Gagal memuat Google Sign-In. Periksa koneksi internet.')); };
  document.head.appendChild(s);
}));

export const isEmbeddedWebView = () => /; wv\)|\bWebView\b/i.test(navigator.userAgent);

export default function GoogleButton({ onSuccess, onError }) {
  const { config, login } = useApp();
  const holder = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | busy | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    if (!config?.googleClientId) { setState('error'); setMsg('Login Google belum dikonfigurasi di server ini.'); return undefined; }
    loadGsi().then(() => {
      if (!alive || !holder.current) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (resp) => {
          setState('busy'); setMsg('');
          try { await login(resp.credential); onSuccess?.(); }
          catch (e) { setState('ready'); setMsg(e.message || 'Login gagal. Coba lagi.'); onError?.(e); }
        },
      });
      const light = document.documentElement.dataset.theme === 'light';
      window.google.accounts.id.renderButton(holder.current, { type: 'standard', theme: light ? 'outline' : 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'left', width: 280, locale: 'id' });
      setState('ready');
    }).catch((e) => { if (alive) { setState('error'); setMsg(e.message); } });
    return () => { alive = false; };
  }, [config?.googleClientId]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex min-h-[44px] items-center justify-center">
        <div ref={holder} className={state === 'busy' ? 'pointer-events-none opacity-40' : ''} />
        {state === 'loading' && <span className="absolute flex items-center gap-2 text-sm text-fg/55"><Spinner size={16} /> Memuat Google…</span>}
        {state === 'busy' && <span className="absolute flex items-center gap-2 text-sm"><Spinner size={16} /> Masuk…</span>}
      </div>
      {msg && <p role="alert" className="max-w-[280px] text-center text-[13px] text-red-300">{msg}</p>}
      {isEmbeddedWebView() && <p className="max-w-[300px] text-center text-[12px] leading-relaxed text-amber-300/90">Google memblokir login di dalam WebView aplikasi. Jika tombol tidak berfungsi, buka Drowify lewat browser (Chrome) untuk masuk.</p>}
    </div>
  );
}
