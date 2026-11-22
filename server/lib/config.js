'use strict';
// Seluruh konfigurasi server dibaca dari environment (lihat .env.example).
// Dibaca saat dipanggil (bukan saat import) agar mudah diuji.
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const int = (v, d, min = 1) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= min ? n : d;
};

function get() {
  const e = process.env;
  let version = '0.0.0';
  try { version = require('../../package.json').version; } catch (_) { /* tidak fatal */ }
  return {
    version,
    isVercel: !!e.VERCEL,
    isProd: e.NODE_ENV === 'production' || !!e.VERCEL,
    googleClientId: clean(e.GOOGLE_CLIENT_ID),
    sessionSecret: clean(e.SESSION_SECRET),
    spotifyClientId: clean(e.SPOTIFY_CLIENT_ID),
    // Aturan Streak (lihat shared/config.js). Default: 1 pemutaran valid/hari, pemulihan 7 hari.
    streakRules: {
      minPlays: int(e.STREAK_MIN_PLAYS_PER_DAY, 1, 1),
      minSeconds: Math.round(num(e.STREAK_MIN_MINUTES_PER_DAY, 0) * 60),
      recoveryDays: int(e.STREAK_RECOVERY_DAYS, 7, 1),
    },
    kvUrl: clean(e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL),
    kvToken: clean(e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN),
    blobToken: clean(e.BLOB_READ_WRITE_TOKEN),
    devDbFile: clean(e.DEV_DB_FILE),
  };
}

module.exports = { get };
