'use strict';
// Adaptor penyimpanan key-value. Urutan pemilihan driver:
//  1) Upstash Redis REST (UPSTASH_REDIS_REST_URL/TOKEN atau KV_REST_API_URL/TOKEN)  -> produksi (Vercel)
//  2) File JSON lokal (.data/db.json, hanya saat BUKAN produksi)                    -> pengembangan lokal
//  3) DEV_DB_FILE=:memory:                                                          -> pengujian
//  4) tidak ada                                                                     -> fitur akun/sinkronisasi dinonaktifkan
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

class MemoryDriver {
  constructor(file) {
    this.kind = file ? 'file' : 'memory';
    this.file = file;
    this.map = new Map();
    if (file) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [k, v] of Object.entries(raw)) this.map.set(k, { v, exp: 0 });
      } catch (_) { /* file belum ada */ }
    }
  }
  _live(k) {
    const e = this.map.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) {
      this.map.delete(k);
      return null;
    }
    return e;
  }
  _flush() {
    if (!this.file) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const out = {};
        for (const [k, e] of this.map) if (!e.exp) out[k] = e.v;
        fs.writeFileSync(this.file, JSON.stringify(out));
      } catch (err) { console.warn('[kv] gagal menulis file dev:', err.message); }
    }, 150);
    this._t.unref?.();
  }
  async get(k) { return this._live(k)?.v ?? null; }
  async set(k, v, px) { this.map.set(k, { v, exp: px ? Date.now() + px : 0 }); this._flush(); }
  async del(k) { this.map.delete(k); this._flush(); }
  async setnx(k, v, px) {
    if (this._live(k)) return false;
    this.map.set(k, { v, exp: px ? Date.now() + px : 0 });
    return true;
  }
}

class UpstashDriver {
  constructor(url, token) {
    this.kind = 'upstash';
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }
  async cmd(args) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`Upstash: ${data.error || res.status}`);
    return data.result;
  }
  async get(k) { return this.cmd(['GET', k]); }
  async set(k, v, px) { return this.cmd(px ? ['SET', k, v, 'PX', String(px)] : ['SET', k, v]); }
  async del(k) { return this.cmd(['DEL', k]); }
  async setnx(k, v, px) { return (await this.cmd(['SET', k, v, 'NX', 'PX', String(px)])) === 'OK'; }
}

let cache = null;
function getDb() {
  const c = cfg.get();
  const sig = [c.kvUrl, c.kvToken, c.devDbFile, c.isProd].join('|');
  if (cache && cache.sig === sig) return cache.db;
  let driver = null;
  if (c.kvUrl && c.kvToken) driver = new UpstashDriver(c.kvUrl, c.kvToken);
  else if (c.devDbFile === ':memory:') driver = new MemoryDriver(null);
  else if (c.devDbFile || !c.isProd) driver = new MemoryDriver(path.resolve(c.devDbFile || '.data/db.json'));
  const db = driver && {
    kind: driver.kind,
    persistent: true,
    async getJSON(k) {
      const raw = await driver.get(k);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    },
    async setJSON(k, v, px) { return driver.set(k, JSON.stringify(v), px); },
    getRaw: (k) => driver.get(k),
    setRaw: (k, v, px) => driver.set(k, v, px),
    del: (k) => driver.del(k),
    setnx: (k, v, px) => driver.setnx(k, v, px),
  };
  cache = { sig, db };
  return db;
}

/** Kunci per-pengguna agar baca-ubah-tulis tidak saling menimpa (dua perangkat / dua request). */
async function withLock(db, name, fn) {
  const key = `lock:${name}`;
  for (let i = 0; i < 25; i++) {
    if (await db.setnx(key, '1', 5000)) {
      try { return await fn(); } finally { await db.del(key).catch(() => {}); }
    }
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 60));
  }
  const err = new Error('busy');
  err.code = 'busy';
  throw err;
}

module.exports = { getDb, withLock };
