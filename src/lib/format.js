import { keyToUTC } from '../../shared/dates.js';

export const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function fmtDateKey(key, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!key) return '–';
  return new Intl.DateTimeFormat('id-ID', { ...opts, timeZone: 'UTC' }).format(new Date(keyToUTC(key)));
}

export function fmtInstant(ms, tz = 'UTC') {
  if (!Number.isFinite(ms)) return '–';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(ms)).replace(/\./g, ':');
  } catch (_) { return new Date(ms).toLocaleString('id-ID'); }
}

/** Hitung mundur akurat dari selisih milidetik nyata: "3 hari 14 jam 22 menit" / "5 jam 02 menit 10 detik". */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  if (d) return `${d} hari ${h} jam ${p2(m)} menit`;
  if (h) return `${h} jam ${p2(m)} menit ${p2(r)} detik`;
  return `${m} menit ${p2(r)} detik`;
}

export function fmtMinutes(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60} menit`;
}

export function statusCopy(streak) {
  const need = streak.playsNeededToday;
  switch (streak.status) {
    case 'ACTIVE':
      return streak.needsToday
        ? { title: 'Apimu masih menyala', text: `Dengarkan ${need > 1 ? `${need} lagu` : 'satu lagu'} valid hari ini agar streak bertambah.` }
        : { title: 'Api streak menyala', text: 'Hari ini sudah terhitung. Sampai jumpa besok!' };
    case 'DORMANT':
      return { title: 'Api streak kamu sedang padam.', text: 'Masih ada kesempatan untuk menyalakannya kembali!' };
    case 'EXPIRED':
      return { title: 'Streak kamu telah berakhir.', text: 'Dengarkan lagu hari ini untuk memulai perjalanan streak baru!' };
    default:
      return { title: 'Mulai streak pertamamu', text: 'Dengarkan satu lagu valid hari ini untuk menyalakan api pertamamu.' };
  }
}
