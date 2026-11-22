import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dateKey, startOfDayMs } from '../shared/dates.js';
import { MILESTONES } from '../shared/config.js';
import { computeStreak, dayDetail, monthGrid, streakRecord } from '../shared/streak.js';
import {
  applyListening, createListeningState, markCelebrated, normalizeState, pendingCelebrations, settleState,
} from '../shared/listening.js';

const TZ = 'Asia/Jakarta';
const at = (key, hh = 12, mm = 0, ss = 0, ms = 0) =>
  Date.parse(`${key}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}+07:00`);
const entry = (p = 1) => ({ s: 60 * p, n: p, p });
/** n hari berurutan berakhir di endKey */
function chain(endKey, n, p = 1) {
  const d = {};
  for (let i = 0; i < n; i++) d[addDays(endKey, -i)] = entry(p);
  return d;
}
const calc = (daily, now, extra = {}) => computeStreak(daily, { now, tz: TZ, ...extra });

// Contoh dari spesifikasi: 1 Nov streak 35 hari, 2 Nov tidak mendengarkan.
const L = '2026-11-01';
const base35 = chain(L, 35);

let n = 0;
const ev = (sid, seconds, ts, id = 'trk00000001', tr = {}) => ({ id: `${sid}:${++n}`, sid, seconds, ts, track: { id, title: 'Lagu', artist: 'A', duration: 200, ...tr } });
function listen(state, key, hh, mm = 0, ss = 0, { seconds = 40, id = 'trk00000001', sid = `s${++n}`, ms = 0 } = {}) {
  const ts = at(key, hh, mm, ss, ms);
  return applyListening(state, ev(sid, seconds, ts, id), { now: ts, tz: TZ });
}
const stateWith = (daily) => ({ ...createListeningState(TZ), daily });

