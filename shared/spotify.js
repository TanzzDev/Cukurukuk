// Utilitas import Spotify: hanya METADATA. Tidak ada pengambilan/ekstraksi audio Spotify.

import { parseDurationText } from './queue.js';
import { dice, normalizeText } from './text.js';

export { normalizeText };

const ID_RE = /^[A-Za-z0-9]{22}$/;

export const SPOTIFY_REASONS = {
  empty: 'Tempel link playlist Spotify terlebih dahulu.',
  not_spotify: 'Link ini bukan dari Spotify (open.spotify.com).',
  short_link: 'Link pendek spotify.link belum didukung. Buka linknya lalu salin alamat lengkap playlist.',
  not_playlist: 'Link ini bukan playlist Spotify.',
  invalid_id: 'ID playlist tidak valid. ID Spotify terdiri dari 22 karakter huruf/angka.',
};

/** Terima URL (dengan ?si=…, /intl-xx/, /embed/) atau URI spotify:playlist:ID. */
export function parseSpotifyPlaylist(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };

  const uri = raw.match(/^spotify:playlist:([^:\s]+)$/i);
  if (uri) return ID_RE.test(uri[1]) ? { ok: true, id: uri[1] } : { ok: false, reason: 'invalid_id' };
  if (/^spotify:/i.test(raw)) return { ok: false, reason: 'not_playlist' };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'not_spotify' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'not_spotify' };
  const host = url.hostname.toLowerCase();
  if (host === 'spotify.link' || host === 'spotify.app.link') return { ok: false, reason: 'short_link' };
  if (host !== 'open.spotify.com') return { ok: false, reason: 'not_spotify' };

  const parts = url.pathname.split('/').filter(Boolean);
  let i = 0;
  if (parts[i] && /^intl-[a-z-]+$/i.test(parts[i])) i += 1;
  if (parts[i] === 'embed') i += 1;
  if (parts[i] !== 'playlist') return { ok: false, reason: 'not_playlist' };
  const id = parts[i + 1] || '';
  return ID_RE.test(id) ? { ok: true, id } : { ok: false, reason: 'invalid_id' };
}

/**
 * Normalisasi satu halaman dari GET /playlists/{id}/items.
 * Sejak Feb 2026 baris memakai `item` (dulu `track`; `track` kini bisa berupa boolean).
 */
export function normalizeSpotifyPage(page) {
  const out = { tracks: [], skipped: 0 };
  const rows = Array.isArray(page?.items) ? page.items : [];
  for (const row of rows) {
    const t = (row && typeof row.item === 'object' && row.item) || (row && typeof row.track === 'object' && row.track) || null;
    if (!t || t.type === 'episode' || t.is_local || !t.id || !t.name) {
      out.skipped += 1;
      continue;
    }
    const images = t.album?.images || [];
    out.tracks.push({
      spotifyId: t.id,
      title: t.name,
      artists: (t.artists || []).map((a) => a?.name).filter(Boolean),
      album: t.album?.name || '',
      durationMs: Number(t.duration_ms) || 0,
      cover: (images[1] || images[0] || {}).url || '',
    });
  }
  return out;
}

/** CSV RFC-4180 minimal (kutip ganda, koma, baris baru di dalam kutip). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const HEADERS = {
  title: ['track name', 'track', 'title', 'name', 'song', 'judul', 'nama lagu'],
  artist: ['artist name(s)', 'artist name', 'artist names', 'artists', 'artist', 'artis', 'penyanyi'],
  album: ['album name', 'album'],
  duration: ['duration (ms)', 'duration_ms', 'duration ms', 'duration', 'durasi'],
  uri: ['track uri', 'spotify uri', 'uri', 'spotify id'],
};

function findCol(header, names) {
  const h = header.map((x) => x.trim().toLowerCase());
  for (const n of names) {
    const i = h.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Daftar lagu dari teks tempelan / berkas: CSV (mis. ekspor Exportify) atau baris "Judul - Artis".
 * order: 'title-artist' (default) | 'artist-title' untuk format baris.
 */
