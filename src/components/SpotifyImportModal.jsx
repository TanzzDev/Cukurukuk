import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, FileUp, Link2, Music2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';
import { createPlaylist, slimTrack } from '../services/library';
import { beginLogin, clearToken, fetchAllItems, FORBIDDEN_MESSAGE, getToken } from '../services/spotify';
import { matchTrack, parseSpotifyPlaylist, parseTrackListText, searchQueryFor, SPOTIFY_REASONS } from '../../shared/spotify.js';
import { Cover, GhostButton, PrimaryButton, Sheet, Spinner, cn } from './ui';

async function matchAll(tracks, { signal, onProgress, only }) {
  const results = new Array(tracks.length).fill(null);
  const idxs = only || tracks.map((_, i) => i);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < idxs.length && !signal.aborted) {
      const i = idxs[next++];
      try {
        const r = await api(`/api/search?query=${encodeURIComponent(searchQueryFor(tracks[i]))}&type=songs`, { signal, timeout: 15000 });
        const m = matchTrack(tracks[i], r?.result?.songs || []);
        results[i] = m ? { status: 'found', track: slimTrack(m.candidate), score: m.score } : { status: 'missing' };
      } catch (e) {
        if (signal.aborted) return;
        results[i] = { status: 'error' };
      }
      done += 1;
      onProgress(done, idxs.length);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return results;
}

