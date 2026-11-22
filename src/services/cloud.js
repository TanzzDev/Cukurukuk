// Sinkronisasi akun: pustaka (revisi optimistik), data dengar, dan penggabungan data tamu yang aman.
import { mergeLibrary } from '../../shared/library.js';
import { api } from './api.js';
import { emit } from './bus.js';
import { applyLibrary, composeLibrary, LIB_KEYS } from './library.js';
import { flushOutbox, pullListening, replaceListening, getListeningState } from './listening.js';
import { isGuest, peekGuest, readStore, subscribeStore, writeStore } from './storage.js';

let pushTimer = null;
let applying = false;

export async function pullLibrary() {
  if (isGuest()) return;
  const res = await api('/api/me/library');
  applying = true;
  try {
    const local = composeLibrary();
    const serverEmpty = !res.library.liked.length && !res.library.playlists.length && !res.library.artists.length;
    // server kosong tetapi lokal berisi (mis. baru digabung): dorong lokal; selain itu server menang
    if (serverEmpty && (local.liked.length || local.playlists.length || local.artists.length)) writeStore('library_rev', res.rev);
    else {
      applyLibrary(res.library);
      writeStore('library_rev', res.rev);
    }
  } finally { applying = false; }
  if (readStore('library_rev', 0) === res.rev) schedulePush(200);
}

export function schedulePush(ms = 1200) {
  if (isGuest()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushLibrary, ms);
}

export async function pushLibrary(attempt = 0) {
  if (isGuest()) return;
  const baseRev = readStore('library_rev', 0);
  try {
    const res = await api('/api/me/library', { method: 'PUT', json: { library: composeLibrary(), baseRev } });
    writeStore('library_rev', res.rev);
  } catch (err) {
    if (err.status === 409 && attempt < 2) {
      // perangkat lain mengubah lebih dulu: gabungkan (tidak ada data yang hilang) lalu coba lagi
      const merged = mergeLibrary(composeLibrary(), err.data.library);
      applying = true;
      try { applyLibrary(merged); } finally { applying = false; }
      writeStore('library_rev', err.data.rev);
      emit('toast', 'Pustaka digabung dengan perubahan dari perangkat lain.');
      return pushLibrary(attempt + 1);
    }
    if (err.status === 401) emit('unauthorized');
  }
}

/** Mulai pemantauan perubahan pustaka & koneksi untuk akun yang sedang login. */
export function startCloudSync() {
  const offStore = subscribeStore((name) => {
    if (applying || isGuest()) return;
    if (Object.values(LIB_KEYS).includes(name)) schedulePush();
  });
  const onOnline = () => { flushOutbox(); schedulePush(300); };
  const onHide = () => { if (document.visibilityState === 'hidden') flushOutbox({ beacon: true }); };
  const onShow = () => { if (document.visibilityState === 'visible' && !isGuest()) pullListening().catch(() => {}); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onHide);
  document.addEventListener('visibilitychange', onShow);
  return () => {
    offStore();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onHide);
    document.removeEventListener('visibilitychange', onShow);
  };
}

/** Ringkasan data tamu yang bisa digabung (null bila kosong). Dibaca TANPA mengubah cakupan aktif. */
export function guestSummary() {
  const liked = peekGuest('library_liked', []).length;
  const playlists = peekGuest('library_playlists', []).length;
  const artists = peekGuest('library_artists', []).length;
  const l = peekGuest('listening', null);
  const days = l && l.daily ? Object.keys(l.daily).length : 0;
  const plays = l && l.history ? l.history.length : 0;
  return liked + playlists + artists + days + plays ? { liked, playlists, artists, days, plays } : null;
}

/** Gabungkan data tamu ke akun yang sedang login (idempoten; data tamu tidak dihapus). */
export async function mergeGuestIntoAccount() {
  const guestLib = { liked: peekGuest('library_liked', []), playlists: peekGuest('library_playlists', []), artists: peekGuest('library_artists', []) };
  const merged = mergeLibrary(composeLibrary(), guestLib);
  applying = true;
  try { applyLibrary(merged); } finally { applying = false; }
  await pushLibrary();
  const guestL = peekGuest('listening', null);
  if (guestL) {
    const res = await api('/api/me/listening/merge', { method: 'POST', json: { state: guestL }, timeout: 20000 });
    replaceListening(res.state);
  } else replaceListening(getListeningState());
}
