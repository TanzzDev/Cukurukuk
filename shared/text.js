// Normalisasi & kemiripan teks (dipakai pencocokan Spotify dan peringkat rekomendasi).

export function normalizeText(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring|with)\b.*$/g, ' ')
    .replace(/\s[-–—]\s*(remaster(ed)?(\s\d{4})?|live|mono|stereo|radio edit|single version|version).*$/g, ' ')
    .replace(/\b(official|video|lyrics?|audio|music|hd|hq)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dice(a, b) {
  const A = a.split(' ').filter(Boolean);
  const B = b.split(' ').filter(Boolean);
  if (!A.length || !B.length) return 0;
  const setB = new Map();
  for (const t of B) setB.set(t, (setB.get(t) || 0) + 1);
  let hit = 0;
  for (const t of A) {
    const c = setB.get(t) || 0;
    if (c > 0) {
      hit += 1;
      setB.set(t, c - 1);
    }
  }
  return (2 * hit) / (A.length + B.length);
}

