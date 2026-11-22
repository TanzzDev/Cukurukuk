'use strict';
const express = require('express');
const { withLock } = require('../lib/kv');
const { wrap, HttpError, rateLimit } = require('../lib/http');
const { load } = require('../lib/shared');
const { publicUser, requireUser, cleanDisplayName, streakRules } = require('../lib/users');
const { sniffImage } = require('../lib/image');
const { saveAvatar, removeAvatar } = require('../lib/uploads');

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const listenLimit = rateLimit({ windowMs: 60_000, max: 120, name: 'listen' });

/* ───────── profil ───────── */
router.get('/', wrap(async (req, res) => {
  const { profile } = await requireUser(req);
  res.json({ status: true, user: publicUser(profile) });
}));

router.patch('/', wrap(async (req, res) => {
  const { uid, db } = await requireUser(req);
  const { isValidTimeZone } = await load('dates');
  const body = req.body || {};
  const name = 'displayName' in body ? cleanDisplayName(body.displayName) : undefined;
  const profile = await withLock(db, uid, async () => {
    const p = await db.getJSON(`u:${uid}:profile`);
    if (name !== undefined) p.displayName = name;
    if (isValidTimeZone(body.tz)) p.tz = body.tz;
    await db.setJSON(`u:${uid}:profile`, p);
    return p;
  });
  res.json({ status: true, user: publicUser(profile) });
}));

router.post('/avatar',
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '160kb' }),
  wrap(async (req, res) => {
    const { uid, db } = await requireUser(req);
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(415, 'unsupported_type', 'Format gambar harus PNG, JPEG, atau WebP.');
    if (buf.length > 150 * 1024) throw new HttpError(413, 'too_large', 'Ukuran gambar maksimal 150 KB.');
    const img = sniffImage(buf);
    if (!img) throw new HttpError(415, 'unsupported_type', 'Berkas bukan gambar PNG, JPEG, atau WebP yang valid.');
    if (img.width < 64 || img.height < 64) throw new HttpError(422, 'image_small', 'Dimensi gambar minimal 64×64 piksel.');
    if (img.width > 1024 || img.height > 1024) throw new HttpError(422, 'image_large', 'Dimensi gambar maksimal 1024×1024 piksel.');
    let saved;
    try {
      saved = await saveAvatar(uid, buf, img);
    } catch (e) {
      if (e.code === 'no_storage') throw new HttpError(503, 'no_storage', 'Penyimpanan gambar belum dikonfigurasi di server.');
      if (e.code === 'kv_too_large') throw new HttpError(413, 'too_large', 'Gambar terlalu besar untuk penyimpanan (maks 64 KB).');
      throw e;
    }
    let old = null;
    const profile = await withLock(db, uid, async () => {
      const p = await db.getJSON(`u:${uid}:profile`);
      old = p.avatar;
      p.avatar = saved;
      await db.setJSON(`u:${uid}:profile`, p);
      return p;
    });
    // KV memakai satu kunci per pengguna (sudah tertimpa); hanya bersihkan bila penyimpanan lama berbeda jenis/URL
    if (old && (old.kind !== 'kv' || saved.kind !== 'kv') && old.url !== saved.url) await removeAvatar(uid, old);
    res.json({ status: true, user: publicUser(profile) });
  }));

router.delete('/avatar', wrap(async (req, res) => {
  const { uid, db } = await requireUser(req);
  let old = null;
  const profile = await withLock(db, uid, async () => {
    const p = await db.getJSON(`u:${uid}:profile`);
    old = p.avatar;
    p.avatar = null;
    await db.setJSON(`u:${uid}:profile`, p);
    return p;
  });
  await removeAvatar(uid, old);
  res.json({ status: true, user: publicUser(profile) });
}));

