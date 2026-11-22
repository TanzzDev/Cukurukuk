import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dateKey, diffDays, isValidTimeZone } from '../shared/dates.js';
import { applyListening, createListeningState, historyGroups, mergeListening, normalizeState, topTracks, listeningStats, recentTracks } from '../shared/listening.js';
import { appendUnique, clearUpcoming, insertNext, mixQueue, moveItem, removeAt, parseDurationText } from '../shared/queue.js';
import { matchTrack, normalizeSpotifyPage, parseSpotifyPlaylist, parseTrackListText } from '../shared/spotify.js';
import { mergeLibrary } from '../shared/library.js';

const ID22 = '37i9dQZF1DXcBWIGoYBM5M';
const NOW = Date.UTC(2026, 10, 13, 5, 0, 0); // 13 Nov 2026 12:00 WIB
const TODAY = '2026-11-13';

const track = (id = 'vid1', extra = {}) => ({ id, title: `Judul ${id}`, artist: 'Artis', cover: `c/${id}`, duration: 200, ...extra });
let seq = 0;
const ev = (sid, seconds, ts, id = 'vid1', tr = {}) => ({ id: `${sid}:${++seq}`, sid, seconds, ts, track: track(id, tr) });

/* ───────────── tanggal & zona waktu ───────────── */
test('dateKey mengikuti zona waktu pengguna', () => {
  const t = Date.UTC(2026, 10, 12, 17, 30, 0); // 00:30 WIB tgl 13
  assert.equal(dateKey(t, 'UTC'), '2026-11-12');
  assert.equal(dateKey(t, 'Asia/Jakarta'), '2026-11-13');
  assert.equal(dateKey(t, 'America/Los_Angeles'), '2026-11-12');
  assert.equal(dateKey(t, 'Zona/Ngawur'), '2026-11-12', 'zona tidak valid jatuh ke UTC');
  assert.equal(isValidTimeZone('Asia/Jakarta'), true);
  assert.equal(isValidTimeZone('x'.repeat(100)), false);
});

test('addDays/diffDays aman lintas bulan, tahun, dan DST', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09'); // DST AS
  assert.equal(diffDays('2026-11-01', '2026-11-13'), 12);
});

/* ───────────── pencatatan dengar ───────────── */
test('pemutaran valid baru tercatat setelah >= 30 detik; riwayat tidak ganda', () => {
  let st = createListeningState('UTC');
  const ctx = { now: NOW, tz: 'UTC' };
  let r = applyListening(st, ev('s1', 20, NOW), ctx);
  st = r.state;
  assert.equal(st.history.length, 0, 'baru 20 detik: belum valid');
  assert.equal(st.tracks.vid1.p, 0);
  r = applyListening(st, ev('s1', 15, NOW + 15000), ctx);
  st = r.state;
  assert.equal(st.history.length, 1);
  assert.equal(st.tracks.vid1.p, 1);
  r = applyListening(st, ev('s1', 30, NOW + 45000), ctx);
  st = r.state;
  assert.equal(st.history.length, 1, 'sesi yang sama tidak membuat riwayat baru');
  assert.equal(st.history[0].s, 65);
  assert.equal(st.daily[TODAY].s, 65);
  assert.equal(st.daily[TODAY].n, 1);
  assert.equal(st.daily[TODAY].p, 1);
});

test('lagu pendek dihitung valid pada separuh durasi', () => {
  let st = createListeningState('UTC');
  const r = applyListening(st, ev('short', 10, NOW, 'pendek', { duration: 20 }), { now: NOW, tz: 'UTC' });
  assert.equal(r.state.history.length, 1);
});

test('event dengan id sama diabaikan (idempoten, tidak ada hitung ganda)', () => {
  const ctx = { now: NOW, tz: 'UTC' };
  const e = ev('dup', 40, NOW);
  const a = applyListening(createListeningState('UTC'), e, ctx);
  const b = applyListening(a.state, e, ctx);
  assert.equal(b.rejected, 'duplicate');
  assert.equal(b.state.daily[TODAY].s, 40);
});

test('input tidak valid ditolak', () => {
  const st = createListeningState('UTC');
  const ctx = { now: NOW, tz: 'UTC' };
  for (const bad of [{}, { id: 'x', sid: 's', seconds: -5, track: track() }, { id: 'x', sid: 's', seconds: 10, track: {} }, { id: 'x', sid: 's', seconds: NaN, track: track() }]) {
    assert.equal(applyListening(st, bad, ctx).accepted, 0);
  }
});

