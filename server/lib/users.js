'use strict';
const cfg = require('./config');
const { getDb } = require('./kv');
const { HttpError } = require('./http');
const { readSession } = require('./session');

/** Representasi publik pengguna. Nama kustom TIDAK pernah ditimpa oleh nama Google. */
function publicUser(p) {
  const name = p.displayName || p.googleName || (p.email ? p.email.split('@')[0] : '') || 'Pengguna';
  return {
    id: p.id,
    email: p.email || '',
    name,
    displayName: p.displayName || '',
    googleName: p.googleName || '',
    avatarUrl: p.avatar?.url || p.googlePicture || '',
    hasCustomAvatar: !!p.avatar,
    googlePicture: p.googlePicture || '',
    tz: p.tz || '',
    createdAt: p.createdAt || 0,
  };
}

/** Wajib login. Mengembalikan { uid, profile, db } milik pengguna sesi saja. */
async function requireUser(req) {
  const uid = await readSession(req);
  if (!uid) throw new HttpError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  const db = getDb();
  if (!db) throw new HttpError(503, 'storage_unavailable', 'Penyimpanan data belum dikonfigurasi di server.');
  const profile = await db.getJSON(`u:${uid}:profile`);
  if (!profile) throw new HttpError(401, 'unauthenticated', 'Akun tidak ditemukan. Silakan masuk lagi.');
  return { uid, profile, db };
}

function cleanDisplayName(v) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string') throw new HttpError(400, 'invalid_name', 'Nama tidak valid.');
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > 40) throw new HttpError(400, 'invalid_name', 'Nama harus 1–40 karakter.');
  return s;
}

module.exports = { publicUser, requireUser, cleanDisplayName, streakRules: () => cfg.get().streakRules };
