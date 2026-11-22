// Pustaka pengguna (disukai, playlist, artis) — SATU sumber data untuk seluruh aplikasi.
// Tersimpan per-cakupan (tamu/akun) dan reaktif: perubahan langsung terlihat di semua halaman.
import { readStore, writeStore, useStore } from './storage.js';

const EMPTY = Object.freeze([]);
export const LIB_KEYS = Object.freeze({ liked: 'library_liked', playlists: 'library_playlists', artists: 'library_artists' });
const tid = (t) => (t && (t.videoId || t.id)) || '';

/** Salinan ringkas lagu agar penyimpanan tetap kecil namun tetap dapat diputar. */
export function slimTrack(t) {
  if (!t) return null;
  const id = tid(t);
  return {
    id, videoId: id,
    title: t.title || '', artist: t.artist || '', artistId: t.artistId || '',
    album: t.album || '', albumId: t.albumId || '',
    cover: t.cover || t.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
    thumbnail: t.thumbnail || t.cover || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
    duration: t.duration || '',
    url: t.url || '', ytUrl: t.ytUrl || (id ? `https://youtube.com/watch?v=${id}` : ''),
  };
}

const rid = () => `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const read = (k) => readStore(LIB_KEYS[k], EMPTY);
const write = (k, v) => writeStore(LIB_KEYS[k], v);

/* ── lagu disukai ── */
export const getLikedSongs = () => read('liked');
export const isLikedSong = (x) => {
  const id = typeof x === 'string' ? x : tid(x);
  return !!id && read('liked').some((s) => tid(s) === id);
};
export function toggleLikeSong(song) {
  const list = read('liked');
  const id = tid(song);
  if (list.some((s) => tid(s) === id)) {
    write('liked', list.filter((s) => tid(s) !== id));
    return false;
  }
  write('liked', [slimTrack(song), ...list]);
  return true;
}

/* ── playlist ── */
export const getUserPlaylists = () => read('playlists');
const patchPlaylists = (fn) => write('playlists', fn(read('playlists')));

export function createPlaylist(name, image = '', description = '', songs = [], source = '') {
  const now = Date.now();
  const pl = {
    id: rid(), name: String(name || 'Playlist baru').trim().slice(0, 120) || 'Playlist baru',
    description: String(description || '').slice(0, 500), image: image || '',
    songs: songs.map(slimTrack), createdAt: now, updatedAt: now, source,
  };
  patchPlaylists((l) => [pl, ...l]);
  return pl;
}

// Dua bentuk: updateUserPlaylist(id, { name, image, description }) atau gaya lama updateUserPlaylist(id, name, image)
export function updateUserPlaylist(id, a, image) {
  const patch = a && typeof a === 'object' ? a : { ...(a ? { name: a } : {}), ...(image !== null && image !== undefined ? { image } : {}) };
  patchPlaylists((l) => l.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
}
export const deleteUserPlaylist = (id) => patchPlaylists((l) => l.filter((p) => p.id !== id));

export function addSongToPlaylist(id, song) {
  let result = 'missing';
  patchPlaylists((l) => l.map((p) => {
    if (p.id !== id) return p;
    if (p.songs.some((s) => tid(s) === tid(song))) { result = 'exists'; return p; }
    result = 'added';
    return { ...p, songs: [...p.songs, slimTrack(song)], updatedAt: Date.now() };
  }));
  return result;
}

/** Tambah banyak lagu (urutan dipertahankan, tanpa duplikat). Mengembalikan jumlah yang ditambahkan. */
export function addSongsToPlaylist(id, songs) {
  let added = 0;
  patchPlaylists((l) => l.map((p) => {
    if (p.id !== id) return p;
    const have = new Set(p.songs.map(tid));
    const fresh = [];
    for (const s of songs) if (tid(s) && !have.has(tid(s))) { have.add(tid(s)); fresh.push(slimTrack(s)); }
    added = fresh.length;
    return { ...p, songs: [...p.songs, ...fresh], updatedAt: Date.now() };
  }));
  return added;
}

export function removeSongFromPlaylist(id, index) {
  patchPlaylists((l) => l.map((p) => (p.id === id ? { ...p, songs: p.songs.filter((_, i) => i !== index), updatedAt: Date.now() } : p)));
}

export function moveSongInPlaylist(id, from, to) {
  patchPlaylists((l) => l.map((p) => {
    if (p.id !== id || from === to || from < 0 || to < 0 || from >= p.songs.length || to >= p.songs.length) return p;
    const songs = p.songs.slice();
    const [it] = songs.splice(from, 1);
    songs.splice(to, 0, it);
    return { ...p, songs, updatedAt: Date.now() };
  }));
}

/* ── artis disukai ── */
export const getLikedArtists = () => read('artists');
export const isArtistLiked = (artistId) => !!artistId && read('artists').some((a) => a.artistId === artistId);
export function toggleLikeArtist(artist) {
  if (!artist || !artist.artistId) return false;
  const list = read('artists');
  if (list.some((a) => a.artistId === artist.artistId)) {
    write('artists', list.filter((a) => a.artistId !== artist.artistId));
    return false;
  }
  write('artists', [{ ...artist }, ...list]);
  return true;
}

/* ── hook reaktif ── */
export const useLiked = () => useStore(LIB_KEYS.liked, EMPTY);
export const usePlaylists = () => useStore(LIB_KEYS.playlists, EMPTY);
export const useLikedArtists = () => useStore(LIB_KEYS.artists, EMPTY);
export function useIsLiked(x) {
  const id = typeof x === 'string' ? x : tid(x);
  return useLiked().some((s) => tid(s) === id);
}

/* ── untuk sinkronisasi server ── */
export const composeLibrary = () => ({ liked: read('liked'), playlists: read('playlists'), artists: read('artists') });
export function applyLibrary(lib) {
  write('liked', lib.liked || []);
  write('playlists', lib.playlists || []);
  write('artists', lib.artists || []);
}
