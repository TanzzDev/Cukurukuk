import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, MoreVertical, X } from 'lucide-react';
import { FI, handleImgError, toHDCover, toThumbCover } from '../utils/helpers';
import { useIsDesktop } from '../hooks/useMedia';

export function Cover({ track, src, className = '', hd = false, alt = '' }) {
  const id = track?.videoId || track?.id;
  const raw = src ?? track?.cover ?? track?.thumbnail ?? '';
  const url = hd ? toHDCover(raw, id) : toThumbCover(raw, id);
  return <img src={url || FI} alt={alt} loading="lazy" decoding="async" draggable="false" onError={handleImgError} className={cn('bg-fg/10 object-cover', className)} />;
}

// Penggabung kelas. (cn di utils/helpers adalah pembersih judul lagu milik kode lama, jangan dipakai untuk kelas CSS.)
export const cn = (...a) => a.flat(Infinity).filter(Boolean).join(' ');

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} aria-label="Memuat" />;
}

export function IconButton({ label, onClick, children, className = '', disabled, active, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn('press focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg/80 hover:bg-fg/10 hover:text-fg disabled:opacity-40', className)} {...rest}>
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children, className = '', wide = false, z = 200, side = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className={cn('fixed inset-0 flex justify-center', side ? 'items-end md:items-stretch md:justify-end' : 'items-end md:items-center')} style={{ zIndex: z }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 fade-in" onClick={onClose} />
      <div className={cn('sheet-in relative flex w-full flex-col border border-fg/10 bg-card shadow-2xl',
        side ? 'max-h-[90vh] rounded-t-3xl md:max-h-none md:h-full md:max-w-[420px] md:rounded-none md:rounded-l-3xl' : cn('max-h-[88vh] rounded-t-3xl md:max-h-[84vh] md:rounded-3xl', wide ? 'md:max-w-2xl' : 'md:max-w-md'), className)}>
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h2 className="font-display text-[15px] font-semibold">{title}</h2>
            <IconButton label="Tutup" onClick={onClose} className="bg-fg/5"><X size={18} /></IconButton>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = 'Ya', cancelLabel = 'Batal', danger, onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} z={230}>
      <div className="p-6 pb-7 text-center">
        <div className={cn('mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full', danger ? 'bg-red-500/15 text-red-400' : 'bg-fg/10')}><AlertTriangle size={22} /></div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {text && <p className="mt-2 text-sm text-fg/60">{text}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="press h-11 rounded-full bg-fg/10 text-sm font-semibold hover:bg-fg/15">{cancelLabel}</button>
          <button type="button" onClick={() => { onConfirm?.(); onClose?.(); }}
            className={cn('press h-11 rounded-full text-sm font-semibold', danger ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-fg text-bg hover:opacity-90')}>{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  );
}

/** Menu tiga titik: popover di layar lebar, lembar bawah di layar sentuh. items: { label, icon, onClick, danger, disabled, hint } */
export function ActionMenu({ items, label = 'Menu', className = '', iconSize = 18 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const desktop = useIsDesktop();
  useEffect(() => {
    if (!open || !desktop) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', esc); };
  }, [open, desktop]);
  const list = items.filter(Boolean);
  const run = (it) => { setOpen(false); it.onClick?.(); };
  const Row = ({ it, big }) => (
    <button type="button" role="menuitem" disabled={it.disabled} onClick={(e) => { e.stopPropagation(); run(it); }}
      className={cn('press flex w-full items-center gap-3 rounded-xl text-left text-sm hover:bg-fg/10 disabled:opacity-40', big ? 'px-4 py-3.5 text-[15px]' : 'px-3 py-2.5', it.danger && 'text-red-400')}>
      {it.icon && <it.icon size={18} className="shrink-0 opacity-80" />}
      <span className="flex-1">{it.label}</span>
      {it.hint && <span className="text-xs text-fg/40">{it.hint}</span>}
    </button>
  );
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <IconButton label={label} onClick={() => setOpen((o) => !o)} className={cn('h-9 w-9', className)} aria-haspopup="menu" aria-expanded={open}><MoreVertical size={iconSize} /></IconButton>
      {open && desktop && (
        <div role="menu" className="pop-in absolute right-0 top-full z-50 mt-1 min-w-[232px] rounded-2xl border border-fg/10 bg-raised p-1.5 shadow-2xl">
          {list.map((it) => <Row key={it.label} it={it} />)}
        </div>
      )}
      {open && !desktop && (
        <Sheet open onClose={() => setOpen(false)} z={220}>
          <div role="menu" className="p-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">{list.map((it) => <Row key={it.label} it={it} big />)}</div>
        </Sheet>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-fg/[0.07]"><Icon size={26} className="text-fg/60" /></div>}
      <h3 className="font-display text-[15px] font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-sm text-fg/55">{text}</p>}
      {action}
    </div>
  );
}

export const PrimaryButton = ({ children, className = '', ...p }) => (
  <button type="button" {...p} className={cn('press focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-full bg-fg px-6 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50', className)}>{children}</button>
);
export const GhostButton = ({ children, className = '', ...p }) => (
  <button type="button" {...p} className={cn('press focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-full bg-fg/10 px-5 text-sm font-semibold hover:bg-fg/15 disabled:opacity-50', className)}>{children}</button>
);

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('press relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-fg' : 'bg-fg/20')}>
      <span className={cn('absolute top-1 h-5 w-5 rounded-full transition-all', checked ? 'left-6 bg-bg' : 'left-1 bg-fg')} />
    </button>
  );
}

export const SkelRow = () => (
  <div className="flex items-center gap-3 px-3 py-2.5">
    <div className="skel h-12 w-12 rounded-lg" />
    <div className="flex-1 space-y-2"><div className="skel h-3.5 w-2/3 rounded" /><div className="skel h-3 w-1/3 rounded" /></div>
  </div>
);
export const SkelCard = ({ className = 'w-40' }) => (
  <div className={cn('shrink-0 space-y-2', className)}><div className="skel aspect-square w-full rounded-xl" /><div className="skel h-3.5 w-3/4 rounded" /><div className="skel h-3 w-1/2 rounded" /></div>
);

export function SectionHeader({ title, action, onAction, className = '' }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between px-4 md:px-0', className)}>
      <h2 className="font-display text-[17px] font-semibold leading-tight">{title}</h2>
      {action && <button type="button" onClick={onAction} className="press text-[13px] font-medium text-fg/55 hover:text-fg">{action}</button>}
    </div>
  );
}

