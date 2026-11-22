// Penyimpanan lokal per-cakupan: 'guest' atau id akun. Data tamu dan akun TIDAK pernah bercampur.
// Semua halaman membaca lewat store ini sehingga perubahan langsung terlihat di mana-mana.
import { useSyncExternalStore } from 'react';

const GUEST = 'guest';
// Kunci lama (sebelum Drowify) tetap dipakai untuk tamu agar data pengguna lama tidak hilang.
const LEGACY = { library_liked: 'liked_songs', library_playlists: 'user_playlists', library_artists: 'liked_artists' };
let scope = GUEST;
const cache = new Map();
const subs = new Set();
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);

const fullKey = (name, sc = scope) => (sc === GUEST && LEGACY[name] ? LEGACY[name] : `drowify:${sc}:${name}`);
const emit = (name) => subs.forEach((fn) => fn(name));

export const getScope = () => scope;
export const isGuest = () => scope === GUEST;

export function setScope(next) {
  const sc = next || GUEST;
  if (sc === scope) return;
  scope = sc;
  cache.clear();
  emit('*');
}

export function readStore(name, fallback) {
  const k = `${scope}|${name}`;
  if (cache.has(k)) return cache.get(k);
  let v = fallback;
  try {
    const raw = ls()?.getItem(fullKey(name));
    if (raw != null) v = JSON.parse(raw);
  } catch (_) { /* data rusak: pakai fallback */ }
  cache.set(k, v);
  return v;
}

/** Baca data cakupan tamu tanpa mengubah cakupan aktif (untuk penawaran penggabungan). */
export function peekGuest(name, fallback) {
  try {
    const raw = ls()?.getItem(fullKey(name, GUEST));
    return raw != null ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

export function writeStore(name, value) {
  cache.set(`${scope}|${name}`, value);
  try { ls()?.setItem(fullKey(name), JSON.stringify(value)); } catch (_) { /* kuota penuh: tetap di memori */ }
  emit(name);
}

export function removeStore(name) {
  cache.delete(`${scope}|${name}`);
  try { ls()?.removeItem(fullKey(name)); } catch (_) { /* abaikan */ }
  emit(name);
}

export function subscribeStore(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

if (typeof window !== 'undefined') {
  // perubahan dari tab lain
  window.addEventListener('storage', (e) => {
    if (e.key && !e.key.startsWith('drowify:') && !Object.values(LEGACY).includes(e.key)) return;
    cache.clear();
    emit('*');
  });
}

/** Hook reaktif. `fallback` WAJIB konstanta modul (identitas stabil). */
export function useStore(name, fallback) {
  return useSyncExternalStore(subscribeStore, () => readStore(name, fallback), () => fallback);
}

export function useScope() {
  return useSyncExternalStore(subscribeStore, getScope, () => GUEST);
}
