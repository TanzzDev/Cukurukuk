import React, { useEffect, useRef, useState } from 'react';
import { on } from '../services/bus';

// Satu pintu notifikasi: emit('toast', 'pesan') dari mana saja (PlayerContext, layanan, halaman).
export default function ToastHost() {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  useEffect(() => on('toast', (msg) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { id, msg: String(msg) }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 2800);
  }), []);
  return (
    <div className="pointer-events-none fixed left-1/2 z-[250] flex -translate-x-1/2 flex-col items-center gap-2 bottom-[calc(env(safe-area-inset-bottom)+150px)] md:bottom-28" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pop-in max-w-[86vw] rounded-full border border-fg/10 bg-raised/95 px-4 py-2.5 text-[13px] font-medium shadow-2xl backdrop-blur">{t.msg}</div>
      ))}
    </div>
  );
}