test('mode ketat (server): timestamp palsu & klaim berlebih dibatasi waktu nyata', () => {
  let st = createListeningState('UTC');
  const ctx = { now: NOW, tz: 'UTC', strict: true };
  const fake = applyListening(st, ev('x', 60, NOW - 5 * 86400000), ctx); // klaim 5 hari lalu
  assert.equal(Object.keys(fake.state.daily)[0], TODAY, 'ts di luar jendela dianggap sekarang');
  st = fake.state;
  let total = 60;
  for (let i = 0; i < 10; i++) {
    const r = applyListening(st, ev('x', 120, NOW), ctx); // 10 x 120 detik pada instan yang sama
    st = r.state;
    total += r.accepted;
  }
  assert.ok(total <= 130, `total diterima ${total} harus <= kredit waktu nyata`);
});

test('pergantian hari mengikuti zona waktu pengguna', () => {
  let st = createListeningState('Asia/Jakarta');
  const ctx = { tz: 'Asia/Jakarta' };
  const before = Date.UTC(2026, 10, 12, 16, 59, 0); // 23:59 WIB tgl 12
  const after = Date.UTC(2026, 10, 12, 17, 1, 0); // 00:01 WIB tgl 13
  st = applyListening(st, ev('d1', 30, before), { ...ctx, now: before }).state;
  st = applyListening(st, ev('d2', 30, after), { ...ctx, now: after }).state;
  assert.deepEqual(Object.keys(st.daily).sort(), ['2026-11-12', '2026-11-13']);
});

test('Top 50: urutan, filter 7/30 hari, perubahan peringkat', () => {
  let st = createListeningState('UTC');
  const play = (sid, id, dayKey, plays) => {
    for (let n = 0; n < plays; n++) {
      const ts = Date.parse(`${dayKey}T10:00:00Z`) + n * 1000;
      st = applyListening(st, { id: `${sid}-${n}`, sid: `${sid}-${n}`, seconds: 40, ts, track: track(id) }, { now: NOW, tz: 'UTC' }).state;
    }
  };
  play('old', 'lama', '2026-09-01', 5); // di luar 30 hari
  play('a', 'lagu-a', '2026-11-10', 3);
  play('b', 'lagu-b', '2026-11-12', 2);
  play('c', 'lagu-c', '2026-10-20', 4); // 30 hari ya, 7 hari tidak
  const all = topTracks(st, { range: 'all', now: NOW, tz: 'UTC' });
  assert.deepEqual(all.map((t) => t.id), ['lama', 'lagu-c', 'lagu-a', 'lagu-b']);
  assert.equal(all[0].rank, 1);
  const d30 = topTracks(st, { range: '30d', now: NOW, tz: 'UTC' });
  assert.deepEqual(d30.map((t) => t.id), ['lagu-c', 'lagu-a', 'lagu-b']);
  const d7 = topTracks(st, { range: '7d', now: NOW, tz: 'UTC' });
  assert.deepEqual(d7.map((t) => `${t.id}:${t.plays}`), ['lagu-a:3', 'lagu-b:2']);
  assert.equal(d30.length, 3, 'tidak ada lagu palsu untuk menggenapi 50');
});

test('riwayat dikelompokkan & statistik dari data nyata', () => {
  let st = createListeningState('UTC');
  const mk = (sid, id, ts) => applyListening(st, { id: sid, sid, seconds: 45, ts, track: track(id) }, { now: NOW, tz: 'UTC' }).state;
  st = mk('h1', 'v1', NOW - 3600000);
  st = mk('h2', 'v2', NOW - 86400000);
  st = mk('h3', 'v3', NOW - 3 * 86400000);
  st = mk('h4', 'v4', NOW - 20 * 86400000);
  const g = historyGroups(st, { now: NOW, tz: 'UTC' });
  assert.deepEqual(g.map((x) => x.key), ['today', 'yesterday', 'week', 'earlier']);
  assert.equal(historyGroups(st, { now: NOW, tz: 'UTC', query: 'v4' })[0].items.length, 1);
  assert.equal(recentTracks(st, 2).length, 2);
  const stats = listeningStats(st, { now: NOW, tz: 'UTC' });
  assert.equal(stats.totalPlays, 4);
  assert.equal(stats.uniqueTracks, 4);
});

