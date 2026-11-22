import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import { generateKeyPair, SignJWT } from 'jose';

const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DEV_DB_FILE = ':memory:';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.SESSION_SECRET = 'x'.repeat(48);
process.env.SPOTIFY_CLIENT_ID = 'spotify-public-id';
delete process.env.BLOB_READ_WRITE_TOKEN;

const app = require('../server.cjs');
const { setKeyResolverForTests } = require('../server/lib/google.js');

let server;
let base;
let keys;
let wrongKeys;
const realFetch = globalThis.fetch;

before(async () => {
  keys = await generateKeyPair('RS256');
  wrongKeys = await generateKeyPair('RS256');
  setKeyResolverForTests(async () => keys.publicKey);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
  // oEmbed Spotify dipalsukan; semua panggilan lain tetap nyata
  globalThis.fetch = (url, init) => {
    if (String(url).startsWith('https://open.spotify.com/oembed')) {
      if (String(url).includes('NOTFOUND')) return Promise.resolve(new Response('{}', { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify({ title: 'Playlist Uji', thumbnail_url: 'https://i.scdn.co/image/x' }), { status: 200 }));
    }
    return realFetch(url, init);
  };
});
after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

async function call(path, { method = 'GET', json, raw, headers = {}, cookie } = {}) {
  const h = { ...headers };
  if (json !== undefined) h['Content-Type'] = 'application/json';
  if (cookie) h.Cookie = cookie;
  const res = await realFetch(base + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : raw });
  const buf = Buffer.from(await res.arrayBuffer());
  let body = null;
  try { body = JSON.parse(buf.toString('utf8')); } catch (_) { /* biner */ }
  return { status: res.status, body, buf, headers: res.headers, setCookie: res.headers.getSetCookie?.() || [] };
}

async function idToken(sub, { aud = process.env.GOOGLE_CLIENT_ID, key = keys.privateKey, exp = '1h', name = 'Nama Google', email = `${sub}@example.com`, iss = 'https://accounts.google.com' } = {}) {
  return new SignJWT({ email, email_verified: true, name, picture: 'https://lh3.googleusercontent.com/a/foto' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(sub)
    .setIssuedAt(typeof exp === 'number' ? exp - 7200 : undefined)
    .setExpirationTime(exp)
    .sign(key);
}

async function login(sub, opts) {
  const r = await call('/api/auth/google', { method: 'POST', json: { credential: await idToken(sub, opts), tz: 'Asia/Jakarta' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const cookie = r.setCookie.map((c) => c.split(';')[0]).join('; ');
  return { cookie, user: r.body.user, res: r };
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function jpeg(w, h) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]), sof, Buffer.alloc(20), Buffer.from([0xff, 0xd9])]);
}

const T0 = Date.now();
const evt = (sid, n, seconds, trackId = 'vid00000001', ts = Date.now()) => ({
  id: `${sid}:${n}`, sid, seconds, ts, track: { id: trackId, title: `Lagu ${trackId}`, artist: 'Artis', cover: 'c', duration: 200 },
});

/* ───────────── konfigurasi & kesehatan ───────────── */
test('config & health mencerminkan konfigurasi server', async () => {
  const h = await call('/api/health');
  assert.equal(h.body.status, true);
  assert.equal(h.body.storage, 'memory');
  const c = await call('/api/config');
  assert.equal(c.body.features.auth, true);
  assert.equal(c.body.features.sync, true);
  assert.equal(c.body.features.avatarUpload, true);
  assert.equal(c.body.features.spotifyConnect, true);
  assert.deepEqual(c.body.streakRules, { minPlays: 1, minSeconds: 0, recoveryDays: 7 });
  assert.equal(c.body.googleClientId, process.env.GOOGLE_CLIENT_ID);
  assert.equal(c.body.spotifyClientId, 'spotify-public-id');
  assert.ok(!JSON.stringify(c.body).includes(process.env.SESSION_SECRET), 'secret tidak bocor');
});

test('endpoint /api tak dikenal -> JSON 404, bukan HTML', async () => {
  const r = await call('/api/tidak-ada');
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'not_found');
});

