import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { toHDCover, handleImgError } from '../utils/helpers';

export default function ShareCardModal() {
    const { isShareCardOpen, setIsShareCardOpen, currentTrack, showToast } = usePlayer();

    if (!isShareCardOpen || !currentTrack) return null;

    const vid = currentTrack.videoId || currentTrack.id;
    const coverUrl = toHDCover(currentTrack.cover, vid);
    const shareUrl = `${window.location.origin}/play/${vid}?share=true`;

    const handleCopy = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('Link berhasil disalin ke clipboard!');
                setIsShareCardOpen(false);
            }).catch(() => {
                showToast('Gagal menyalin link');
            });
        }
    };

    const handleNativeShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `${currentTrack.title} - ${currentTrack.artist}`,
                text: `Dengarkan lagu ${currentTrack.title} di NanzMusify!`,
                url: shareUrl
            }).catch(() => {});
        } else {
            handleCopy();
        }
    };

    return (
        <div
            onClick={() => setIsShareCardOpen(false)}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full max-w-md rounded-t-3xl p-6 border-t border-white/10 animate-slide-up-modal space-y-4"
                style={{ background: 'var(--bg-color)' }}
            >
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-white text-base">Bagikan Lagu</h3>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                    <img src={coverUrl} className="w-14 h-14 rounded-xl object-cover" alt="" onError={handleImgError} />
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-white text-sm truncate">{currentTrack.title}</h4>
                        <p className="text-xs text-white/60 truncate mt-0.5">{currentTrack.artist}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleNativeShare}
                        className="flex-1 btn-chrome font-bold py-3 rounded-full text-xs flex items-center justify-center gap-2"
                    >
                        Bagikan Langsung
                    </button>
                    <button
                        onClick={handleCopy}
                        className="px-6 py-3 glass glass-hover text-white rounded-full text-xs font-bold"
                    >
                        Salin Link
                    </button>
                </div>
            </div>
        </div>
    );
}