/* ───────────── 1. setiap hari mendengarkan -> streak bertambah ───────────── */
test('S1: mendengarkan setiap hari menambah streak, status ACTIVE', () => {
  let st = createListeningState(TZ);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const key = addDays('2026-10-01', i);
    const r = listen(st, key, 9);
    st = r.state;
    seen.push(r.streak.current);
    assert.equal(r.streak.status, 'ACTIVE');
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

/* ───────────── timeline contoh spesifikasi ───────────── */
test('timeline contoh: 1 Nov aktif -> 2 Nov terlewat -> pemulihan 2..8 Nov -> hangus 9 Nov', () => {
  const a = calc(base35, at('2026-11-01'));
  assert.equal(a.status, 'ACTIVE');
  assert.equal(a.current, 35);
  assert.equal(a.needsToday, false);

  const pending = calc(base35, at('2026-11-02', 23, 59, 59));
  assert.equal(pending.status, 'ACTIVE', '2 Nov belum berakhir: api belum padam');
  assert.equal(pending.needsToday, true);

  const first = calc(base35, at('2026-11-03', 0, 0, 0));
  assert.equal(first.status, 'DORMANT', 'api padam begitu hari terlewat (2 Nov) berakhir');
  assert.equal(first.current, 35, 'angka streak lama tetap terlihat');
  assert.equal(first.recovery.missedFrom, '2026-11-02');
  assert.equal(first.recovery.lastRecoverable, '2026-11-08');
  assert.equal(first.recovery.daysLeft, 6);
  assert.equal(first.recovery.startedAt, at('2026-11-02', 0));
  assert.equal(first.recovery.expiresAt, at('2026-11-09', 0));

  const mid = calc(base35, at('2026-11-05', 12));
  assert.equal(mid.status, 'DORMANT');
  assert.equal(mid.recovery.daysLeft, 4, 'contoh spesifikasi: "tersisa 4 hari"');
  assert.equal(mid.recovery.msLeft, at('2026-11-09', 0) - at('2026-11-05', 12), 'countdown dari waktu nyata');
  assert.equal(mid.best, 35);

  const last = calc(base35, at('2026-11-08', 23, 59, 59, 999));
  assert.equal(last.status, 'DORMANT', '8 Nov sampai 23:59:59.999 masih bisa dipulihkan');
  assert.equal(last.recovery.daysLeft, 1);

  const gone = calc(base35, at('2026-11-09', 0, 0, 0));
  assert.equal(gone.status, 'EXPIRED', 'hangus tepat 00:00 hari ke-8 setelah aktivitas terakhir');
  assert.equal(gone.current, 0);
  assert.equal(gone.recovery, null);
  assert.equal(gone.best, 35, 'rekor tidak hilang');
  assert.equal(gone.closedChains[0].length, 35);
  assert.equal(gone.closedChains[0].expiredOn, '2026-11-09');
});

/* ───────────── 2-5. pemulihan ───────────── */
for (const [label, R, dayNo] of [['hari ke-2', '2026-11-03', 2], ['hari ke-5', '2026-11-06', 5], ['hari ke-4 (contoh spesifikasi)', '2026-11-05', 4]]) {
  test(`S3/S4: kembali pada ${label} masa pemulihan -> streak lama pulih (bukan 1)`, () => {
    const daily = { ...base35, [R]: entry() };
    const s = calc(daily, at(R, 20));
    assert.equal(s.status, 'ACTIVE');
    assert.equal(s.current, 35, `dipulihkan ke 35, bukan 1 dan belum 36 (hari pemulihan ke-${dayNo})`);
    assert.equal(s.recovery, null, 'hitung mundur pemulihan berhenti');
    assert.equal(s.recoveries.length, 1);
    assert.deepEqual(
      { from: s.recoveries[0].missedFrom, to: s.recoveries[0].missedTo, on: s.recoveries[0].recoveredOn, at: s.recoveries[0].streakAtRecovery },
      { from: '2026-11-02', to: addDays(R, -1), on: R, at: 35 },
    );
    const next = calc({ ...daily, [addDays(R, 1)]: entry() }, at(addDays(R, 1), 10));
    assert.equal(next.current, 36, 'hari aktif berikutnya melanjutkan perhitungan');
    assert.equal(next.best, 36);
  });
}

test('S5: tepat di batas akhir pemulihan (8 Nov 23:59:59) masih pulih; 9 Nov 00:00:00 hangus', () => {
  const st = stateWith(base35);
  const ok = listen(st, '2026-11-08', 23, 59, 59, { ms: 999 });
  assert.equal(ok.streak.status, 'ACTIVE');
  assert.equal(ok.streak.current, 35);
  assert.equal(ok.transition, 'recovered');

  const late = listen(st, '2026-11-09', 0, 0, 0);
  assert.equal(late.streak.status, 'ACTIVE');
  assert.equal(late.streak.current, 1, 'terlambat 1 milidetik: streak baru dimulai dari 1');
  assert.equal(late.transition, 'started');
  assert.equal(late.streak.closedChains[0].length, 35);
});

/* ───────────── 6-8. hangus, mulai baru, rekor ───────────── */
test('S6-S8: melewati masa pemulihan -> hangus; lagu berikutnya mulai dari 1; rekor tetap', () => {
  const old = chain('2026-06-01', 120); // rekor 120 hari
  const daily = { ...old, ...base35 };
  const expired = calc(daily, at('2026-11-20'));
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.current, 0);
  assert.equal(expired.best, 120);
  assert.equal(expired.closedChains.length, 2, 'riwayat streak lama tersimpan');
  assert.deepEqual(expired.closedChains.map((c) => c.length), [120, 35]);

  let st = stateWith(daily);
  const r = listen(st, '2026-11-20', 8);
  assert.equal(r.streak.current, 1);
  assert.equal(r.streak.status, 'ACTIVE');
  assert.equal(r.streak.best, 120);
  assert.equal(r.streak.closedChains.length, 2, 'riwayat lama tidak dihapus');
  const later = listen(r.state, '2026-11-21', 8);
  assert.equal(later.streak.current, 2);
});

test('pemulihan berulang dalam satu rantai & milestone dihitung dari hari aktif nyata', () => {
  // 5 hari, terlewat 1, pulih (tetap 5), lalu 2 hari lagi -> 7 pada hari aktif ke-3 setelah pulih
  const d = {};
  const D = (i) => addDays('2026-09-01', i);
  for (const i of [0, 1, 2, 3, 4]) d[D(i)] = entry(); // Sep 1-5 => 5
  d[D(6)] = entry(); // Sep 7 (Sep 6 terlewat) => pulih, tetap 5
  d[D(7)] = entry(); // 6
  d[D(8)] = entry(); // 7
  const s = calc(d, at(D(8), 10));
  assert.equal(s.current, 7);
  assert.equal(s.status, 'ACTIVE');
  assert.equal(s.milestones.find((m) => m.days === 7).achievedAt, D(8), 'milestone 7 dicapai pada hari aktif yang benar');
  assert.equal(s.recoveries.length, 1);
  assert.equal(s.totalDays, 8, 'total hari mendengarkan menghitung hari pemulihan');
});

test('rekor memuat streak yang sedang padam (DORMANT) dan tidak dikurangi', () => {
  const s = calc(base35, at('2026-11-05'));
  assert.equal(s.best, 35);
  assert.equal(s.status, 'DORMANT');
  const r = streakRecord(s, { userId: 'u1', lastPlayAt: at(L, 21) });
  assert.equal(r.streak_status, 'DORMANT');
  assert.equal(r.current_streak, 35);
  assert.equal(r.longest_streak, 35);
  assert.equal(r.last_active_date, L);
  assert.equal(r.recovery_started_at, new Date(at('2026-11-02', 0)).toISOString());
  assert.equal(r.recovery_expires_at, new Date(at('2026-11-09', 0)).toISOString());
  assert.equal(r.streak_started_at, addDays(L, -34));
  const ex = streakRecord(calc(base35, at('2026-11-30')), { userId: 'u1' });
  assert.equal(ex.streak_status, 'EXPIRED');
  assert.equal(ex.current_streak, 0);
  assert.equal(ex.longest_streak, 35);
  assert.equal(ex.recovery_expires_at, null);
});

/* ───────────── 9. refresh tidak menggandakan ───────────── */
test('S9: refresh halaman (state disimpan lalu dimuat ulang) tidak menggandakan aktivitas', () => {
  const e = ev('sess-1', 45, at('2026-11-10', 9));
  const ctx = { now: at('2026-11-10', 9), tz: TZ };
  const first = applyListening(createListeningState(TZ), e, ctx);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(first.state)));
  const again = applyListening(reloaded, e, ctx);
  assert.equal(again.rejected, 'duplicate');
  assert.deepEqual(again.state.daily, first.state.daily);
  assert.equal(computeStreak(again.state.daily, { now: ctx.now, tz: TZ }).current, 1);
});

