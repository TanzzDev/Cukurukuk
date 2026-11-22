// Bentuk data pustaka (disimpan lokal & di server):
//  { liked: [track], playlists: [{ id, name, description, image, songs: [track], createdAt, updatedAt, source }],
//    artists: [{ artistId, … }], updatedAt }
// track = { id, videoId, title, artist, cover, artistId, ytUrl, duration }

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const tid = (t) => (t && (t.videoId || t.id)) || '';

export function emptyLibrary() {
  return { liked: [], playlists: [], artists: [], updatedAt: 0 };
}

export function normalizeLibrary(raw) {
  const lib = emptyLibrary();
  if (!isObj(raw)) return lib;
  if (Array.isArray(raw.liked)) lib.liked = raw.liked.filter((t) => isObj(t) && tid(t)).slice(0, 5000);
  if (Array.isArray(raw.playlists)) {
    lib.playlists = raw.playlists
      .filter((p) => isObj(p) && typeof p.id === 'string')
      .slice(0, 500)
      .map((p) => ({
        id: p.id,
        name: String(p.name || 'Playlist').slice(0, 120),
        description: String(p.description || '').slice(0, 500),
        image: typeof p.image === 'string' && p.image.length < 2000 ? p.image : '',
        songs: Array.isArray(p.songs) ? p.songs.filter((t) => isObj(t) && tid(t)).slice(0, 5000) : [],
        createdAt: Number(p.createdAt) || 0,
        updatedAt: Number(p.updatedAt) || 0,
        source: p.source ? String(p.source).slice(0, 40) : '',
      }));
  }
  if (Array.isArray(raw.artists)) lib.artists = raw.artists.filter((a) => isObj(a) && a.artistId).slice(0, 2000);
  lib.updatedAt = Number(raw.updatedAt) || 0;
  return lib;
}

export function isLibraryEmpty(lib) {
  return !lib || (!lib.liked?.length && !lib.playlists?.length && !lib.artists?.length);
}

/** Gabungkan `secondary` (mis. data tamu) ke `primary` (akun) tanpa duplikat. Idempoten. */
export function mergeLibrary(primary, secondary) {
  const a = normalizeLibrary(primary);
  const b = normalizeLibrary(secondary);
  const likedIds = new Set(a.liked.map(tid));
  const liked = a.liked.concat(b.liked.filter((t) => !likedIds.has(tid(t))));
  const plIds = new Set(a.playlists.map((p) => p.id));
  const playlists = a.playlists.concat(b.playlists.filter((p) => !plIds.has(p.id)));
  const artIds = new Set(a.artists.map((x) => x.artistId));
  const artists = a.artists.concat(b.artists.filter((x) => !artIds.has(x.artistId)));
  return { liked, playlists, artists, updatedAt: Math.max(a.updatedAt, b.updatedAt, Date.now()) };
}
