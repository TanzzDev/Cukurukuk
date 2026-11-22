'use strict';
const express = require('express');
const cfg = require('../lib/config');
const { getDb } = require('../lib/kv');
const { wrap, HttpError, rateLimit } = require('../lib/http');
const { load } = require('../lib/shared');
const { avatarStorageKind } = require('../lib/uploads');

const router = express.Router();
const spotifyLimit = rateLimit({ windowMs: 60_000, max: 30, name: 'spotify' });

router.get('/health', (req, res) => {
  const db = getDb();
  res.set('Cache-Control', 'no-store');
  res.json({ status: true, version: cfg.get().version, storage: db ? db.kind : 'none' });
});

/** Konfigurasi publik: UI hanya menampilkan fitur yang benar-benar tersedia di server ini. */
router.get('/config', wrap(async (req, res) => {
  const c = cfg.get();
  const db = getDb();
  const authOn = !!(c.googleClientId && c.sessionSecret.length >= 32 && db);
  res.set('Cache-Control', 'no-store');
  res.json({
    status: true,
    app: 'Drowify Music',
    version: c.version,
    googleClientId: authOn ? c.googleClientId : '',
    streakRules: c.streakRules,
    spotifyClientId: c.spotifyClientId,
    storage: db ? db.kind : 'none',
    features: {
      auth: authOn,
      sync: !!db,
      avatarUpload: authOn && avatarStorageKind() !== 'none',
      spotifyConnect: !!c.spotifyClientId,
    },
  });
}));

router.get('/avatar/:uid', wrap(async (req, res) => {
  const db = getDb();
  const a = db ? await db.getJSON(`avatar:${req.params.uid}`) : null;
  if (!a || !a.b64) return res.status(404).json({ status: false, code: 'not_found', message: 'Avatar tidak ditemukan.' });
  res.set('Content-Type', a.type);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
  return res.send(Buffer.from(a.b64, 'base64'));
}));

/** Pratinjau playlist Spotify lewat oEmbed resmi (tanpa kredensial): hanya judul & sampul. */
router.get('/spotify/playlist', spotifyLimit, wrap(async (req, res) => {
  const { parseSpotifyPlaylist, SPOTIFY_REASONS } = await load('spotify');
  const parsed = parseSpotifyPlaylist(req.query.url);
  if (!parsed.ok) throw new HttpError(400, parsed.reason, SPOTIFY_REASONS[parsed.reason]);
  const url = `https://open.spotify.com/playlist/${parsed.id}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  let r;
  try {
    r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
  } catch (_) {
    throw new HttpError(502, 'spotify_unreachable', 'Tidak dapat menghubungi Spotify.');
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 404) throw new HttpError(404, 'not_found', 'Playlist tidak ditemukan atau bersifat privat.');
  if (r.status === 429) throw new HttpError(429, 'rate_limited', 'Spotify membatasi permintaan. Coba lagi sebentar.');
  if (!r.ok) throw new HttpError(502, 'spotify_error', `Spotify membalas ${r.status}.`);
  const j = await r.json().catch(() => ({}));
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ status: true, id: parsed.id, url, title: String(j.title || ''), thumbnail: String(j.thumbnail_url || '') });
}));

module.exports = router;