/* ───────────── 11. playback gagal / belum valid ───────────── */
test('S11: playback gagal atau di bawah ambang valid tidak menambah streak', () => {
  const st = createListeningState(TZ);
  const bad = applyListening(st, ev('f1', 0, at('2026-11-10', 9)), { now: at('2026-11-10', 9), tz: TZ });
  assert.equal(bad.accepted, 0, 'nol detik valid = tidak dicatat');
  const short = listen(st, '2026-11-10', 9, 0, 0, { seconds: 12 });
  assert.equal(short.state.daily['2026-11-10'].p, 0);
  assert.equal(short.streak.current, 0);
  assert.equal(short.streak.status, 'NEW');
  assert.equal(short.transition, null);
  const ok = listen(short.state, '2026-11-10', 9, 5, 0, { seconds: 35, sid: short.state.history.length ? 'x' : Object.keys(short.state.live)[0] });
  assert.equal(ok.streak.current, 1, 'sesi yang sama mencapai 30 detik valid -> 1 hari aktif');
});

/* ───────────── 14. dua event bersamaan ───────────── */
test('S14: dua event playback bersamaan tidak menambah streak dua kali dalam sehari', () => {
  let st = createListeningState(TZ);
  const ts = at('2026-11-10', 9);
  const a = applyListening(st, ev('dev-A', 40, ts, 'trk00000001'), { now: ts, tz: TZ, strict: true });
  const b = applyListening(a.state, ev('dev-B', 40, ts, 'trk00000002'), { now: ts, tz: TZ, strict: true });
  assert.equal(b.streak.current, 1);
  assert.equal(b.state.daily['2026-11-10'].p, 2, 'dua pemutaran valid, tetap satu hari aktif');
  assert.equal(b.streak.totalDays, 1);
  const c = applyListening(b.state, ev('dev-A', 30, ts + 1000, 'trk00000001'), { now: ts + 1000, tz: TZ, strict: true });
  assert.equal(c.streak.current, 1);
});