test('mergeListening menjumlahkan & men-dedupe riwayat tamu ke akun', () => {
  const ctx = { now: NOW, tz: 'UTC' };
  const a = applyListening(createListeningState('UTC'), ev('A', 60, NOW, 'x'), ctx).state;
  const g = applyListening(createListeningState('UTC'), ev('G', 60, NOW, 'y'), ctx).state;
  const m1 = mergeListening(a, g);
  const m2 = mergeListening(m1, g);
  assert.equal(m1.daily[TODAY].s, 120);
  assert.equal(m1.history.length, 2);
  assert.equal(m2.history.length, 2, 'penggabungan ulang tidak menggandakan riwayat');
});

test('normalizeState menyaring data rusak', () => {
  const s = normalizeState({ daily: { bukan: { s: 5 }, '2026-01-01': { s: -3 }, '2026-01-02': { s: 50 } }, history: [{}, 3], tracks: { a: 5 }, tz: 'Ngawur' }, 'UTC');
  assert.deepEqual(Object.keys(s.daily), ['2026-01-02']);
  assert.equal(s.history.length, 0);
  assert.equal(s.tz, 'UTC');
});

/* ───────────── antrean ───────────── */
const Q = (...ids) => ids.map((id) => ({ id, videoId: id }));
const ids = (l) => l.map((t) => t.id).join('');

test('antrean: moveItem menjaga lagu yang sedang diputar', () => {
  assert.deepEqual(((r) => [ids(r.list), r.index])(moveItem(Q('a', 'b', 'c', 'd'), 1, 3, 0)), ['dabc', 2]);
  assert.deepEqual(((r) => [ids(r.list), r.index])(moveItem(Q('a', 'b', 'c', 'd'), 1, 1, 3)), ['acdb', 3]);
  assert.deepEqual(((r) => [ids(r.list), r.index])(moveItem(Q('a', 'b', 'c', 'd'), 2, 0, 3)), ['bcda', 1]);
});

test('antrean: hapus, sisip berikutnya, tambah tanpa duplikat', () => {
  assert.deepEqual(((r) => [ids(r.list), r.index])(removeAt(Q('a', 'b', 'c'), 2, 0)), ['bc', 1]);
  assert.equal(ids(removeAt(Q('a', 'b', 'c'), 1, 1).list), 'abc', 'lagu aktif tidak bisa dihapus');
  const n = insertNext(Q('a', 'b', 'c', 'd'), 0, Q('d', 'x'));
  assert.equal(ids(n.list), 'adxbc', 'urutan sisipan dipertahankan, duplikat dipindah');
  assert.equal(n.index, 0);
  const ap = appendUnique(Q('a', 'b'), 0, Q('b', 'c', 'c', 'd'));
  assert.equal(ids(ap.list), 'abcd');
  assert.equal(ap.added, 2);
});

test('antrean: Mix hanya mengacak setelah lagu aktif; hapus semua menyisakan lagu aktif', () => {
  let n = 0;
  const rng = () => ((n++ * 0.37) % 1);
  const m = mixQueue(Q('a', 'b', 'c', 'd', 'e', 'f'), 2, rng);
  assert.equal(ids(m.list.slice(0, 3)), 'abc');
  assert.equal([...ids(m.list.slice(3))].sort().join(''), 'def');
  const c = clearUpcoming(Q('a', 'b', 'c'), 1);
  assert.equal(ids(c.list), 'b');
  assert.equal(c.index, 0);
  assert.equal(parseDurationText('3.45'), 225);
  assert.equal(parseDurationText('1:02:03'), 3723);
});

/* ───────────── spotify ───────────── */
test('URL Spotify: format valid', () => {
  for (const u of [
    `https://open.spotify.com/playlist/${ID22}`,
    `https://open.spotify.com/playlist/${ID22}?si=abc123`,
    `https://open.spotify.com/intl-id/playlist/${ID22}?si=x&nd=1`,
    `open.spotify.com/playlist/${ID22}`,
    `spotify:playlist:${ID22}`,
    `  https://open.spotify.com/embed/playlist/${ID22}  `,
  ]) assert.deepEqual(parseSpotifyPlaylist(u), { ok: true, id: ID22 }, u);
});

test('URL Spotify: format tidak valid ditolak dengan alasan', () => {
  const r = (u) => parseSpotifyPlaylist(u).reason;
  assert.equal(r(''), 'empty');
  assert.equal(r('https://example.com/playlist/' + ID22), 'not_spotify');
  assert.equal(r('https://open.spotify.com.evil.com/playlist/' + ID22), 'not_spotify');
  assert.equal(r('https://open.spotify.com/track/' + ID22), 'not_playlist');
  assert.equal(r('spotify:track:' + ID22), 'not_playlist');
  assert.equal(r('https://open.spotify.com/playlist/pendek'), 'invalid_id');
  assert.equal(r('spotify:playlist:123'), 'invalid_id');
  assert.equal(r('https://spotify.link/abc'), 'short_link');
  assert.equal(r('halo dunia'), 'not_spotify');
  assert.equal(r('javascript:alert(1)'), 'not_spotify');
});

