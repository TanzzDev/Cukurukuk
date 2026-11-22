import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GhostButton, PrimaryButton, Sheet, Spinner } from './ui';

export default function MergeGuestModal() {
  const { mergeOffer, acceptMerge, skipMerge } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!mergeOffer) return null;
  const s = mergeOffer.summary;
  const go = async () => { setBusy(true); setError(''); try { await acceptMerge(); } catch (e) { setError(e.message || 'Gagal menggabungkan.'); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={skipMerge} title="Gabungkan data tamu?" z={245}>
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="text-[14.5px] text-fg/70">Perangkat ini punya data yang dibuat sebelum masuk. Data tamu tidak digabung otomatis agar tidak tercampur dengan akunmu.</p>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
          {[['Lagu disukai', s.liked], ['Playlist', s.playlists], ['Artis', s.artists], ['Hari mendengarkan', s.days], ['Riwayat putar', s.plays]].filter(([, n]) => n > 0).map(([a, n]) => <li key={a} className="rounded-xl bg-fg/[0.06] px-3 py-2.5"><b className="font-display">{n}</b> <span className="text-fg/60">{a}</span></li>)}
        </ul>
        <p className="mt-3 text-[12px] text-fg/45">Penggabungan tidak menggandakan data yang sama dan dapat diulang dengan aman.</p>
        {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-[13px] text-red-300" role="alert">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3"><GhostButton className="!h-11" onClick={skipMerge} disabled={busy}>Lewati</GhostButton><PrimaryButton onClick={go} disabled={busy}>{busy ? <Spinner size={16} /> : 'Gabungkan'}</PrimaryButton></div>
      </div>
    </Sheet>
  );
}
