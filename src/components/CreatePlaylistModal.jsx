import React, { useEffect, useState } from 'react';
import { createPlaylist, updateUserPlaylist } from '../services/library';
import { GhostButton, PrimaryButton, Sheet } from './ui';

/** Buat / ubah playlist (nama + deskripsi). `playlist` diisi untuk mode ubah. */
export default function CreatePlaylistModal({ open, onClose, playlist, onSaved }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  useEffect(() => { if (open) { setName(playlist?.name || ''); setDesc(playlist?.description || ''); } }, [open, playlist]);
  if (!open) return null;
  const save = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (playlist) { updateUserPlaylist(playlist.id, { name: name.trim().slice(0, 120), description: desc.trim().slice(0, 500) }); onSaved?.(playlist); }
    else onSaved?.(createPlaylist(name.trim(), '', desc.trim()));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={playlist ? 'Ubah Playlist' : 'Playlist Baru'} z={215}>
      <form onSubmit={save} className="space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <label className="block text-[13px] font-medium text-fg/70">Nama
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Mis. Teman begadang"
            className="mt-1.5 h-12 w-full rounded-xl border border-fg/10 bg-fg/[0.06] px-4 text-[15px] text-fg outline-none placeholder:text-fg/35 focus:border-fg/40" />
        </label>
        <label className="block text-[13px] font-medium text-fg/70">Deskripsi (opsional)
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={3} placeholder="Ceritakan suasana playlist ini"
            className="mt-1.5 w-full resize-none rounded-xl border border-fg/10 bg-fg/[0.06] px-4 py-3 text-[15px] text-fg outline-none placeholder:text-fg/35 focus:border-fg/40" />
        </label>
        <div className="grid grid-cols-2 gap-3"><GhostButton type="button" onClick={onClose} className="h-11">Batal</GhostButton><PrimaryButton type="submit" disabled={!name.trim()}>{playlist ? 'Simpan' : 'Buat'}</PrimaryButton></div>
      </form>
    </Sheet>
  );
}
