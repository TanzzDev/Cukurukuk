import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackTracker, createListenLock } from '../src/services/tracker.js';
import { applyListening, createListeningState } from '../shared/listening.js';
import { computeStreak } from '../shared/streak.js';

function rig(opts = {}) {
  let wall = 0;
  const flushed = [];
  const tr = new PlaybackTracker({ now: () => 1_700_000_000_000 + wall, perf: () => wall, onFlush: (e) => flushed.push(e), tabId: 'tab', ...opts });
  const audio = { currentTime: 0, paused: true, seeking: false, ready: false, rate: 1 };
  const step = (sec, { play = true } = {}) => {
    // maju `sec` detik waktu nyata dengan timeupdate 4x/detik
    for (let i = 0; i < sec * 4; i++) {
      wall += 250;
      if (play && !audio.paused && !audio.seeking && audio.ready) audio.currentTime += 0.25 * audio.rate;
      tr.tick(audio);
    }
  };
  const total = () => flushed.reduce((n, e) => n + e.seconds, 0) + tr.acc;
  return { tr, audio, flushed, step, total, advance: (ms) => { wall += ms; } };
}
const TRACK = { id: 'vid00000001', title: 'Lagu', artist: 'A', duration: 200 };

test('pemutaran normal 60 detik dihitung ~60 detik, disetor tiap 15 detik', () => {
  const { tr, audio, flushed, step, total } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: true });
  step(60);
  assert.ok(Math.abs(total() - 60) < 1, `total ${total()}`);
  assert.ok(flushed.length >= 3);
  assert.equal(new Set(flushed.map((e) => e.id)).size, flushed.length, 'id event unik');
});

test('pause & resume tidak menggandakan: jeda 30 detik tidak dihitung', () => {
  const { tr, audio, step, total } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: true });
  step(20);
  audio.paused = true;
  tr.interrupt();
  step(30, { play: false });
  audio.paused = false;
  step(20);
  assert.ok(Math.abs(total() - 40) < 1.5, `total ${total()} harus ~40, bukan 70`);
});

test('seek/loncat tidak dihitung sebagai mendengarkan', () => {
  const { tr, audio, step, total } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: true });
  step(10);
  audio.seeking = true;
  tr.interrupt();
  audio.currentTime += 120;
  tr.tick(audio);
  audio.seeking = false;
  step(10);
  assert.ok(Math.abs(total() - 20) < 1.5, `total ${total()} harus ~20`);
  // loncat tanpa event seeking (mis. skip internal): selisih besar diabaikan
  audio.currentTime += 90;
  step(0.25);
  assert.ok(total() < 21.5);
});

test('buffering / belum siap / lagu gagal dimuat tidak menambah apa pun', () => {
  const { tr, audio, flushed, step, total } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: false }); // readyState rendah: sedang buffering atau gagal
  step(30);
  assert.equal(total(), 0);
  assert.equal(flushed.length, 0);
  const none = rig();
  none.tr.begin(null); // tidak ada lagu (gagal dimuat)
  none.audio.paused = false;
  none.audio.ready = true;
  none.step(10);
  assert.equal(none.total(), 0);
});

test('kecepatan 2x tidak melipatgandakan waktu dengar (dibatasi waktu nyata)', () => {
  const { tr, audio, step, total } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: true, rate: 2 });
  step(20);
  assert.ok(total() <= 20.5, `total ${total()} tidak boleh > waktu nyata`);
});

test('ulang lagu yang sama = sesi baru; begin() menyetor sisa sesi sebelumnya', () => {
  const { tr, audio, flushed, step } = rig();
  tr.begin(TRACK);
  Object.assign(audio, { paused: false, ready: true });
  step(10);
  const sid1 = tr.sid;
  tr.begin(TRACK);
  assert.notEqual(tr.sid, sid1);
  assert.equal(flushed.at(-1).sid, sid1, 'sisa 10 detik tersetor ke sesi lama');
  assert.ok(Math.abs(flushed.at(-1).seconds - 10) < 1);
});

test('kunci tab: tab kedua tidak menghitung selama tab pertama memegang kunci', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  let clock = 0;
  const a = createListenLock({ storage, tabId: 'A', now: () => clock });
  const b = createListenLock({ storage, tabId: 'B', now: () => clock });
  assert.equal(a.owns(), true);
  clock = 3000;
  assert.equal(b.owns(), false);
  assert.equal(a.owns(), true);
  clock = 30000; // A berhenti memperbarui -> kunci basi
  assert.equal(b.owns(), true);
  a.release();
  clock = 35000;
  assert.equal(b.owns(), true);
});

test('integrasi: hasil tracker -> mesin dengar -> streak (satu lagu valid cukup, klik saja tidak)', () => {
  const { tr, audio, flushed, step } = rig();
  let st = createListeningState('Asia/Jakarta');
  const ctx = (ts) => ({ now: ts, tz: 'Asia/Jakarta' });
  // hanya klik play, audio belum berjalan
  tr.begin(TRACK);
  step(5);
  assert.equal(flushed.length, 0);
  // audio berjalan 45 detik
  Object.assign(audio, { paused: false, ready: true });
  step(45);
  tr.interrupt();
  for (const e of flushed) st = applyListening(st, e, ctx(e.ts)).state;
  const dup = applyListening(st, flushed[0], ctx(flushed[0].ts));
  assert.equal(dup.rejected, 'duplicate');
  const day = Object.values(st.daily)[0];
  assert.equal(day.p, 1, 'satu pemutaran valid');
  const s = computeStreak(st.daily, { now: flushed.at(-1).ts, tz: 'Asia/Jakarta' });
  assert.equal(s.status, 'ACTIVE');
  assert.equal(s.current, 1);
});
