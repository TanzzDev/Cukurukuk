// Pengukur DETIK DENGAR VALID dari kemajuan audio yang nyata. Murni (tanpa DOM) agar dapat diuji.
// TIDAK dihitung: klik Play tanpa audio berjalan, pause, buffering, seek/loncat, lagu gagal dimuat,
// rerender, dan tidak pernah melebihi waktu nyata (kecepatan 2x tidak menggandakan hitungan).
const r1 = (n) => Math.round(n * 10) / 10;

export class PlaybackTracker {
  constructor({ now = () => Date.now(), perf = () => performance.now(), onFlush, ownsLock = () => true, flushEvery = 15, maxStep = 2.5, tabId = 't' } = {}) {
    Object.assign(this, { now, perf, onFlush, ownsLock, flushEvery, maxStep, tabId });
    this.sid = '';
    this.seq = 0;
    this.acc = 0;
    this.lastTime = null;
    this.lastWall = 0;
    this.track = null;
  }

  /** Mulai sesi putar baru (satu sesi = satu kali lagu diputar, mis. ulang lagu sama = sesi baru). */
  begin(track) {
    this.flush('begin');
    this.track = track || null;
    this.sid = track ? `${this.tabId}-${this.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` : '';
    this.seq = 0;
    this.acc = 0;
    this.lastTime = null;
  }

  /** Dipanggil dari 'timeupdate' dengan keadaan elemen audio saat itu. */
  tick({ currentTime, paused, seeking, ready, rate = 1 }) {
    const wall = this.perf();
    if (!this.track || paused || seeking || !ready) {
      this.lastTime = currentTime;
      this.lastWall = wall;
      return 0;
    }
    if (this.lastTime == null) {
      this.lastTime = currentTime;
      this.lastWall = wall;
      return 0;
    }
    const dMedia = currentTime - this.lastTime;
    const dWall = (wall - this.lastWall) / 1000;
    this.lastTime = currentTime;
    this.lastWall = wall;
    if (!(dMedia > 0) || dMedia > this.maxStep * Math.max(1, rate) || dWall <= 0 || dWall > this.maxStep + 1) return 0; // loncat/seek/jeda
    if (!this.ownsLock()) return 0; // tab/perangkat lain yang menghitung
    const valid = Math.min(dMedia, dWall);
    this.acc += valid;
    if (this.acc >= this.flushEvery) this.flush('interval');
    return valid;
  }

  /** Pause / seek / buffering / selesai: hentikan baseline dan setor yang sudah terkumpul. */
  interrupt() {
    this.lastTime = null;
    this.flush('interrupt');
  }

  flush() {
    if (!this.track || this.acc < 0.5) return null;
    const ev = { id: `${this.sid}:${++this.seq}`, sid: this.sid, seconds: r1(this.acc), ts: this.now(), track: this.track };
    this.acc = 0;
    this.onFlush?.(ev);
    return ev;
  }
}

/** Kunci "tab pemilik hitungan" agar dua tab yang memutar bersamaan tidak menggandakan waktu dengar. */
export function createListenLock({ storage, tabId, ttl = 12000, now = () => Date.now(), key = 'drowify:listen-lock', refreshEvery = 2000 } = {}) {
  let lastCheck = -Infinity;
  let owned = false;
  return {
    owns() {
      const t = now();
      if (t - lastCheck < (owned ? refreshEvery : 1000)) return owned;
      lastCheck = t;
      try {
        const cur = JSON.parse(storage.getItem(key) || 'null');
        if (!cur || cur.tab === tabId || t - cur.ts > ttl) {
          storage.setItem(key, JSON.stringify({ tab: tabId, ts: t }));
          owned = true;
        } else owned = false;
      } catch (_) {
        owned = true;
      }
      return owned;
    },
    release() {
      try {
        const cur = JSON.parse(storage.getItem(key) || 'null');
        if (cur?.tab === tabId) storage.removeItem(key);
      } catch (_) { /* abaikan */ }
      owned = false;
      lastCheck = -Infinity;
    },
  };
}