/* ───────── pustaka (liked, playlist, artis) ───────── */
router.get('/library', wrap(async (req, res) => {
  const { uid, db } = await requireUser(req);
  const { normalizeLibrary } = await load('library');
  const doc = (await db.getJSON(`u:${uid}:library`)) || { rev: 0, library: null };
  res.json({ status: true, rev: doc.rev, library: normalizeLibrary(doc.library) });
}));

router.put('/library', express.json({ limit: '2mb' }), wrap(async (req, res) => {
  const { uid, db } = await requireUser(req);
  const { normalizeLibrary } = await load('library');
  const lib = normalizeLibrary(req.body?.library);
  const baseRev = Number(req.body?.baseRev) || 0;
  if (JSON.stringify(lib).length > 1_500_000) throw new HttpError(413, 'too_large', 'Pustaka terlalu besar untuk disimpan.');
  const out = await withLock(db, uid, async () => {
    const cur = (await db.getJSON(`u:${uid}:library`)) || { rev: 0, library: null };
    if (cur.rev !== baseRev) return { conflict: cur };
    const doc = { rev: cur.rev + 1, library: { ...lib, updatedAt: Date.now() } };
    await db.setJSON(`u:${uid}:library`, doc);
    return { doc };
  });
  if (out.conflict) {
    return res.status(409).json({ status: false, code: 'conflict', message: 'Pustaka diubah dari perangkat lain.', rev: out.conflict.rev, library: normalizeLibrary(out.conflict.library) });
  }
  return res.json({ status: true, rev: out.doc.rev });
}));

/* ───────── dengar, riwayat, Top 50, Streak ───────── */
async function loadListening(db, uid, profile, tzHint) {
  const L = await load('listening');
  const raw = await db.getJSON(`u:${uid}:listening`);
  return L.normalizeState(raw, profile.tz || tzHint || 'UTC');
}

/** Muat state, hitung ulang status dari data tersimpan, simpan bila instan pemulihan/rekaman berubah. */
async function loadSettled(db, uid, profile) {
  const L = await load('listening');
  return withLock(db, `${uid}:listening`, async () => {
    const state = await loadListening(db, uid, profile);
    const r = L.settleState(state, { now: Date.now(), tz: state.tz, rules: streakRules() });
    if (r.changed) await db.setJSON(`u:${uid}:listening`, r.state);
    return r;
  });
}

async function recordOf(uid, state, streak) {
  const S = await load('streak');
  return S.streakRecord(streak, { userId: uid, lastPlayAt: state.lastPlayAt, updatedAt: Date.now() });
}

router.get('/listening', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const { state } = await loadSettled(db, uid, profile);
  res.json({ status: true, state, rules: streakRules() });
}));

router.post('/listening', listenLimit, express.json({ limit: '256kb' }), wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const events = Array.isArray(req.body?.events) ? req.body.events : null;
  if (!events || events.length === 0 || events.length > 50) throw new HttpError(400, 'invalid_events', 'Kirim 1–50 event dengar.');
  const [L, D] = await Promise.all([load('listening'), load('dates')]);
  const tz = D.isValidTimeZone(profile.tz) ? profile.tz : D.isValidTimeZone(req.body?.tz) ? req.body.tz : 'UTC';
  const rules = streakRules();
  const out = await withLock(db, `${uid}:listening`, async () => {
    let state = await loadListening(db, uid, profile, tz);
    state = { ...state, tz };
    let accepted = 0;
    let transition = null;
    const unlocked = [];
    const rejected = { duplicate: 0, invalid: 0, no_credit: 0 };
    const sorted = events.slice().sort((a, b) => (Number(a?.ts) || 0) - (Number(b?.ts) || 0));
    for (const ev of sorted) {
      // Validasi SERVER: waktu server menjadi acuan (ts klien hanya dipercaya dalam jendela), dibatasi waktu nyata.
      const r = L.applyListening(state, ev, { now: Date.now(), tz, rules, strict: true });
      state = r.state;
      accepted += r.accepted || 0;
      if (r.rejected) rejected[r.rejected] = (rejected[r.rejected] || 0) + 1;
      if (r.newlyUnlocked) unlocked.push(...r.newlyUnlocked);
      if (r.transition && !transition) transition = r.transition;
    }
    const settled = L.settleState(state, { now: Date.now(), tz, rules });
    state = settled.state;
    await db.setJSON(`u:${uid}:listening`, state);
    return { state, accepted, rejected, unlocked, transition, streak: settled.streak };
  });
  const s = out.streak;
  res.json({
    status: true,
    accepted: out.accepted,
    rejected: out.rejected,
    newlyUnlocked: out.unlocked,
    transition: out.transition,
    celebrations: L.pendingCelebrations(out.state, s),
    summary: {
      status: s.status, current: s.current, best: s.best, totalDays: s.totalDays, needsToday: s.needsToday,
      todayQualified: s.todayQualified, todayPlays: s.todayPlays, nextMilestone: s.nextMilestone, recovery: s.recovery,
    },
    record: await recordOf(uid, out.state, s),
  });
}));

