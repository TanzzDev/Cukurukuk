// Operasi antrean murni. `index` = posisi lagu yang sedang diputar di `list`.
// Semua fungsi mengembalikan { list, index } baru dan tidak memodifikasi input.

export const trackId = (t) => (t && (t.videoId || t.id)) || '';

/** '3.45' | '3:45' | '1.02.03' -> detik (null bila tidak dikenal). */
export function parseDurationText(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  if (!text) return null;
  const parts = String(text).trim().split(/[.:]/).map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function moveItem(list, index, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return { list, index };
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  let idx = index;
  if (index === from) idx = to;
  else if (from < index && to >= index) idx = index - 1;
  else if (from > index && to <= index) idx = index + 1;
  return { list: next, index: idx };
}

/** Hapus satu item. Lagu yang sedang diputar tidak boleh dihapus lewat fungsi ini. */
export function removeAt(list, index, at) {
  if (at < 0 || at >= list.length || at === index) return { list, index };
  const next = list.slice();
  next.splice(at, 1);
  return { list: next, index: at < index ? index - 1 : index };
}

/** Sisipkan item tepat setelah lagu yang sedang diputar (duplikat lama dipindahkan, bukan digandakan). */
export function insertNext(list, index, items) {
  const cur = list[index];
  const incoming = dedupe(items).filter((t) => trackId(t) !== trackId(cur));
  const ids = new Set(incoming.map(trackId));
  const kept = list.filter((t, i) => i === index || !ids.has(trackId(t)));
  const newIndex = cur ? kept.findIndex((t) => t === cur) : -1;
  const at = newIndex === -1 ? kept.length : newIndex + 1;
  const next = kept.slice(0, at).concat(incoming, kept.slice(at));
  return { list: next, index: newIndex === -1 ? index : newIndex, added: incoming.length };
}

/** Tambah ke akhir antrean; lagu yang sudah ada tidak digandakan. */
export function appendUnique(list, index, items) {
  const have = new Set(list.map(trackId));
  const incoming = [];
  for (const t of items) {
    const id = trackId(t);
    if (!id || have.has(id)) continue;
    have.add(id);
    incoming.push(t);
  }
  return { list: list.concat(incoming), index, added: incoming.length };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((t) => {
    const id = trackId(t);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Mix Antrean: acak semua lagu SETELAH yang sedang diputar; yang sudah/sedang diputar tetap. */
export function mixQueue(list, index, rng = Math.random) {
  const head = list.slice(0, index + 1);
  const tail = list.slice(index + 1);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  return { list: head.concat(tail), index };
}

/** Hapus seluruh antrean kecuali lagu yang sedang diputar. */
export function clearUpcoming(list, index) {
  if (index < 0 || index >= list.length) return { list: [], index: -1 };
  return { list: [list[index]], index: 0 };
}

export function queueDurationSeconds(list) {
  let total = 0;
  for (const t of list) {
    const s = parseDurationText(t.duration);
    if (s == null) return null;
    total += s;
  }
  return total;
}
