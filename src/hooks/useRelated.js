import { useCallback, useEffect, useState } from 'react';
import { rankRelated } from '../../shared/related.js';
import { api } from '../services/api';

// Rekomendasi berbasis kecocokan untuk "Mix Antrean" & "Konten Serupa".
// Sumber: /api/related (radio YouTube Music + artis yang sama). Jika gagal, cadangan memakai pencarian yang sudah ada
// dengan peringkat yang sama. Hasil di-cache 10 menit agar tidak memanggil API berulang.
const cache = new Map();
const TTL = 10 * 60 * 1000;
const IDLE = { status: 'idle', items: [], partial: false, fallback: false, error: '' };

export const toTrack = (it) => ({ ...it, id: it.videoId, cover: it.cover || it.thumbnail || '' });

export default function useRelated(seed, { limit = 24, enabled = true } = {}) {
  const id = seed && (seed.videoId || seed.id);
  const [state, setState] = useState(IDLE);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !id) { setState(IDLE); return undefined; }
    const key = `${id}:${limit}`;
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) { setState({ status: 'ready', error: '', ...hit.value }); return undefined; }
    const ctl = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    (async () => {
      const done = (value) => {
        cache.set(key, { exp: Date.now() + TTL, value });
        setState({ status: 'ready', error: '', ...value });
      };
      try {
        const qs = new URLSearchParams({ videoId: id, title: seed.title || '', artist: seed.artist || '', artistId: seed.artistId || '', limit: String(limit) });
        const res = await api(`/api/related?${qs}`, { signal: ctl.signal, timeout: 16000 });
        done({ items: (res.items || []).map(toTrack), partial: !!res.partial, fallback: false });
      } catch (err) {
        if (ctl.signal.aborted) return;
        try {
          if (!seed.artist) throw err;
          const r = await api(`/api/search?query=${encodeURIComponent(seed.artist)}&type=songs`, { signal: ctl.signal, timeout: 12000 });
          const songs = (r?.result?.songs || []).slice(0, 15);
          const items = rankRelated({ videoId: id, title: seed.title, artist: seed.artist, artistId: seed.artistId }, { artist: songs }, { limit });
          done({ items: items.map(toTrack), partial: true, fallback: true });
        } catch (_) {
          if (!ctl.signal.aborted) setState({ ...IDLE, status: 'error', error: err.message || 'Gagal memuat rekomendasi.' });
        }
      }
    })();
    return () => ctl.abort();
  }, [id, limit, enabled, tick]);

  const retry = useCallback(() => { cache.delete(`${id}:${limit}`); setTick((t) => t + 1); }, [id, limit]);
  return { ...state, loading: state.status === 'loading', retry };
}