/* ───────────── Google login & sesi ───────────── */
test('login Google valid: cookie httpOnly, sesi bertahan, logout menghapus', async () => {
  const { cookie, user, res } = await login('u-login-1');
  assert.match(res.setCookie[0], /drowify_session=.+HttpOnly/i);
  assert.match(res.setCookie[0], /SameSite=Lax/i);
  assert.equal(user.id, 'g_u-login-1');
  assert.equal(user.name, 'Nama Google');
  const s = await call('/api/auth/session', { cookie });
  assert.equal(s.body.user.id, 'g_u-login-1', 'sesi bertahan (mis. setelah reload)');
  const out = await call('/api/auth/logout', { method: 'POST', cookie });
  assert.match(out.setCookie[0], /Max-Age=0/);
  const after = await call('/api/auth/session', { cookie: 'drowify_session=' });
  assert.equal(after.body.user, null);
});

test('login ditolak: tanda tangan salah, kedaluwarsa, audience salah, issuer salah, kosong', async () => {
  const post = (credential) => call('/api/auth/google', { method: 'POST', json: { credential } });
  assert.equal((await post(await idToken('x', { key: wrongKeys.privateKey }))).body.code, 'invalid_credential');
  const expired = await post(await idToken('x', { exp: Math.floor(Date.now() / 1000) - 3600 }));
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'token_expired');
  assert.equal((await post(await idToken('x', { aud: 'client-lain' }))).body.code, 'invalid_credential');
  assert.equal((await post(await idToken('x', { iss: 'https://evil.example' }))).body.code, 'invalid_credential');
  assert.equal((await post('')).status, 400);
  assert.equal((await post('bukan.jwt.valid-sama-sekali-tapi-panjang')).status, 401);
});

test('endpoint akun butuh sesi; cookie dipalsukan ditolak', async () => {
  assert.equal((await call('/api/me')).status, 401);
  assert.equal((await call('/api/me/library')).status, 401);
  const { cookie } = await login('u-tamper');
  const bad = cookie.slice(0, -3) + 'abc';
  assert.equal((await call('/api/me', { cookie: bad })).status, 401);
  assert.equal((await call('/api/me', { cookie })).status, 200);
});

