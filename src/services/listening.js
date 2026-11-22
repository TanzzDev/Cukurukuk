// Toko dengar sisi klien: riwayat, Top 50, dan Streak dari SATU state (shared/listening.js).
// Tamu: tersimpan lokal. Akun: diterapkan lokal lalu dikirim ke server (outbox + event ID idempoten);
// server tetap sumber kebenaran saat sinkron (GET /api/me/listening).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  applyListening, markCelebrated, normalizeState, pendingCelebrations, settleState,
} from '../../shared/listening.js';
import { computeStreak, normalizeRules } from '../../shared/streak.js';
import { DEFAULT_RULES } from '../../shared/config.js';
import { api } from './api.js';
import { emit } from './bus.js';
import { getScope, isGuest, readStore, subscribeStore, writeStore } from './storage.js';

const EMPTY = Object.freeze([]);
let rules = normalizeRules(DEFAULT_RULES);
const ruleSubs = new Set();
export const getRules = () => rules;
export function setStreakRules(r) {
  const next = normalizeRules(r);
  if (JSON.stringify(next) === JSON.stringify(rules)) return;
  rules = next;
  ruleSubs.forEach((f) => f());
}

export function deviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; }
}

let cRaw;
let cScope;
let cState;
export function getListeningState() {
  const raw = readStore('listening', null);
  if (cState && raw === cRaw && cScope === getScope()) return cState;
  cRaw = raw;
  cScope = getScope();
  cState = normalizeState(raw, deviceTz());
  return cState;
}
function save(state) {
  cRaw = state;
  cScope = getScope();
  cState = state;
  writeStore('listening', state);
}

/** Catat satu event dengar valid (dipanggil oleh pengukur di PlayerContext). */
export function recordListening(ev) {
  const st = getListeningState();
  const r = applyListening(st, ev, { now: Date.now(), tz: deviceTz(), rules });
  if (r.state !== st) save(r.state);
  if (r.accepted > 0 && !isGuest()) {
    writeStore('listening_outbox', [...readStore('listening_outbox', EMPTY), ev].slice(-300));
    scheduleFlush();
  }
  if (r.transition || r.newlyUnlocked.length) emit('streak', { transition: r.transition, newlyUnlocked: r.newlyUnlocked, streak: r.streak });
  return r;
}

/** Hitung ulang status dari data tersimpan (mengunci instan pemulihan). Aman dipanggil berulang. */
export function settleLocal() {
  const r = settleState(getListeningState(), { now: Date.now(), tz: deviceTz(), rules });
  if (r.changed) save(r.state);
  return r.streak;
}

/* ── outbox → server ── */
let flushTimer = null;
let backoff = 5000;
export function scheduleFlush(ms = 2500) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushOutbox(), ms);
}

export async function flushOutbox({ beacon = false } = {}) {
  if (isGuest()) return;
  const queue = readStore('listening_outbox', EMPTY);
  if (!queue.length) return;
  const batch = queue.slice(0, 50);
  const payload = { events: batch, tz: deviceTz() };
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/me/listening', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    return;
  }
  try {
    const res = await api('/api/me/listening', { method: 'POST', json: payload });
    const sent = new Set(batch.map((e) => e.id));
    writeStore('listening_outbox', readStore('listening_outbox', EMPTY).filter((e) => !sent.has(e.id)));
    backoff = 5000;
    if (readStore('listening_outbox', EMPTY).length) scheduleFlush(300);
    return res;
  } catch (err) {
    if (err.status === 401) emit('unauthorized');
    else if (err.status === 400) writeStore('listening_outbox', queue.slice(batch.length)); // batch ditolak: jangan macet selamanya
    else {
      scheduleFlush(backoff);
      backoff = Math.min(backoff * 2, 60000);
    }
  }
}

/** Ambil state resmi dari server (sumber kebenaran), lalu terapkan ulang event outbox yang belum terkirim. */
export async function pullListening() {
  if (isGuest()) return;
  const res = await api('/api/me/listening');
  if (res.rules) setStreakRules(res.rules);
  let st = normalizeState(res.state, deviceTz());
  for (const ev of readStore('listening_outbox', EMPTY)) {
    st = applyListening(st, ev, { now: Date.now(), tz: deviceTz(), rules }).state; // idempoten: id yang sudah ada diabaikan
  }
  save(st);
}

export function clearHistory() {
  const st = getListeningState();
  save({ ...st, history: [], tracks: {}, live: {} });
  if (!isGuest()) api('/api/me/history', { method: 'DELETE' }).catch(() => {});
}

export function ackCelebrations(ids) {
  save(markCelebrated(getListeningState(), ids));
  if (!isGuest()) api('/api/me/listening/celebrate', { method: 'POST', json: { ids } }).catch(() => {});
}

/** Ganti seluruh state dengar (setelah penggabungan tamu → akun dari server). */
export function replaceListening(raw) {
  save(normalizeState(raw, deviceTz()));
}

/* ── hook ── */
export const useListening = () => useSyncExternalStore(subscribeStore, getListeningState, getListeningState);
export const useRules = () => useSyncExternalStore((f) => { ruleSubs.add(f); return () => ruleSubs.delete(f); }, getRules, getRules);

export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [ms]);
  return now;
}

/** Streak dihitung dari SATU state: Dashboard, panel detail, Kamu, riwayat memakai hasil yang sama. */
export function useStreak(tickMs = 60000) {
  const state = useListening();
  const r = useRules();
  const now = useNow(tickMs);
  const streak = useMemo(
    () => computeStreak(state.daily, { now, tz: deviceTz(), rules: r, unlocked: state.unlocked, meta: state.recovery }),
    [state, r, now],
  );
  useEffect(() => {
    if ((streak.status === 'DORMANT') !== !!state.recovery) settleLocal();
  }, [streak.status, state.recovery]);
  return { state, streak, now, rules: r };
}

export function usePendingCelebrations() {
  const { state, streak } = useStreak();
  return useMemo(() => pendingCelebrations(state, streak), [state, streak]);
}
