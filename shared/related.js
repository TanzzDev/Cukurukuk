// Rekomendasi "Mix Antrean" & "Konten Serupa" berbasis KECOCOKAN, bukan acak.
// Sinyal yang dipakai hanya yang benar-benar tersedia dari sumber:
//  - radio     : urutan rekomendasi radio YouTube Music untuk lagu tersebut (sinyal terkuat)
//  - artis     : artis sama / kolaborator (metadata artis)
//  - album     : album sama (jika tersedia)
//  - judul     : kemiripan judul (versi lain, remix)
//  - durasi    : durasi berdekatan
//  - genre/mood: HANYA bila sumber menyediakannya untuk kedua lagu (YouTube Music biasanya tidak)
// Setiap hasil membawa `reasons` yang jujur sesuai sinyal yang benar-benar cocok.

import { dice, normalizeText } from './text.js';
import { parseDurationText } from './queue.js';

const W = { radio: 0.45, artist: 0.25, album: 0.12, title: 0.06, duration: 0.04, genre: 0.2, mood: 0.1 };

const runsText = (runs) => (Array.isArray(runs) ? runs.map((r) => r?.text || '').join('') : '');

function hdThumb(url, videoId) {
  if (!url) return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  let u = String(url);
  if (/googleusercontent\.com|ggpht\.com/.test(u)) {
    if (/=w\d+-h\d+/i.test(u)) u = u.replace(/=w\d+-h\d+[^?#]*/i, '=w544-h544-l90-rj');
    else if (/=s\d+/i.test(u)) u = u.replace(/=s\d+[^?#]*/i, '=s544-c-k-c0x00ffffff-no-rj');
  }
  return u;
}

function toDurationDot(text) {
  const m = String(text || '').match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (!m) return '';
  return m[1] ? `${m[1]}.${m[2].padStart(2, '0')}.${m[3]}` : `${m[2]}.${m[3]}`;
}

/** Parse respons youtubei/v1/next (daftar putar radio) -> kandidat lagu ternormalisasi. */
export function parseWatchNext(data, { limit = 60 } = {}) {
  const panel =
    data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents;
  if (!Array.isArray(panel)) return [];
  const out = [];
  for (const entry of panel) {
    const r = entry?.playlistPanelVideoRenderer || entry?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
    const videoId = r?.videoId;
    if (!videoId) continue;
    const by = r.longBylineText?.runs || r.shortBylineText?.runs || [];
    const artists = [];
    let artistId = '';
    let album = '';
    let albumId = '';
    for (const run of by) {
      const be = run?.navigationEndpoint?.browseEndpoint;
      const id = be?.browseId || '';
      const page = be?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
      if (id.startsWith('UC') || page === 'MUSIC_PAGE_TYPE_ARTIST' || page === 'MUSIC_PAGE_TYPE_USER_CHANNEL') {
        if (run.text) artists.push(run.text);
        if (!artistId) artistId = id;
      } else if (id.startsWith('MPRE') || page === 'MUSIC_PAGE_TYPE_ALBUM') {
        album = run.text || '';
        albumId = id;
      }
    }
    if (!artists.length && by[0]?.text) artists.push(by[0].text);
    const thumbs = r.thumbnail?.thumbnails || [];
    out.push({
      videoId,
      title: runsText(r.title?.runs),
      artist: artists.join(', '),
      artists,
      artistId,
      album,
      albumId,
      duration: toDurationDot(runsText(r.lengthText?.runs)),
      thumbnail: hdThumb(thumbs.length ? thumbs[thumbs.length - 1].url : '', videoId),
      url: `https://music.youtube.com/watch?v=${videoId}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function splitArtists(s) {
  return String(s || '')
    .split(/,|&|\bx\b|\bfeat\.?\b|\bft\.?\b|\bdan\b|\band\b|;|•/i)
    .map(normalizeText)
    .filter(Boolean);
}

/** 1 = artis utama sama, 0..1 = kolaborasi/sebagian, null = data artis tidak ada pada salah satu. */
export function artistOverlap(a, b) {
  if (a.artistId && b.artistId && a.artistId === b.artistId) return 1;
  const A = a.artists?.length ? a.artists.map(normalizeText) : splitArtists(a.artist);
  const B = b.artists?.length ? b.artists.map(normalizeText) : splitArtists(b.artist);
  if (!A.length || !B.length) return null;
  const shared = A.filter((x) => B.includes(x)).length;
  if (!shared) return 0;
  return shared === Math.min(A.length, B.length) && A[0] === B[0] ? 1 : Math.min(1, 0.5 + shared / Math.max(A.length, B.length) / 2);
}

const lowerList = (v) => (Array.isArray(v) ? v.map((x) => normalizeText(x)).filter(Boolean) : []);

export function scoreRelated(seed, cand, { radioRank = null, radioSize = 0 } = {}) {
  let num = 0;
  let den = 0;
  const reasons = [];

  if (radioSize > 0) {
    const s = radioRank == null ? 0 : 1 - radioRank / Math.max(1, radioSize);
    num += W.radio * s;
    den += W.radio;
    if (radioRank != null) reasons.push('Rekomendasi radio YouTube Music');
  }
  const ao = artistOverlap(seed, cand);
  if (ao != null) {
    num += W.artist * ao;
    den += W.artist;
    if (ao >= 1) reasons.push('Artis yang sama');
    else if (ao > 0) reasons.push('Kolaborasi atau artis terkait');
  }
  if ((seed.albumId || seed.album) && (cand.albumId || cand.album)) {
    const same = (seed.albumId && seed.albumId === cand.albumId) || (seed.album && normalizeText(seed.album) === normalizeText(cand.album));
    num += W.album * (same ? 1 : 0);
    den += W.album;
    if (same) reasons.push('Album yang sama');
  }
  const ts = dice(normalizeText(seed.title), normalizeText(cand.title));
  num += W.title * ts;
  den += W.title;
  if (ts >= 0.5) reasons.push('Judul mirip');

  const ds = parseDurationText(seed.duration);
  const dc = parseDurationText(cand.duration);
  if (ds != null && dc != null) {
    const diff = Math.abs(ds - dc);
    const v = diff <= 30 ? 1 : diff <= 60 ? 0.6 : diff <= 120 ? 0.25 : 0;
    num += W.duration * v;
    den += W.duration;
    if (v === 1) reasons.push('Durasi serupa');
  }
  for (const [key, label] of [['genres', 'Genre sama'], ['moods', 'Suasana sama']]) {
    const A = lowerList(seed[key]);
    const B = lowerList(cand[key]);
    if (A.length && B.length) {
      const hit = A.filter((x) => B.includes(x)).length / Math.min(A.length, B.length);
      num += W[key === 'genres' ? 'genre' : 'mood'] * hit;
      den += W[key === 'genres' ? 'genre' : 'mood'];
      if (hit > 0) reasons.push(label);
    }
  }
  return { score: den ? Math.round((num / den) * 1000) / 1000 : 0, reasons };
}

/**
 * Gabungkan beberapa sumber kandidat lalu urutkan menurut kecocokan.
 *  lists = { radio: [...berurutan dari sumber], artist: [...], title: [...] }
 * Lagu yang sama dengan seed (id atau judul+artis identik) dibuang.
 */
export function rankRelated(seed, lists = {}, { limit = 30 } = {}) {
  const radio = lists.radio || [];
  const byId = new Map();
  const add = (cand, source, rank) => {
    if (!cand?.videoId || cand.videoId === seed.videoId) return;
    const e = byId.get(cand.videoId) || { cand: { ...cand }, sources: new Set(), radioRank: null };
    e.sources.add(source);
    if (source === 'radio') {
      e.radioRank = rank;
      e.cand = { ...e.cand, ...cand }; // metadata radio lebih lengkap
    } else {
      e.cand = { ...cand, ...e.cand };
    }
    byId.set(cand.videoId, e);
  };
  radio.forEach((c, i) => add(c, 'radio', i));
  (lists.artist || []).forEach((c) => add(c, 'artist', null));
  (lists.title || []).forEach((c) => add(c, 'title', null));

  const seedKey = `${normalizeText(seed.title)}|${normalizeText(seed.artist)}`;
  const items = [];
  for (const e of byId.values()) {
    const key = `${normalizeText(e.cand.title)}|${normalizeText(e.cand.artist)}`;
    if (key === seedKey) continue; // versi lain dari lagu yang sama bukan "rekomendasi"
    const { score, reasons } = scoreRelated(seed, e.cand, { radioRank: e.radioRank, radioSize: radio.length });
    const multi = e.sources.size > 1 ? 0.03 : 0;
    items.push({ ...e.cand, score: Math.min(1, score + multi), reasons, sources: [...e.sources], radioRank: e.radioRank });
  }
  items.sort((a, b) => b.score - a.score || (a.radioRank ?? 1e9) - (b.radioRank ?? 1e9));
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${normalizeText(it.title)}|${normalizeText(it.artist)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}
