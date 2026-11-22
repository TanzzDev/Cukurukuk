// Utilitas tanggal berbasis zona waktu. Semua "hari" Drowify = kunci 'YYYY-MM-DD'
// di zona waktu pengguna. Aritmetika hari dilakukan di UTC agar kebal DST.

const MS_DAY = 86400000;
const fmtCache = new Map();
const validCache = new Map();

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  if (validCache.has(tz)) return validCache.get(tz);
  let ok = true;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { ok = false; }
  validCache.set(tz, ok);
  return ok;
}

function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

const pad = (n) => String(n).padStart(2, '0');

/** Kunci tanggal lokal ('YYYY-MM-DD') untuk timestamp `ts` (ms) di zona `tz`. */
export function dateKey(ts, tz = 'UTC') {
  const zone = isValidTimeZone(tz) ? tz : 'UTC';
  let y = '', m = '', d = '';
  for (const p of formatter(zone).formatToParts(new Date(ts))) {
    if (p.type === 'year') y = p.value;
    else if (p.type === 'month') m = p.value;
    else if (p.type === 'day') d = p.value;
  }
  return `${y}-${m}-${d}`;
}

export function isDateKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcToKey(ms) {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(key, n) {
  return utcToKey(keyToUTC(key) + n * MS_DAY);
}

/** Selisih hari (b - a). */
export function diffDays(a, b) {
  return Math.round((keyToUTC(b) - keyToUTC(a)) / MS_DAY);
}

/** 0 = Minggu … 6 = Sabtu */
export function weekday(key) {
  return new Date(keyToUTC(key)).getUTCDay();
}

/** m = 1..12 */
export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthKeyOf(key) {
  return key.slice(0, 7);
}

export function startOfWeekKey(key) {
  // Senin sebagai awal pekan
  return addDays(key, -((weekday(key) + 6) % 7));
}

/** Instan (ms) saat hari lokal `key` dimulai (00:00) di zona `tz`. Pencarian biner terhadap dateKey (aman DST). */
export function startOfDayMs(key, tz = 'UTC') {
  const zone = isValidTimeZone(tz) ? tz : 'UTC';
  const base = keyToUTC(key);
  let lo = base - 15 * 3600000;
  let hi = base + 15 * 3600000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dateKey(mid, zone) >= key) hi = mid;
    else lo = mid;
  }
  return hi;
}
