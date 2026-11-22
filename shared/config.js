// Konfigurasi bersama klien & server. Ubah nilai di sini (atau lewat env di server)
// untuk menyetel aturan Streak tanpa menyentuh logika.

export const APP_NAME = 'Drowify Music';

/**
 * Aturan Streak (satu sumber kebenaran; server dapat menimpa lewat env, lihat server/lib/config.js).
 *  minPlays     : jumlah PEMUTARAN VALID per hari kalender agar hari dihitung aktif (default 1)
 *  minSeconds   : tambahan syarat detik dengar valid per hari (default 0 = tidak dipakai)
 *  recoveryDays : lama masa pemulihan sejak hari pertama terlewat, dihitung inklusif (default 7)
 * Catatan: dokumen spesifikasi menulis "3 lagu" di satu bagian dan "1 lagu" di bagian lain; default 1.
 */
export const DEFAULT_RULES = Object.freeze({ minPlays: 1, minSeconds: 0, recoveryDays: 7 });

/** Milestone streak. Streak sendiri TIDAK dibatasi 999: hitungan terus berjalan. */
export const MILESTONES = Object.freeze([
  1, 3, 7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365, 450, 500, 600, 750, 900, 999,
]);
export const FINAL_MILESTONE = MILESTONES[MILESTONES.length - 1];

/** Satu pemutaran valid = minimal 30 detik dengar nyata (atau separuh lagu yang lebih pendek). */
export const PLAY_MIN_SECONDS = 30;
/** Satu event pencatatan tidak boleh mengklaim lebih dari ini. */
export const EVENT_MAX_SECONDS = 120;
/** Server: waktu dengar yang diterima tidak boleh melebihi waktu nyata + kredit ini (detik). */
export const MAX_CREDIT_SECONDS = 1800;
/** Server: timestamp klien hanya dipercaya bila selisih ke jam server dalam jendela ini. */
export const SERVER_TS_WINDOW_MS = 30 * 60 * 1000;

export const HISTORY_LIMIT = 3000;
export const TRACKS_LIMIT = 1200;
export const SEEN_LIMIT = 400;
export const LIVE_LIMIT = 8;

export function milestoneTier(days) {
  if (days < 7) return 'spark';
  if (days >= 500) return 'legend';
  return 'flame';
}

export function milestoneName(days) {
  if (days === 1) return 'First Spark';
  if (days === 3) return 'Kindled';
  return days >= 500 ? `${days}-Day Legend` : `${days}-Day Flame`;
}

export function milestoneDescription(days) {
  if (days === 1) return 'Hari pertama: target dengar harian terpenuhi.';
  if (days >= 999) return 'Puncak perjalanan: 999 hari berturut-turut tanpa putus.';
  return `Penuhi target dengar harian ${days} hari berturut-turut.`;
}

/** Level api 0..5 untuk animasi (0 = bara/istirahat). */
export function flameLevel(days) {
  if (!days || days <= 0) return 0;
  if (days < 7) return 1;
  if (days < 30) return 2;
  if (days < 100) return 3;
  if (days < 365) return 4;
  return 5;
}