export const fmtDur = (sec) => {
  if (sec == null || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** 1 jam 3 menit / 24 menit 7 detik */
export const fmtLong = (sec) => {
  if (sec == null || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} jam ${m} menit`;
  if (m) return `${m} menit${r ? ` ${r} detik` : ''}`;
  return `${r} detik`;
};

/** Pembungkus halaman: judul besar + aksi, konsisten di semua halaman utama. */
export function PageHeader({ title, subtitle, right, className = '' }) {
  return (
    <header className={cn('flex items-end justify-between gap-3 px-4 pb-4 pt-5 pt-safe md:px-0 md:pt-8', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight md:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-fg/55">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}

/** Baris kartu yang dapat digeser (snap), tanpa bar gulir. */
export function Shelf({ children, className = '' }) {
  return <div className={cn('no-scrollbar -mb-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:gap-4 md:px-0', className)}>{children}</div>;
}

export function PlaylistCover({ pl, className = '' }) {
  const songs = pl?.songs || [];
  if (pl?.image) return <Cover src={pl.image} className={cn('aspect-square w-full', className)} />;
  if (songs.length >= 4) {
    return (
      <div className={cn('grid aspect-square w-full grid-cols-2 overflow-hidden bg-fg/10', className)}>
        {songs.slice(0, 4).map((t, i) => <Cover key={i} track={t} className="h-full w-full" />)}
      </div>
    );
  }
  if (songs.length) return <Cover track={songs[0]} className={cn('aspect-square w-full', className)} />;
  return <div className={cn('grid aspect-square w-full place-items-center bg-fg/[0.08] text-fg/40', className)}><svg width="34%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>;
}
