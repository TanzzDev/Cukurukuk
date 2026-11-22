import React from 'react';
import { Check, Disc3, Heart, ListPlus, ListStart, Play, Plus, Sparkles, User } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { toggleLikeSong, useIsLiked } from '../services/library';
import { parseDurationText } from '../../shared/queue';
import { Cover, Sheet, cn, fmtDur } from './ui';

export default function TrackDetailSheet() {
  const p = usePlayer();
  const t = p.detailTrack;
  const liked = useIsLiked(t);
  const close = () => p.setDetailTrack(null);
  if (!t) return null;
  const dur = parseDurationText(t.duration);
  const inQ = p.isInQueue(t);
  const act = (fn) => () => { fn(); };
  const Btn = ({ icon: Icon, label, onClick, active }) => (
    <button type="button" onClick={onClick} className={cn('press focus-ring flex flex-col items-center gap-2 rounded-2xl bg-fg/[0.06] px-2 py-3.5 text-[12.5px] font-medium hover:bg-fg/[0.11]', active && 'text-emerald-400')}>
      <Icon size={20} />{label}
    </button>
  );
  return (
    <Sheet open onClose={close} title="Detail Lagu" z={210}>
      <div className="thin-scroll overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="flex items-center gap-4">
          <Cover track={t} hd className="h-24 w-24 shrink-0 rounded-2xl shadow-xl" />
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-semibold leading-snug">{t.title}</h3>
            <div className="mt-1 text-[14px] text-fg/60">{t.artist}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-fg/55">
              {dur != null && <span className="rounded-full bg-fg/[0.08] px-2.5 py-1">{fmtDur(dur)}</span>}
              {t.album && <span className="rounded-full bg-fg/[0.08] px-2.5 py-1">{t.album}</span>}
              {inQ && <span className="rounded-full bg-fg/[0.08] px-2.5 py-1 text-emerald-400">Sudah di Antrean</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Btn icon={Play} label="Putar Sekarang" onClick={act(() => { p.playNow(t); close(); })} />
          <Btn icon={ListStart} label="Putar Berikutnya" onClick={act(() => p.playNextInQueue(t))} />
          <Btn icon={inQ ? Check : ListPlus} label={inQ ? 'Sudah di Antrean' : 'Tambah Antrean'} active={inQ} onClick={act(() => p.addToQueue(t))} />
          <Btn icon={Sparkles} label="Mix Antrean" onClick={act(() => { close(); p.openMix(t); })} />
          <Btn icon={Plus} label="Ke Playlist" onClick={act(() => { close(); p.openAddToPlaylist(t); })} />
          <Btn icon={Heart} label={liked ? 'Disukai' : 'Suka'} active={liked} onClick={act(() => toggleLikeSong(t))} />
        </div>
        {(t.artistId || t.albumId) && (
          <div className="mt-4 space-y-2">
            {t.artistId && (
              <button type="button" onClick={() => { close(); p.setActiveArtist({ id: t.artistId, name: t.artist, cover: t.cover || t.thumbnail }); }} className="press flex w-full items-center gap-3 rounded-xl bg-fg/[0.06] px-4 py-3 text-left text-sm font-medium hover:bg-fg/[0.1]"><User size={18} />Lihat artis: {t.artist}</button>
            )}
            {t.albumId && (
              <button type="button" onClick={() => { close(); p.setActiveAlbum({ id: t.albumId, cover: t.cover || t.thumbnail }); }} className="press flex w-full items-center gap-3 rounded-xl bg-fg/[0.06] px-4 py-3 text-left text-sm font-medium hover:bg-fg/[0.1]"><Disc3 size={18} />Lihat album{t.album ? `: ${t.album}` : ''}</button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