/* ───────────── 13. tanggal & zona waktu ───────────── */
test('S13: pergantian hari mengikuti zona waktu; instan pemulihan terkunci saat zona berubah', () => {
  // 23:59 WIB tgl 9 dan 00:01 WIB tgl 10 jatuh pada dua hari berbeda -> streak 2
  let st = createListeningState(TZ);
  st = listen(st, '2026-11-09', 23, 59).state;
  const r = listen(st, '2026-11-10', 0, 1);
  assert.equal(r.streak.current, 2);

  // DORMANT dikunci (instan disimpan) lalu zona perangkat berubah ke Los Angeles
  const dormantState = stateWith(base35);
  const now = at('2026-11-05', 12);
  const settled = settleState(dormantState, { now, tz: TZ });
  assert.equal(settled.changed, true);
  assert.equal(settled.state.recovery.expiresAt, at('2026-11-09', 0));
  const again = settleState(settled.state, { now, tz: TZ });
  assert.equal(again.changed, false, 'tidak dihitung ulang setiap aplikasi dibuka');
  const la = computeStreak(settled.state.daily, { now, tz: 'America/Los_Angeles', meta: settled.state.recovery });
  assert.equal(la.status, 'DORMANT');
  assert.equal(la.recovery.expiresAt, at('2026-11-09', 0), 'batas pemulihan tidak bergeser karena zona waktu');
  assert.equal(la.recovery.tz, TZ);
  // membuka halaman streak berulang kali tidak memperpanjang masa pemulihan
  const later = computeStreak(settled.state.daily, { now: at('2026-11-08', 22), tz: 'America/Los_Angeles', meta: settled.state.recovery });
  assert.equal(later.status, 'DORMANT');
  const over = computeStreak(settled.state.daily, { now: at('2026-11-09', 0, 0, 1), tz: 'America/Los_Angeles', meta: settled.state.recovery });
  assert.equal(over.status, 'EXPIRED');
  assert.equal(startOfDayMs('2026-03-08', 'America/New_York') < startOfDayMs('2026-03-09', 'America/New_York'), true);
  assert.equal(dateKey(startOfDayMs('2026-03-09', 'America/New_York'), 'America/New_York'), '2026-03-09');
});

/* ───────────── aturan harian dapat dikonfigurasi (spesifikasi menulis 3 dan 1) ───────────── */
test('syarat harian dapat disetel: 1 lagu valid (default) atau 3 lagu valid', () => {
  const d = { '2026-11-10': { s: 120, n: 2, p: 2 } };
  assert.equal(calc(d, at('2026-11-10')).todayQualified, true);
  const strict = computeStreak(d, { now: at('2026-11-10'), tz: TZ, rules: { minPlays: 3 } });
  assert.equal(strict.todayQualified, false);
  assert.equal(strict.playsNeededToday, 1);
  assert.equal(strict.status, 'NEW');
  const ok = computeStreak({ '2026-11-10': { s: 200, n: 3, p: 3 } }, { now: at('2026-11-10'), tz: TZ, rules: { minPlays: 3 } });
  assert.equal(ok.status, 'ACTIVE');
  assert.equal(computeStreak(d, { now: at('2026-11-10'), tz: TZ, rules: { minPlays: 1, minSeconds: 600 } }).todayQualified, false);
});

/* ───────────── milestone 1..999 ───────────── */
test('simulasi 999 hari: semua milestone selesai; hitungan tidak dibatasi 999', () => {
  const s = calc(chain('2026-11-13', 999), at('2026-11-13'));
  assert.equal(s.current, 999);
  assert.equal(s.completedCount, MILESTONES.length);
  assert.equal(s.nextMilestone, null);
  assert.equal(s.progress.complete, true);
  assert.equal(s.milestones.at(-1).achievedAt, '2026-11-13');
  assert.equal(calc(chain('2026-11-13', 1005), at('2026-11-13')).current, 1005);
});

test('progres antar-milestone: 125 hari = 25/50 = 50%; status Completed/In Progress/Locked', () => {
  const s = calc(chain('2026-11-13', 125), at('2026-11-13'));
  assert.deepEqual({ from: s.progress.from, to: s.progress.to, done: s.progress.done, left: s.progress.remaining, pct: s.progress.percent }, { from: 100, to: 150, done: 25, left: 25, pct: 50 });
  const by = Object.fromEntries(s.milestones.map((m) => [m.days, m]));
  assert.equal(by[100].status, 'completed');
  assert.equal(by[100].achievedAt, addDays(addDays('2026-11-13', -124), 99));
  assert.equal(by[150].status, 'in_progress');
  assert.equal(by[200].status, 'locked');
});