/** Import playlist Spotify: URL → pratinjau → daftar lagu (login Spotify / CSV / tempel) → pencocokan → playlist Drowify. */
export default function SpotifyImportModal({ open, onClose, resumeUrl = '' }) {
  const { config } = useApp();
  const { showToast } = usePlayer();
  const clientId = config?.spotifyClientId;
  const [url, setUrl] = useState('');
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState('input'); // input | preview | matching | done
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [order, setOrder] = useState('title-artist');
  const [tracks, setTracks] = useState([]);
  const [results, setResults] = useState([]);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [name, setName] = useState('');
  const abort = useRef(null);
  const fileRef = useRef(null);
  const parsed = url.trim() ? parseSpotifyPlaylist(url) : null;

  const reset = () => { abort.current?.abort(); setUrl(''); setMeta(null); setStep('input'); setBusy(''); setError(''); setRaw(''); setTracks([]); setResults([]); setProg({ done: 0, total: 0 }); setName(''); };
  useEffect(() => { if (open) { reset(); if (resumeUrl) setUrl(resumeUrl); } return () => abort.current?.abort(); }, [open]);
  useEffect(() => { if (open && resumeUrl && url === resumeUrl && step === 'input') lookup(); }, [open, url]);

  const lookup = async () => {
    const p = parseSpotifyPlaylist(url);
    if (!p.ok) { setError(SPOTIFY_REASONS[p.reason]); return; }
    setError(''); setBusy('Memeriksa playlist…');
    try {
      const r = await api(`/api/spotify/playlist?url=${encodeURIComponent(url.trim())}`, { timeout: 12000 });
      setMeta({ id: p.id, title: r.title, thumbnail: r.thumbnail, url: r.url });
      setName(r.title || 'Playlist Spotify');
      setStep('preview');
      if (getToken()) fetchViaSpotify(p.id, r.title);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const startMatching = async (list, only) => {
    setTracks(list); setStep('matching');
    const ctl = new AbortController(); abort.current = ctl;
    setProg({ done: 0, total: (only || list).length });
    const res = await matchAll(list, { signal: ctl.signal, only, onProgress: (done, total) => setProg({ done, total }) });
    if (ctl.signal.aborted) return;
    setResults((prev) => (only ? prev.map((x, i) => res[i] || x) : res));
    setStep('done');
  };

  const fetchViaSpotify = async (id, title) => {
    setError(''); setBusy('Mengambil daftar lagu dari Spotify…');
    const ctl = new AbortController(); abort.current = ctl;
    try {
      const out = await fetchAllItems(getToken(), id, { signal: ctl.signal, onProgress: (n, t) => setBusy(`Mengambil daftar lagu… ${n}${t ? ` / ${t}` : ''}`) });
      if (!out.tracks.length) { setError('Playlist ini kosong atau tidak memiliki lagu yang dapat diimpor.'); return; }
      setBusy('');
      await startMatching(out.tracks);
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (e.code === 'expired') clearToken();
      setError(e.code === 'forbidden' ? FORBIDDEN_MESSAGE : e.message);
    } finally { setBusy(''); }
  };

  const fromText = async (text) => {
    const out = parseTrackListText(text, { order });
    if (!out.tracks.length) { setError('Tidak ada lagu yang dapat dibaca. Gunakan CSV ekspor atau satu lagu per baris: Judul - Artis.'); return; }
    setError('');
    await startMatching(out.tracks);
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setError('Berkas terlalu besar (maksimal 3 MB).'); return; }
    fromText(await f.text());
  };

  const found = results.filter((r) => r?.status === 'found');
  const missing = results.filter((r) => r && r.status !== 'found').length;
  const retry = () => { const only = results.map((r, i) => (r?.status === 'error' ? i : -1)).filter((i) => i >= 0); if (only.length) startMatching(tracks, only); };
  const doImport = () => {
    const seen = new Set();
    const songs = [];
    for (const r of results) if (r?.status === 'found' && !seen.has(r.track.videoId)) { seen.add(r.track.videoId); songs.push(r.track); }
    const pl = createPlaylist(name.trim() || 'Playlist Spotify', meta?.thumbnail || '', meta?.url ? `Diimpor dari Spotify: ${meta.url}` : 'Diimpor dari daftar lagu Spotify', songs, 'spotify');
    showToast(`${songs.length} lagu diimpor ke "${pl.name}"`);
    onClose(pl);
  };

  return (
    <Sheet open={open} onClose={() => onClose()} title="Import dari Spotify" wide z={215} className="md:h-[82vh]">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {step === 'input' && (
          <div>
            <label className="block text-[13px] font-medium text-fg/70">Link playlist Spotify
              <div className="relative mt-1.5"><Link2 size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
                <input value={url} onChange={(e) => { setUrl(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && lookup()} inputMode="url" autoFocus placeholder="https://open.spotify.com/playlist/…"
                  className="h-12 w-full rounded-xl border border-fg/10 bg-fg/[0.06] pl-11 pr-4 text-[14.5px] outline-none placeholder:text-fg/35 focus:border-fg/40" /></div>
            </label>
            {parsed && !parsed.ok && <p className="mt-2 text-[13px] text-red-400">{SPOTIFY_REASONS[parsed.reason]}</p>}
            {parsed?.ok && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-emerald-400"><Check size={14} /> Link playlist valid</p>}
            <p className="mt-3 text-[12.5px] leading-relaxed text-fg/50">Format: open.spotify.com/playlist/…, dengan atau tanpa ?si=…, atau spotify:playlist:….</p>
            <PrimaryButton className="mt-5 w-full" onClick={lookup} disabled={!parsed?.ok || !!busy}>{busy ? <><Spinner size={16} /> {busy}</> : 'Lanjut'}</PrimaryButton>
          </div>
        )}

        {step === 'preview' && meta && (
          <div>
            <div className="flex items-center gap-4 rounded-2xl bg-fg/[0.06] p-3">
              <Cover src={meta.thumbnail} className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wider text-fg/45">Playlist Spotify</div><div className="truncate font-display text-[16px] font-semibold">{meta.title}</div></div>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-[13px] leading-relaxed text-fg/75">
              <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={15} className="text-amber-400" /> Batasan Spotify</div>
              {FORBIDDEN_MESSAGE} Drowify hanya membaca metadata; tidak ada audio Spotify yang diunduh atau diekstrak.
            </div>
            {busy && <p className="mt-4 flex items-center gap-2 text-sm text-fg/70"><Spinner size={16} /> {busy}</p>}
            {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-[13px] text-red-300" role="alert">{error}</p>}
            <div className="mt-5 space-y-3">
              {config?.features?.spotifyConnect ? (
                <PrimaryButton className="w-full" disabled={!!busy} onClick={() => (getToken() ? fetchViaSpotify(meta.id, meta.title) : beginLogin(clientId, url.trim()))}>Masuk dengan Spotify untuk mengambil lagu</PrimaryButton>
              ) : (
                <p className="rounded-xl bg-fg/[0.05] p-3 text-[12.5px] text-fg/55">Login Spotify belum dikonfigurasi di server ini (SPOTIFY_CLIENT_ID). Gunakan cara CSV / tempel di bawah.</p>
              )}
              <div className="rounded-2xl border border-fg/10 p-4">
                <div className="mb-2 flex items-center justify-between text-[13px] font-semibold"><span>Atau tempel / unggah daftar lagu</span>
                  <select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Urutan baris" className="rounded-lg bg-fg/10 px-2 py-1 text-[12px] text-fg outline-none"><option value="title-artist">Judul - Artis</option><option value="artist-title">Artis - Judul</option></select></div>
                <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} placeholder={'Satu lagu per baris, mis.\nBahagia Lagi - Piche Kota\natau tempel isi CSV Exportify'} className="w-full resize-none rounded-xl border border-fg/10 bg-fg/[0.05] p-3 text-[13.5px] outline-none placeholder:text-fg/35 focus:border-fg/40" />
                <div className="mt-3 flex gap-2.5"><GhostButton onClick={() => fileRef.current?.click()} className="flex-1"><FileUp size={15} /> Unggah CSV</GhostButton><PrimaryButton onClick={() => fromText(raw)} disabled={!raw.trim() || !!busy} className="flex-1 !h-10">Cocokkan lagu</PrimaryButton></div>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
              </div>
            </div>
          </div>
        )}

        {step === 'matching' && (
          <div className="py-6 text-center">
            <Spinner size={28} className="mx-auto" />
            <p className="mt-4 font-display text-[16px] font-semibold">Mencocokkan lagu di Drowify…</p>
            <p className="mt-1 text-sm text-fg/55">{prog.done} dari {prog.total} diperiksa</p>
            <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={prog.done} aria-valuemax={prog.total}><div className="h-full rounded-full bg-fg transition-[width]" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div>
            <GhostButton className="mt-6" onClick={() => { abort.current?.abort(); setStep(tracks.length ? 'preview' : 'input'); }}>Batalkan</GhostButton>
          </div>
        )}

        {step === 'done' && (
          <div>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {[['Total', tracks.length], ['Ditemukan', found.length], ['Belum tersedia', missing]].map(([a, b]) => <div key={a} className="rounded-2xl bg-fg/[0.06] p-3"><div className="font-display text-xl font-semibold">{b}</div><div className="text-[11.5px] text-fg/55">{a}</div></div>)}
            </div>
            <label className="mt-4 block text-[13px] font-medium text-fg/70">Nama playlist
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-1.5 h-12 w-full rounded-xl border border-fg/10 bg-fg/[0.06] px-4 text-[15px] outline-none focus:border-fg/40" /></label>
            {results.some((r) => r?.status === 'error') && <GhostButton className="mt-3" onClick={retry}>Ulangi yang gagal diperiksa</GhostButton>}
            <ul className="mt-4 max-h-[34vh] overflow-y-auto rounded-2xl border border-fg/10 thin-scroll">
              {tracks.map((t, i) => {
                const r = results[i];
                return (
                  <li key={i} className="flex items-center gap-3 border-b border-fg/5 px-3 py-2.5 last:border-0">
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full', r?.status === 'found' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-fg/10 text-fg/45')}>{r?.status === 'found' ? <Check size={14} /> : <X size={14} />}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-medium">{t.title}</div><div className="truncate text-[12px] text-fg/50">{t.artists.join(', ')}{r?.status === 'found' ? ` → ${r.track.title}` : r?.status === 'error' ? ' • gagal diperiksa' : ' • belum tersedia di Drowify'}</div></div>
                  </li>
                );
              })}
            </ul>
            <PrimaryButton className="mt-5 w-full" onClick={doImport} disabled={!found.length}><Music2 size={16} /> Import {found.length} lagu</PrimaryButton>
            <p className="mt-2 text-center text-[12px] text-fg/45">Urutan lagu dipertahankan; lagu ganda dilewati.</p>
          </div>
        )}
        {step === 'input' && error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-[13px] text-red-300" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
