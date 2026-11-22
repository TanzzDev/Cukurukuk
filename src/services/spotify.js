// Import Spotify — HANYA metadata & daftar lagu lewat Web API resmi (OAuth PKCE; tanpa Client Secret di frontend).
// Sejak 2026 Spotify membatasi "Get Playlist Items" untuk playlist MILIK / KOLABORASI pengguna yang login.
import { normalizeSpotifyPage } from '../../shared/spotify.js';

const SKEY = 'drowify:spotify:pkce';
const TKEY = 'drowify:spotify:token';
const RKEY = 'drowify:spotify:resume';
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

export const redirectUri = () => `${window.location.origin}/spotify/callback`;
export const getToken = () => {
  try {
    const t = JSON.parse(sessionStorage.getItem(TKEY) || 'null');
    return t && t.exp > Date.now() ? t.token : null;
  } catch (_) { return null; }
};
export const clearToken = () => sessionStorage.removeItem(TKEY);
export const setResume = (url) => sessionStorage.setItem(RKEY, url);
export const takeResume = () => { const v = sessionStorage.getItem(RKEY); sessionStorage.removeItem(RKEY); return v; };

export async function beginLogin(clientId, resumeUrl) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(SKEY, JSON.stringify({ verifier, state, clientId, resumeUrl }));
  const q = new URLSearchParams({
    response_type: 'code', client_id: clientId, scope: 'playlist-read-private playlist-read-collaborative',
    redirect_uri: redirectUri(), state, code_challenge_method: 'S256', code_challenge: challenge,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${q}`);
}

/** Dipanggil di /spotify/callback. Mengembalikan URL playlist yang sedang diimpor (untuk dilanjutkan). */
export async function finishLogin(search) {
  const sp = new URLSearchParams(search);
  if (sp.get('error')) throw new Error(sp.get('error') === 'access_denied' ? 'Izin Spotify ditolak.' : `Spotify: ${sp.get('error')}`);
  const saved = JSON.parse(sessionStorage.getItem(SKEY) || 'null');
  if (!saved || !sp.get('code') || sp.get('state') !== saved.state) throw new Error('Sesi login Spotify tidak valid. Coba lagi.');
  const body = new URLSearchParams({ client_id: saved.clientId, grant_type: 'authorization_code', code: sp.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier });
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || 'Gagal menukar kode Spotify.');
  sessionStorage.setItem(TKEY, JSON.stringify({ token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 }));
  sessionStorage.removeItem(SKEY);
  return saved.resumeUrl || '';
}

async function get(url, token, signal, attempt = 0) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (r.status === 429 && attempt < 3) {
    await sleep((Number(r.headers.get('Retry-After')) || 2) * 1000, signal);
    return get(url, token, signal, attempt + 1);
  }
  if (r.status === 401) throw Object.assign(new Error('Sesi Spotify berakhir. Masuk lagi.'), { code: 'expired' });
  if (r.status === 403 || r.status === 404 || r.status === 400) throw Object.assign(new Error(`Spotify menolak (${r.status}).`), { code: 'forbidden', status: r.status });
  if (!r.ok) throw new Error(`Spotify membalas ${r.status}.`);
  return r.json();
}

export const FORBIDDEN_MESSAGE = 'Spotify hanya mengizinkan daftar lagu dibaca untuk playlist milikmu atau yang kamu kolaborasi. Untuk playlist lain, gunakan ekspor CSV (mis. Exportify) atau tempel daftar lagunya.';

/** Ambil seluruh lagu (paginasi, urutan dipertahankan). Mencoba endpoint /items lalu /tracks. */
export async function fetchAllItems(token, id, { signal, onProgress } = {}) {
  const tracks = [];
  let skipped = 0;
  let offset = 0;
  let total = null;
  let path = 'items';
  for (;;) {
    let page;
    try {
      page = await get(`https://api.spotify.com/v1/playlists/${id}/${path}?limit=50&offset=${offset}&additional_types=track`, token, signal);
    } catch (e) {
      if (e.code === 'forbidden' && path === 'items' && offset === 0) { path = 'tracks'; continue; }
      throw e;
    }
    const n = normalizeSpotifyPage(page);
    tracks.push(...n.tracks);
    skipped += n.skipped;
    total = page.total ?? total;
    onProgress?.(tracks.length, total);
    if (!page.next || !page.items?.length) break;
    offset += page.items.length;
  }
  return { tracks, skipped, total };
}
