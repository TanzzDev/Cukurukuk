'use strict';
const express = require('express');
const cfg = require('../lib/config');
const { getDb, withLock } = require('../lib/kv');
const { wrap, HttpError, rateLimit } = require('../lib/http');
const { createSession, readSession, clearSession } = require('../lib/session');
const { verifyGoogleCredential } = require('../lib/google');
const { load } = require('../lib/shared');
const { publicUser } = require('../lib/users');

const router = express.Router();
const loginLimit = rateLimit({ windowMs: 60_000, max: 20, name: 'login' });

router.post('/google', loginLimit, wrap(async (req, res) => {
  const c = cfg.get();
  if (!c.googleClientId || c.sessionSecret.length < 32) {
    throw new HttpError(503, 'auth_not_configured', 'Login Google belum dikonfigurasi di server.');
  }
  const db = getDb();
  if (!db) throw new HttpError(503, 'storage_unavailable', 'Penyimpanan data belum dikonfigurasi di server.');

  const g = await verifyGoogleCredential(req.body?.credential, c.googleClientId);
  const { isValidTimeZone } = await load('dates');
  const tz = isValidTimeZone(req.body?.tz) ? req.body.tz : '';
  const uid = `g_${g.sub}`;
  const now = Date.now();
  let isNew = false;
  const profile = await withLock(db, uid, async () => {
    let p = await db.getJSON(`u:${uid}:profile`);
    if (!p) {
      isNew = true;
      p = { id: uid, createdAt: now, displayName: '', avatar: null, tz: '' };
    }
    // hanya field Google yang diperbarui; displayName & avatar kustom tidak pernah ditimpa
    p.email = g.email;
    p.googleName = g.name;
    p.googlePicture = g.picture;
    p.lastLoginAt = now;
    if (tz && !p.tz) p.tz = tz;
    await db.setJSON(`u:${uid}:profile`, p);
    return p;
  });
  await createSession(req, res, uid);
  res.set('Cache-Control', 'no-store');
  res.json({ status: true, user: publicUser(profile), isNew });
}));

router.get('/session', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let uid = null;
  try { uid = await readSession(req); } catch (_) { uid = null; }
  const db = getDb();
  if (!uid || !db) return res.json({ status: true, user: null });
  const profile = await db.getJSON(`u:${uid}:profile`);
  return res.json({ status: true, user: profile ? publicUser(profile) : null });
}));

router.post('/logout', wrap(async (req, res) => {
  clearSession(req, res);
  res.json({ status: true });
}));

module.exports = router;