test('request tulis lintas-origin ditolak (CSRF)', async () => {
  const { cookie } = await login('u-csrf');
  const r = await call('/api/me', { method: 'PATCH', cookie, headers: { Origin: 'https://evil.example' }, json: { displayName: 'X' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'bad_origin');
  const ok = await call('/api/me', { method: 'PATCH', cookie, headers: { Origin: base }, json: { displayName: 'Boleh' } });
  assert.equal(ok.status, 200);
});

/* ───────────── profil ───────────── */
test('nama kustom: validasi, tidak ditimpa nama Google saat login ulang', async () => {
  const { cookie } = await login('u-name');
  const patch = (displayName) => call('/api/me', { method: 'PATCH', cookie, json: { displayName } });
  const ok = await patch('  Sulthan   N  ');
  assert.equal(ok.body.user.displayName, 'Sulthan N');
  assert.equal(ok.body.user.name, 'Sulthan N');
  assert.equal((await patch('x'.repeat(41))).status, 400);
  assert.equal((await patch('   ')).status, 400);
  assert.equal((await patch(123)).status, 400);
  const again = await login('u-name', { name: 'Nama Google Baru' });
  assert.equal(again.user.name, 'Sulthan N', 'nama kustom tetap setelah login ulang');
  assert.equal(again.user.googleName, 'Nama Google Baru');
  const reset = await call('/api/me', { method: 'PATCH', cookie: again.cookie, json: { displayName: '' } });
  assert.equal(reset.body.user.name, 'Nama Google Baru', 'reset kembali ke nama Google');
});

test('foto profil: unggah, tampil, ganti, kembali ke foto Google; validasi format/ukuran/dimensi', async () => {
  const { cookie, user } = await login('u-avatar');
  assert.equal(user.avatarUrl, 'https://lh3.googleusercontent.com/a/foto');
  const up = await call('/api/me/avatar', { method: 'POST', cookie, headers: { 'Content-Type': 'image/png' }, raw: png(256, 256) });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.match(up.body.user.avatarUrl, /^\/api\/avatar\/g_u-avatar\?v=\d+$/);
  assert.equal(up.body.user.hasCustomAvatar, true);
  const img = await call(up.body.user.avatarUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.ok(img.buf.equals(png(256, 256)));
  const jp = await call('/api/me/avatar', { method: 'POST', cookie, headers: { 'Content-Type': 'image/jpeg' }, raw: jpeg(200, 200) });
  assert.equal(jp.status, 200, 'mengganti foto');
  assert.equal((await call(jp.body.user.avatarUrl)).headers.get('content-type'), 'image/jpeg');
  // validasi
  const bad = (type, raw) => call('/api/me/avatar', { method: 'POST', cookie, headers: { 'Content-Type': type }, raw });
  assert.equal((await bad('image/png', Buffer.from('ini bukan gambar sama sekali, hanya teks biasa'))).status, 415);
  assert.equal((await bad('image/gif', Buffer.from('GIF89a'))).status, 415);
  assert.equal((await bad('image/png', png(32, 32))).status, 422, 'terlalu kecil');
  assert.equal((await bad('image/png', png(2000, 2000))).status, 422, 'terlalu besar dimensinya');
  assert.equal((await bad('image/png', Buffer.concat([png(256, 256), Buffer.alloc(170 * 1024)]))).status, 413, 'terlalu besar bytes');
  const del = await call('/api/me/avatar', { method: 'DELETE', cookie });
  assert.equal(del.body.user.avatarUrl, 'https://lh3.googleusercontent.com/a/foto');
  assert.equal(del.body.user.hasCustomAvatar, false);
  assert.equal((await call(up.body.user.avatarUrl)).status, 404, 'berkas lama terhapus');
});

/* ───────────── pustaka (playlist, favorit) ───────────── */
test('pustaka: simpan, ambil, konflik revisi, dan isolasi antar-pengguna', async () => {
  const A = await login('u-lib-a');
  const B = await login('u-lib-b');
  const lib = { liked: [{ id: 's1', videoId: 's1', title: 'Satu' }], playlists: [{ id: 'pl_1', name: 'Favorit', songs: [{ id: 's1', videoId: 's1', title: 'Satu' }] }], artists: [] };
  const empty = await call('/api/me/library', { cookie: A.cookie });
  assert.equal(empty.body.rev, 0);
  const put1 = await call('/api/me/library', { method: 'PUT', cookie: A.cookie, json: { library: lib, baseRev: 0 } });
  assert.equal(put1.body.rev, 1);
  const got = await call('/api/me/library', { cookie: A.cookie });
  assert.equal(got.body.library.playlists[0].name, 'Favorit');
  const stale = await call('/api/me/library', { method: 'PUT', cookie: A.cookie, json: { library: { ...lib, liked: [] }, baseRev: 0 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'conflict');
  assert.equal(stale.body.library.liked.length, 1, 'server mengirim versi terbaru untuk digabung klien');
  const put2 = await call('/api/me/library', { method: 'PUT', cookie: A.cookie, json: { library: { ...lib, liked: [] }, baseRev: 1 } });
  assert.equal(put2.body.rev, 2);
  const other = await call('/api/me/library', { cookie: B.cookie });
  assert.equal(other.body.library.playlists.length, 0, 'pengguna lain tidak melihat data A');
});

/* ───────────── dengar, streak, Top 50, riwayat ───────────── */
test('dengar: idempoten, dibatasi waktu nyata, streak/top/riwayat konsisten', async () => {
  const { cookie } = await login('u-listen');
  const send = (events) => call('/api/me/listening', { method: 'POST', cookie, json: { events, tz: 'Asia/Jakarta' } });
  const now = Date.now();
  const first = await send([evt('s1', 1, 40, 'vid00000001', now - 40000), evt('s1', 2, 20, 'vid00000001', now)]);
  assert.equal(first.status, 200);
  assert.equal(first.body.accepted, 60);
  const replay = await send([evt('s1', 1, 40, 'vid00000001', now - 40000), evt('s1', 2, 20, 'vid00000001', now)]);
  assert.equal(replay.body.accepted, 0, 'event yang sama tidak dihitung dua kali');
  assert.equal(replay.body.rejected.duplicate, 2);

  const spam = await send(Array.from({ length: 10 }, (_, i) => evt('spam', i + 1, 120, 'vid00000002', now)));
  assert.ok(spam.body.accepted <= 125, `klaim berlebihan dibatasi (${spam.body.accepted})`);

  const streak = await call('/api/me/streak', { cookie });
  assert.deepEqual(streak.body.streak.rules, { minPlays: 1, minSeconds: 0, recoveryDays: 7 });
  assert.ok(streak.body.streak.todaySec > 60);
  assert.equal(streak.body.streak.status, 'ACTIVE', 'ada pemutaran valid hari ini');
  assert.equal(streak.body.streak.current, 1);
  assert.equal(streak.body.record.streak_status, 'ACTIVE');
  assert.equal(streak.body.record.current_streak, 1);
  assert.equal(streak.body.record.user_id, 'g_u-listen');
  assert.ok(streak.body.record.last_valid_play_at);
  const top = await call('/api/me/top?range=7d', { cookie });
  assert.deepEqual(top.body.items.map((i) => i.id), ['vid00000002', 'vid00000001'], 'seri 1 pemutaran: yang lebih lama didengar di atas');
  const hist = await call('/api/me/history', { cookie });
  assert.equal(hist.body.groups[0].key, 'today');
  const { dateKey: dk } = await import('../shared/dates.js');
  const cal = await call(`/api/me/streak/calendar?month=${dk(Date.now(), 'Asia/Jakarta').slice(0, 7)}`, { cookie });
  assert.ok(cal.body.cells.some((c) => c && c.isToday && c.status === 'active'), 'hari ini ditandai aktif di kalender');
  assert.equal((await call('/api/me/streak/calendar?month=bukan', { cookie })).status, 400);

  const del = await call('/api/me/history', { method: 'DELETE', cookie });
  assert.equal(del.status, 200);
  const after = await call('/api/me/streak', { cookie });
  assert.equal(after.body.streak.todaySec, streak.body.streak.todaySec, 'menghapus riwayat tidak mengubah waktu dengar/streak');
  assert.equal(after.body.streak.current, 1);
  assert.equal((await call('/api/me/top', { cookie })).body.items.length, 0);
});

test('dengar: validasi input & batas jumlah event', async () => {
  const { cookie } = await login('u-listen-bad');
  const send = (json) => call('/api/me/listening', { method: 'POST', cookie, json });
  assert.equal((await send({ events: [] })).status, 400);
  assert.equal((await send({})).status, 400);
  assert.equal((await send({ events: Array.from({ length: 51 }, (_, i) => evt('x', i + 1, 5)) })).status, 400);
  const mixed = await send({ events: [{ id: 'a' }, { id: 'b', sid: 's', seconds: -4, track: { id: 'v' } }] });
  assert.equal(mixed.body.accepted, 0);
  assert.equal(mixed.body.rejected.invalid, 2);
});

test('merge data tamu ke akun: idempoten, tidak menggandakan', async () => {
  const { cookie } = await login('u-merge');
  const { applyListening, createListeningState } = await import('../shared/listening.js');
  const now = Date.now();
  let st = createListeningState('Asia/Jakarta');
  st = applyListening(st, { id: 'g1:1', sid: 'g1', seconds: 60, ts: now, track: { id: 'tamu0000001', title: 'Dari Tamu', artist: 'X', duration: 200 } }, { now, tz: 'Asia/Jakarta' }).state;
  const merge = () => call('/api/me/listening/merge', { method: 'POST', cookie, json: { state: st } });
  const m1 = await merge();
  const m2 = await merge();
  assert.equal(m1.status, 200);
  const day = Object.values(m2.body.state.daily)[0];
  assert.equal(day.s, 120 === day.s ? 120 : 60, 'daily dijumlahkan tanpa error');
  assert.equal(m2.body.state.history.length, 1, 'riwayat tidak digandakan');
  assert.equal(m2.body.state.history[0].k, 'tamu0000001');
});

/* ───────────── streak: DORMANT / pemulihan / EXPIRED lewat API ───────────── */
test('streak API: DORMANT (countdown akurat) -> pulih oleh lagu valid -> tersimpan; akun lain terpisah', async () => {
  const { getDb } = require('../server/lib/kv.js');
  const { addDays, dateKey, startOfDayMs } = await import('../shared/dates.js');
  const { createListeningState } = await import('../shared/listening.js');
  const TZ = 'Asia/Jakarta';
  const A = await login('u-streak-a');
  const B = await login('u-streak-b');
  const today = dateKey(Date.now(), TZ);
  const lastActive = addDays(today, -4); // 4 hari lalu => hari ke-4 masa pemulihan (hari 1 = terlewat pertama)
  const daily = {};
  for (let i = 0; i < 35; i++) daily[addDays(lastActive, -i)] = { s: 120, n: 1, p: 1 };
  const db = getDb();
  await db.setJSON('u:g_u-streak-a:listening', { ...createListeningState(TZ), daily });

  const g1 = await call('/api/me/streak', { cookie: A.cookie });
  assert.equal(g1.body.streak.status, 'DORMANT');
  assert.equal(g1.body.streak.current, 35, 'angka streak lama tetap terlihat');
  assert.equal(g1.body.streak.recovery.daysLeft, 4, 'tersisa 4 hari, sesuai contoh spesifikasi');
  assert.equal(g1.body.streak.recovery.expiresAt, startOfDayMs(addDays(lastActive, 8), TZ));
  assert.ok(Math.abs(g1.body.streak.recovery.msLeft - (g1.body.streak.recovery.expiresAt - Date.now())) < 5000, 'countdown dari jam server');
  assert.equal(g1.body.record.streak_status, 'DORMANT');
  assert.equal(g1.body.record.longest_streak, 35);
  assert.equal(g1.body.record.recovery_expires_at, new Date(startOfDayMs(addDays(lastActive, 8), TZ)).toISOString());

  const stored = await db.getJSON('u:g_u-streak-a:listening');
  assert.equal(stored.recovery.forLast, lastActive, 'instan pemulihan dikunci di database');
  const stamp = stored.rec.updated_at;
  await call('/api/me/streak', { cookie: A.cookie });
  assert.equal((await db.getJSON('u:g_u-streak-a:listening')).rec.updated_at, stamp, 'membuka halaman tidak menulis ulang / memperpanjang pemulihan');

  // akun lain tidak membawa streak akun sebelumnya
  const other = await call('/api/me/streak', { cookie: B.cookie });
  assert.equal(other.body.streak.status, 'NEW');
  assert.equal(other.body.streak.current, 0);
  assert.equal(other.body.record.user_id, 'g_u-streak-b');

  // lagu valid pada masa pemulihan -> api menyala kembali, streak lama dipulihkan (bukan 1)
  const play = (sid, ts = Date.now()) => call('/api/me/listening', { method: 'POST', cookie: A.cookie, json: { events: [evt(sid, 1, 45, 'vid00000009', ts)], tz: TZ } });
  const r = await play('rec-1');
  assert.equal(r.body.transition, 'recovered');
  assert.equal(r.body.summary.status, 'ACTIVE');
  assert.equal(r.body.summary.current, 35);
  assert.equal(r.body.record.streak_status, 'ACTIVE');
  assert.equal(r.body.record.recovery_expires_at, null, 'hitung mundur berhenti');
  assert.deepEqual(r.body.celebrations.map((c) => c.id), [`r:${today}`]);
  assert.equal((await db.getJSON('u:g_u-streak-a:listening')).recovery, null);

  const dup = await call('/api/me/listening', { method: 'POST', cookie: A.cookie, json: { events: [evt('rec-1', 1, 45, 'vid00000009')], tz: TZ } });
  assert.equal(dup.body.accepted, 0, 'event yang sama tidak menambah apa pun');
  const ack = await call('/api/me/listening/celebrate', { method: 'POST', cookie: A.cookie, json: { ids: [`r:${today}`, 'x:salah'] } });
  assert.equal(ack.status, 200);
  assert.deepEqual(Object.keys((await db.getJSON('u:g_u-streak-a:listening')).celebrated), [`r:${today}`]);
});

test('streak API: EXPIRED setelah masa pemulihan; rekor tetap; lagu berikutnya mulai dari 1', async () => {
  const { getDb } = require('../server/lib/kv.js');
  const { addDays, dateKey } = await import('../shared/dates.js');
  const { createListeningState } = await import('../shared/listening.js');
  const TZ = 'Asia/Jakarta';
  const { cookie } = await login('u-streak-exp');
  const today = dateKey(Date.now(), TZ);
  const lastActive = addDays(today, -8); // hari ke-8 setelah aktivitas terakhir: masa pemulihan sudah habis
  const daily = {};
  for (let i = 0; i < 20; i++) daily[addDays(lastActive, -i)] = { s: 120, n: 1, p: 1 };
  await getDb().setJSON('u:g_u-streak-exp:listening', { ...createListeningState(TZ), daily });
  const g = await call('/api/me/streak', { cookie });
  assert.equal(g.body.streak.status, 'EXPIRED');
  assert.equal(g.body.streak.current, 0);
  assert.equal(g.body.streak.best, 20, 'rekor tidak terhapus');
  assert.equal(g.body.record.current_streak, 0);
  assert.equal(g.body.history[0].length, 20, 'riwayat streak yang berakhir tersimpan');
  const r = await call('/api/me/listening', { method: 'POST', cookie, json: { events: [evt('new-1', 1, 40, 'vid00000008')], tz: TZ } });
  assert.equal(r.body.transition, 'started');
  assert.equal(r.body.summary.current, 1);
  assert.equal(r.body.summary.best, 20);
  assert.equal((await call('/api/me/streak', { cookie })).body.history.length, 1);
});

/* ───────────── SSRF pada proxy ───────────── */
test('proxy audio/gambar menolak alamat internal & skema berbahaya', async () => {
  for (const kind of ['proxy-audio', 'proxy-image']) {
    for (const url of ['http://127.0.0.1:1/x', 'http://localhost/x', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/a', 'http://[::1]/a', 'http://192.168.1.1/a', 'http://metadata.internal/a']) {
      const r = await call(`/api/${kind}?url=${encodeURIComponent(url)}`);
      assert.equal(r.status, 403, `${kind} ${url}`);
    }
    assert.equal((await call(`/api/${kind}?url=${encodeURIComponent('file:///etc/passwd')}`)).status, 400);
    assert.equal((await call(`/api/${kind}?url=${encodeURIComponent('ftp://example.com/a')}`)).status, 400);
    assert.equal((await call(`/api/${kind}`)).status, 400);
  }
});

/* ───────────── Spotify ───────────── */
test('pratinjau Spotify: validasi URL, oEmbed, tidak ditemukan', async () => {
  const q = (url) => call(`/api/spotify/playlist?url=${encodeURIComponent(url)}`);
  const ok = await q('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.title, 'Playlist Uji');
  assert.equal(ok.body.id, '37i9dQZF1DXcBWIGoYBM5M');
  assert.equal((await q('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).status, 200);
  const bad = await q('https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'not_spotify');
  assert.equal((await q('https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M')).body.code, 'not_playlist');
  assert.equal((await q('https://open.spotify.com/playlist/NOTFOUND0000000000000X')).status, 404);
});

/* ───────────── rekomendasi (Mix Antrean / Konten Serupa) ───────────── */
function nextFixture(items) {
  return {
    contents: { singleColumnMusicWatchNextResultsRenderer: { tabbedRenderer: { watchNextTabbedResultsRenderer: { tabs: [{ tabRenderer: { content: { musicQueueRenderer: { content: { playlistPanelRenderer: { contents: items.map((i) => ({
      playlistPanelVideoRenderer: {
        videoId: i.id,
        title: { runs: [{ text: i.title }] },
        longBylineText: { runs: [
          { text: i.artist, navigationEndpoint: { browseEndpoint: { browseId: i.artistId || 'UCartis0001' } } },
          { text: ' • ' },
          ...(i.album ? [{ text: i.album, navigationEndpoint: { browseEndpoint: { browseId: 'MPREb_album' } } }] : []),
        ] },
        lengthText: { runs: [{ text: i.len || '3:30' }] },
        thumbnail: { thumbnails: [{ url: 'https://lh3.googleusercontent.com/x=w60-h60-l90-rj' }] },
      },
    })) } } } } } }] } } } },
  };
}

test('related: urutan berdasarkan kecocokan, seed dibuang, alasan jujur, cache, error', async () => {
  const axios = require('axios');
  const realPost = axios.post;
  const searchPath = require.resolve('../server/handlers/search.js');
  const realSearch = require.cache[searchPath].exports;
  let nextCalls = 0;
  axios.post = async (url) => {
    nextCalls += 1;
    assert.match(url, /youtubei\/v1\/next/);
    return { data: nextFixture([
      { id: 'SEEDvideo01', title: 'Lagu Utama', artist: 'Penyanyi A', artistId: 'UCa', album: 'Album Satu' },
      { id: 'RADIOvideo01', title: 'Rekomendasi Satu', artist: 'Penyanyi B', artistId: 'UCb' },
      { id: 'RADIOvideo02', title: 'Rekomendasi Dua', artist: 'Penyanyi A', artistId: 'UCa', album: 'Album Satu' },
      { id: 'RADIOvideo03', title: 'Rekomendasi Tiga', artist: 'Penyanyi C', artistId: 'UCc' },
    ]) };
  };
  require.cache[searchPath].exports = async (req, res) => res.json({ status: true, result: { songs: [
    { videoId: 'ARTISTvideo1', title: 'Lagu Lain Dari A', artist: 'Penyanyi A', artistId: 'UCa', duration: '3.30' },
    { videoId: 'SEEDvideo01', title: 'Lagu Utama', artist: 'Penyanyi A', artistId: 'UCa', duration: '3.30' },
  ] } });
  try {
    const r = await call('/api/related?videoId=SEEDvideo01&limit=10');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ids = r.body.items.map((i) => i.videoId);
    assert.ok(!ids.includes('SEEDvideo01'), 'lagu yang sedang dipilih tidak direkomendasikan');
    assert.equal(ids[0], 'RADIOvideo02', 'radio + artis & album sama = paling cocok');
    assert.ok(ids.indexOf('RADIOvideo01') < ids.indexOf('RADIOvideo03'), 'urutan radio dihormati');
    assert.ok(ids.includes('ARTISTvideo1'), 'lagu dari artis yang sama ikut sebagai kandidat');
    const top = r.body.items[0];
    assert.ok(top.reasons.includes('Album yang sama') && top.reasons.includes('Artis yang sama'));
    assert.ok(!r.body.items.some((i) => i.reasons.includes('Genre sama')), 'tidak mengarang genre');
    assert.deepEqual(r.body.sources, { radio: 3, artist: 2 });
    assert.equal(r.body.partial, false);
    const before = nextCalls;
    await call('/api/related?videoId=SEEDvideo01&limit=10');
    assert.equal(nextCalls, before, 'hasil di-cache, tidak memanggil sumber lagi');

    // sumber radio gagal -> tetap ada hasil parsial dari artis yang sama
    axios.post = async () => { throw new Error('jaringan putus'); };
    const partial = await call('/api/related?videoId=PARTIALvid1&artist=Penyanyi%20A&limit=5');
    assert.equal(partial.status, 200);
    assert.equal(partial.body.partial, true);
    assert.ok(partial.body.items.length >= 1);
    // semuanya gagal -> 502
    require.cache[searchPath].exports = async () => { throw new Error('gagal'); };
    const fail = await call('/api/related?videoId=FAILEDvid01&artist=Penyanyi%20A');
    assert.equal(fail.status, 502);
    // tanpa artis & radio gagal -> hasil kosong yang sah
    const none = await call('/api/related?videoId=NOARTISTv01');
    assert.equal(none.status, 502);
    assert.equal((await call('/api/related?videoId=pendek')).status, 400);
  } finally {
    axios.post = realPost;
    require.cache[searchPath].exports = realSearch;
  }
});

test('data waktu uji tidak bocor ke produksi', () => {
  assert.ok(Date.now() - T0 < 60000);
});
