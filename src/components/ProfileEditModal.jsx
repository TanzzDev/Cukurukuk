import React, { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emit } from '../services/bus';
import Avatar from './Avatar';
import { GhostButton, PrimaryButton, Sheet, Spinner } from './ui';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SOURCE = 8 * 1024 * 1024;
const MAX_OUT = 140 * 1024;

/** Pangkas persegi di tengah, ubah ke 256×256 WebP/JPEG (≤ 140 KB) — tidak ada gambar besar yang dikirim/disimpan. */
async function processAvatar(file) {
  if (!TYPES.includes(file.type)) throw new Error('Format harus PNG, JPEG, atau WebP.');
  if (file.size > MAX_SOURCE) throw new Error('Ukuran foto maksimal 8 MB.');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('Foto tidak dapat dibaca.'); });
  if (bmp.width < 64 || bmp.height < 64) throw new Error('Dimensi foto minimal 64×64 piksel.');
  if (bmp.width > 8000 || bmp.height > 8000) throw new Error('Dimensi foto terlalu besar (maksimal 8000 piksel).');
  const side = Math.min(bmp.width, bmp.height);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close?.();
  const toBlob = (type, q) => new Promise((res) => cv.toBlob(res, type, q));
  for (const [type, q] of [['image/webp', 0.86], ['image/webp', 0.7], ['image/jpeg', 0.7], ['image/jpeg', 0.5]]) {
    const b = await toBlob(type, q);
    if (b && b.type === type && b.size <= MAX_OUT) return b;
  }
  throw new Error('Foto terlalu kompleks untuk dikompres. Pilih foto lain.');
}

export default function ProfileEditModal({ open, onClose }) {
  const { user, updateProfile, uploadAvatar, resetAvatar, features } = useApp();
  const [name, setName] = useState('');
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { if (open && user) { setName(user.displayName || user.name); setBlob(null); setPreview(''); setError(''); } }, [open]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  if (!open || !user) return null;

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setError(''); setBusy('Memproses foto…');
    try { const b = await processAvatar(f); setBlob(b); setPreview(URL.createObjectURL(b)); } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const save = async () => {
    setError(''); setBusy('Menyimpan…');
    try {
      const nm = name.trim();
      if (nm !== (user.displayName || user.name)) await updateProfile({ displayName: nm === user.googleName ? '' : nm });
      if (blob) await uploadAvatar(blob);
      emit('toast', 'Profil diperbarui');
      onClose();
    } catch (err) { setError(err.message || 'Gagal menyimpan.'); } finally { setBusy(''); }
  };
  const reset = async () => {
    setError(''); setBusy('Mengembalikan foto Google…');
    try { await resetAvatar(); setBlob(null); setPreview(''); emit('toast', 'Foto Google dipulihkan'); } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  const shown = { ...user, name: name.trim() || user.name, avatarUrl: preview || user.avatarUrl };
  return (
    <Sheet open onClose={onClose} title="Edit Profil" z={240}>
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="flex flex-col items-center gap-3">
          <Avatar profile={shown} size={96} />
          <div className="text-center"><div className="font-display text-[17px] font-semibold">{shown.name}</div><div className="text-[12.5px] text-fg/50">{user.email}</div></div>
          {features.avatarUpload ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              <GhostButton onClick={() => fileRef.current?.click()} disabled={!!busy}><Camera size={16} /> Ubah foto</GhostButton>
              {(user.hasCustomAvatar || preview) && <GhostButton onClick={preview ? () => { setBlob(null); setPreview(''); } : reset} disabled={!!busy}><RotateCcw size={15} /> {preview ? 'Batalkan pilihan' : 'Pakai foto Google'}</GhostButton>}
              <input ref={fileRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={pick} />
            </div>
          ) : <p className="text-center text-[12.5px] text-fg/50">Unggah foto belum tersedia di server ini. Foto Google dipakai.</p>}
        </div>
        <label className="mt-5 block text-[13px] font-medium text-fg/70">Nama tampilan
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1.5 h-12 w-full rounded-xl border border-fg/10 bg-fg/[0.06] px-4 text-[15px] outline-none focus:border-fg/40" />
        </label>
        <p className="mt-1.5 text-[12px] text-fg/45">Nama ini dipakai di seluruh aplikasi dan tidak ditimpa nama akun Google saat login ulang.</p>
        {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-[13px] text-red-300" role="alert">{error}</p>}
        <PrimaryButton className="mt-5 w-full" onClick={save} disabled={!!busy || !name.trim()}>{busy ? <><Spinner size={16} /> {busy}</> : 'Simpan'}</PrimaryButton>
      </div>
    </Sheet>
  );
}