test('milestone yang sudah terbuka tidak terkunci ulang walau data harian hilang', () => {
  const s = computeStreak({}, { now: at('2026-11-13'), tz: TZ, unlocked: { 7: '2026-01-07' } });
  assert.equal(s.milestones.find((m) => m.days === 7).status, 'completed');
  assert.equal(s.status, 'NEW');
});

/* ───────────── perayaan ───────────── */
test('perayaan: api menyala kembali & milestone hanya sekali', () => {
  let st = stateWith({ ...chain('2026-11-01', 6) }); // 6 hari berakhir 1 Nov
  const r = listen(st, '2026-11-03', 10); // pulih pada hari ke-2 masa pemulihan: tetap 6
  assert.equal(r.streak.current, 6);
  const p1 = pendingCelebrations(r.state, r.streak);
  assert.deepEqual(p1.map((x) => x.id), ['r:2026-11-03']);
  assert.equal(p1[0].streak, 6);
  const done = markCelebrated(r.state, ['r:2026-11-03']);
  assert.deepEqual(pendingCelebrations(done, r.streak), []);
  const r2 = listen(done, '2026-11-04', 10); // hari aktif berikutnya -> 7 = milestone 7
  assert.deepEqual(r2.newlyUnlocked, [7]);
  assert.deepEqual(pendingCelebrations(r2.state, r2.streak).map((x) => x.id), ['m:7']);
  const reopened = normalizeState(JSON.parse(JSON.stringify(markCelebrated(r2.state, ['m:7']))));
  const again = computeStreak(reopened.daily, { now: at('2026-11-04', 12), tz: TZ, unlocked: reopened.unlocked });
  assert.deepEqual(pendingCelebrations(reopened, again), [], 'tidak muncul lagi setelah aplikasi dibuka ulang');
});

/* ───────────── kalender ───────────── */
test('kalender: aktif, pemulihan, dipulihkan, terlewat, hangus', () => {
  // DORMANT pada 5 Nov
  const s = calc(base35, at('2026-11-05'));
  const g = monthGrid(base35, 2026, 11, { today: '2026-11-05', streak: s });
  const cell = (n) => g.find((c) => c?.day === n);
  assert.equal(cell(1).status, 'active');
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map((d) => cell(d).status), Array(7).fill('recovery'));
  assert.equal(cell(9).status, 'future');
  assert.equal(cell(5).isToday, true);
  assert.equal(g.slice(0, 6).every((c) => c === null), true, '1 Nov 2026 = Minggu');

  // dipulihkan pada 5 Nov: 2-4 Nov terlewat, 5 Nov 'recovered'
  const d2 = { ...base35, '2026-11-05': entry() };
  const s2 = calc(d2, at('2026-11-05', 20));
  const g2 = monthGrid(d2, 2026, 11, { today: '2026-11-05', streak: s2 });
  const c2 = (n) => g2.find((c) => c?.day === n).status;
  assert.deepEqual([c2(1), c2(2), c2(3), c2(4), c2(5)], ['active', 'missed', 'missed', 'missed', 'recovered']);

  // hangus: 2-8 Nov berstatus 'expired'
  const s3 = calc(base35, at('2026-11-20'));
  const g3 = monthGrid(base35, 2026, 11, { today: '2026-11-20', streak: s3 });
  const c3 = (n) => g3.find((c) => c?.day === n).status;
  assert.deepEqual([c3(1), c3(2), c3(8), c3(9)], ['active', 'expired', 'expired', 'none']);

  const det = dayDetail(base35, '2026-11-01', { today: '2026-11-05', streak: s });
  assert.equal(det.qualified, true);
  assert.equal(dayDetail(base35, '2026-11-04', { today: '2026-11-05', streak: s }).status, 'recovery');
});

/* ───────────── status NEW ───────────── */
test('pengguna baru: status NEW, mulai dari lagu valid pertama', () => {
  const s = computeStreak({}, { now: at('2026-11-10'), tz: TZ });
  assert.equal(s.status, 'NEW');
  assert.equal(s.current, 0);
  assert.equal(s.best, 0);
  const r = listen(createListeningState(TZ), '2026-11-10', 9);
  assert.equal(r.transition, 'started');
  assert.equal(r.streak.status, 'ACTIVE');
  assert.equal(r.state.rec.streak_status, 'ACTIVE');
});