test('respons API Spotify 2026: item/track, episode, lokal, boolean', () => {
  const t = (id) => ({ type: 'track', id, name: `Lagu ${id}`, duration_ms: 200000, artists: [{ name: 'A' }, { name: 'B' }], album: { name: 'Alb', images: [{ url: 'big' }, { url: 'mid' }] } });
  const out = normalizeSpotifyPage({
    items: [{ item: t('a') }, { track: t('b') }, { track: true }, { item: { type: 'episode', id: 'e', name: 'E' } }, { item: { ...t('l'), is_local: true } }, null],
  });
  assert.deepEqual(out.tracks.map((x) => x.spotifyId), ['a', 'b']);
  assert.equal(out.skipped, 4);
  assert.deepEqual(out.tracks[0].artists, ['A', 'B']);
  assert.equal(out.tracks[0].cover, 'mid');
});

test('daftar lagu dari CSV (Exportify) dan baris teks', () => {
  const csv = '"Track URI","Track Name","Album Name","Artist Name(s)","Duration (ms)"\n"spotify:track:' + ID22 + '","Kota, Ini Takan","Album X","Nadhif Basalamah;Lain","210000"\n"spotify:track:' + ID22 + '","Kota, Ini Takan","Album X","Nadhif Basalamah","210000"\n"","Nina","Alb","feast","150000"';
  const r = parseTrackListText(csv);
  assert.equal(r.format, 'csv');
  assert.equal(r.tracks.length, 2, 'duplikat dibuang');
  assert.equal(r.tracks[0].title, 'Kota, Ini Takan');
  assert.deepEqual(r.tracks[0].artists, ['Nadhif Basalamah', 'Lain']);
  assert.equal(r.tracks[0].durationMs, 210000);
  const lines = parseTrackListText('Bahagia Lagi - Piche Kota\nNina\n\n', { order: 'title-artist' });
  assert.equal(lines.format, 'lines');
  assert.deepEqual(lines.tracks.map((x) => [x.title, x.artists[0] || '']), [['Bahagia Lagi', 'Piche Kota'], ['Nina', '']]);
  const rev = parseTrackListText('Piche Kota - Bahagia Lagi', { order: 'artist-title' });
  assert.equal(rev.tracks[0].title, 'Bahagia Lagi');
});

test('pencocokan lagu: memilih yang tepat, menolak yang meragukan', () => {
  const want = { title: 'Bahagia Lagi (feat. Seseorang)', artists: ['Piche Kota'], durationMs: 205000 };
  const cands = [
    { videoId: 'x1', title: 'Bahagia Lagi', artist: 'Piche Kota', duration: '3.25' },
    { videoId: 'x2', title: 'Bahagia Lagi (Cover)', artist: 'Penyanyi Lain', duration: '3.30' },
    { videoId: 'x3', title: 'Lagu Berbeda Total', artist: 'Piche Kota', duration: '3.25' },
  ];
  assert.equal(matchTrack(want, cands).candidate.videoId, 'x1');
  assert.equal(matchTrack({ title: 'Tidak Ada Sama Sekali', artists: ['Zzz'], durationMs: 100000 }, cands), null);
  assert.equal(matchTrack(want, []), null);
});

test('mergeLibrary: tanpa duplikat & idempoten', () => {
  const acc = { liked: [{ id: 'a' }], playlists: [{ id: 'pl1', name: 'A', songs: [] }], artists: [] };
  const guest = { liked: [{ id: 'a' }, { id: 'b' }], playlists: [{ id: 'pl1', name: 'Tamu', songs: [] }, { id: 'pl2', name: 'B', songs: [] }], artists: [{ artistId: 'z' }] };
  const m1 = mergeLibrary(acc, guest);
  const m2 = mergeLibrary(m1, guest);
  assert.deepEqual(m1.liked.map((t) => t.id), ['a', 'b']);
  assert.deepEqual(m1.playlists.map((p) => p.id), ['pl1', 'pl2']);
  assert.equal(m1.playlists[0].name, 'A', 'data akun diprioritaskan');
  assert.equal(m2.liked.length, 2);
  assert.equal(m2.playlists.length, 2);
});