router.post('/listening/celebrate', express.json({ limit: '8kb' }), wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const L = await load('listening');
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter((x) => /^[mr]:[0-9-]{1,10}$/.test(x)).slice(0, 40);
  await withLock(db, `${uid}:listening`, async () => {
    const state = await loadListening(db, uid, profile);
    await db.setJSON(`u:${uid}:listening`, L.markCelebrated(state, ids));
  });
  res.json({ status: true });
}));

/** Gabungkan data dengar TAMU ke akun (idempoten). Hanya dipanggil setelah pengguna menyetujui. */
router.post('/listening/merge', express.json({ limit: '1500kb' }), wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const L = await load('listening');
  const guest = L.normalizeState(req.body?.state, profile.tz || 'UTC');
  const merged = await withLock(db, `${uid}:listening`, async () => {
    const cur = await loadListening(db, uid, profile);
    const m = L.settleState(L.mergeListening(cur, guest), { now: Date.now(), tz: cur.tz, rules: streakRules() }).state;
    await db.setJSON(`u:${uid}:listening`, m);
    return m;
  });
  res.json({ status: true, state: merged });
}));

/** Hapus riwayat & data Top 50. Streak, rekor, dan hari aktif TIDAK berubah. */
router.delete('/history', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  await withLock(db, `${uid}:listening`, async () => {
    const state = await loadListening(db, uid, profile);
    await db.setJSON(`u:${uid}:listening`, { ...state, history: [], tracks: {}, live: {} });
  });
  res.json({ status: true });
}));

router.get('/streak', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const { state, streak } = await loadSettled(db, uid, profile);
  res.json({ status: true, streak, record: await recordOf(uid, state, streak), history: streak.closedChains });
}));

router.get('/streak/calendar', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || ''));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new HttpError(400, 'invalid_month', 'Parameter month harus berformat YYYY-MM.');
  const S = await load('streak');
  const { state, streak } = await loadSettled(db, uid, profile);
  res.json({
    status: true,
    month: `${m[1]}-${m[2]}`,
    cells: S.monthGrid(state.daily, Number(m[1]), Number(m[2]), { rules: streakRules(), today: streak.today, streak }),
  });
}));

router.get('/top', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const range = ['all', '30d', '7d'].includes(req.query.range) ? req.query.range : 'all';
  const L = await load('listening');
  const state = await loadListening(db, uid, profile);
  res.json({ status: true, range, items: L.topTracks(state, { range, now: Date.now(), tz: state.tz, limit: 50 }) });
}));

router.get('/history', wrap(async (req, res) => {
  const { uid, db, profile } = await requireUser(req);
  const L = await load('listening');
  const state = await loadListening(db, uid, profile);
  res.json({ status: true, groups: L.historyGroups(state, { now: Date.now(), tz: state.tz, query: String(req.query.q || '').slice(0, 80) }) });
}));

module.exports = router;