export function parseTrackListText(text, { order = 'title-artist', max = 2000 } = {}) {
  const tracks = [];
  let skipped = 0;
  const seen = new Set();
  const push = (t) => {
    const key = `${normalizeText(t.title)}|${normalizeText(t.artists[0] || '')}`;
    if (!t.title || seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    if (tracks.length < max) tracks.push(t);
  };

  const rows = parseCsv(text);
  const header = rows[0] || [];
  const titleCol = findCol(header, HEADERS.title);
  const artistCol = findCol(header, HEADERS.artist);
  const isCsv = rows.length > 1 && titleCol !== -1 && header.length > 1;
  if (isCsv) {
    const albumCol = findCol(header, HEADERS.album);
    const durCol = findCol(header, HEADERS.duration);
    const uriCol = findCol(header, HEADERS.uri);
    for (const r of rows.slice(1)) {
      const title = (r[titleCol] || '').trim();
      const artists = artistCol === -1 ? [] : (r[artistCol] || '').split(/[;]|\s*,\s*(?=\S)/).map((x) => x.trim()).filter(Boolean);
      const uri = uriCol === -1 ? '' : (r[uriCol] || '').trim();
      const durRaw = durCol === -1 ? '' : (r[durCol] || '').trim();
      let durationMs = 0;
      if (/^\d+$/.test(durRaw)) durationMs = Number(durRaw);
      else if (durRaw) durationMs = (parseDurationText(durRaw) || 0) * 1000;
      push({
        spotifyId: /^spotify:track:([A-Za-z0-9]{22})$/.exec(uri)?.[1] || '',
        title,
        artists,
        album: albumCol === -1 ? '' : (r[albumCol] || '').trim(),
        durationMs,
        cover: '',
      });
    }
    return { tracks, skipped, format: 'csv' };
  }

  for (const line of String(text).split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const m = l.split(/\s+[-–—]\s+/);
    let title = l;
    let artist = '';
    if (m.length >= 2) {
      if (order === 'artist-title') {
        artist = m[0];
        title = m.slice(1).join(' - ');
      } else {
        title = m[0];
        artist = m.slice(1).join(' - ');
      }
    }
    push({ spotifyId: '', title: title.trim(), artists: artist ? [artist.trim()] : [], album: '', durationMs: 0, cover: '' });
  }
  return { tracks, skipped, format: 'lines' };
}

/* ───────────── pencocokan ke katalog Drowify (hasil /api/search) ───────────── */

export function scoreCandidate(track, cand) {
  const title = dice(normalizeText(track.title), normalizeText(cand.title));
  const candArtist = normalizeText(`${cand.artist || ''} ${cand.title || ''}`);
  const names = (track.artists || []).map(normalizeText).filter(Boolean);
  let artist = names.length ? 0 : 0.5;
  for (const n of names) if (n && candArtist.includes(n)) artist = 1;
  if (artist < 1 && names.length) artist = Math.max(artist, dice(names.join(' '), normalizeText(cand.artist)) * 0.8);
  const want = track.durationMs ? track.durationMs / 1000 : null;
  const have = parseDurationText(cand.duration);
  let dur = 0.5;
  if (want != null && have != null) {
    const diff = Math.abs(want - have);
    dur = diff <= 3 ? 1 : diff <= 8 ? 0.7 : diff <= 15 ? 0.35 : 0;
  }
  return { title, artist, dur, total: 0.6 * title + 0.3 * artist + 0.1 * dur };
}

/** Pilih kandidat terbaik; null bila tidak cukup yakin (lebih baik "tidak ditemukan" daripada salah). */
export function matchTrack(track, candidates, { threshold = 0.62 } = {}) {
  let best = null;
  for (const cand of candidates || []) {
    if (!cand?.videoId && !cand?.id) continue;
    const s = scoreCandidate(track, cand);
    if (!best || s.total > best.score) best = { candidate: cand, score: s.total, detail: s };
  }
  if (!best) return null;
  const d = best.detail;
  if (best.score >= threshold && d.title >= 0.5 && (d.artist >= 0.3 || d.title >= 0.9)) return best;
  return null;
}

export function searchQueryFor(track) {
  return `${track.title} ${(track.artists || [])[0] || ''}`.trim();
}
