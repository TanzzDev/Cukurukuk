import React, { useState } from 'react';
import { cn } from './ui';

/** Foto profil (Google/kustom) dengan fallback inisial. Satu komponen untuk Dashboard, Kamu, sidebar, dsb. */
export default function Avatar({ profile, size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);
  const name = (profile?.name || '').trim();
  const initials = name ? name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') : '';
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  if (profile?.avatarUrl && !failed) {
    return <img src={profile.avatarUrl} alt={name ? `Foto profil ${name}` : 'Foto profil'} referrerPolicy="no-referrer" onError={() => setFailed(true)} style={style} className={cn('shrink-0 rounded-full bg-fg/10 object-cover', className)} />;
  }
  return <span aria-hidden="true" style={style} className={cn('grid shrink-0 place-items-center rounded-full bg-fg font-display font-semibold text-bg', className)}>{initials || '?'}</span>;
}
