'use strict';
// Penyimpanan avatar kustom. Prioritas: Vercel Blob (BLOB_READ_WRITE_TOKEN) -> KV (objek kecil, maks 64 KB,
// disimpan TERPISAH dari dokumen profil) -> tidak tersedia (UI menyembunyikan unggah).
const cfg = require('./config');
const { getDb } = require('./kv');

const KV_MAX_BYTES = 64 * 1024;

function avatarStorageKind() {
  const c = cfg.get();
  if (c.blobToken) return 'blob';
  if (getDb()) return 'kv';
  return 'none';
}

async function saveAvatar(uid, buf, img) {
  const kind = avatarStorageKind();
  const version = Date.now();
  if (kind === 'blob') {
    const { put } = await import('@vercel/blob');
    const res = await put(`avatars/${uid}-${version}.${img.ext}`, buf, {
      access: 'public', token: cfg.get().blobToken, contentType: img.type, addRandomSuffix: true,
    });
    return { kind, url: res.url, version };
  }
  if (kind === 'kv') {
    if (buf.length > KV_MAX_BYTES) {
      const err = new Error('avatar terlalu besar untuk penyimpanan KV');
      err.code = 'kv_too_large';
      throw err;
    }
    await getDb().setJSON(`avatar:${uid}`, { type: img.type, b64: buf.toString('base64'), version });
    return { kind, url: `/api/avatar/${encodeURIComponent(uid)}?v=${version}`, version };
  }
  const err = new Error('penyimpanan gambar belum dikonfigurasi');
  err.code = 'no_storage';
  throw err;
}

async function removeAvatar(uid, avatar) {
  try {
    if (avatar?.kind === 'blob' && cfg.get().blobToken) {
      const { del } = await import('@vercel/blob');
      await del(avatar.url, { token: cfg.get().blobToken });
    } else if (avatar?.kind === 'kv' && getDb()) {
      await getDb().del(`avatar:${uid}`);
    }
  } catch (e) {
    console.warn('[avatar] gagal menghapus berkas lama:', e.message);
  }
}

module.exports = { saveAvatar, removeAvatar, avatarStorageKind, KV_MAX_BYTES };
