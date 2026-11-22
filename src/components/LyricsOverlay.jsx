import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, AudioWaveform, Minus, Plus, RefreshCw } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { toHDCover, handleImgError } from '../utils/helpers';

export default function LyricsOverlay() {
    const {
        currentTrack,
        isLyricsOverlayOpen,
        setIsLyricsOverlayOpen,
        lyrics,
        currentLyricIndex,
        lyricOffset,
        lyricSyncPrev,
        lyricSyncNext,
        seek,
        bgGlowEnabled,
        toggleBgGlow
    } = usePlayer();

    const scrollContainerRef = useRef(null);
    // Pengguna menggulir manual -> auto-scroll dijeda; tombol "Sinkron ulang" mengembalikan posisi ke baris aktif.
    const [userScrolled, setUserScrolled] = useState(false);
    const synced = !!(lyrics.lines && lyrics.lines.some((l) => l.time > 0));
    const jumpToActive = () => {
        setUserScrolled(false);
        const el = scrollContainerRef.current?.querySelector(`.lyric-line-${currentLyricIndex}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    useEffect(() => setUserScrolled(false), [currentTrack?.videoId, currentTrack?.id]);

    useEffect(() => {
        if (isLyricsOverlayOpen && !userScrolled && scrollContainerRef.current && currentLyricIndex >= 0) {
            const activeEl = scrollContainerRef.current.querySelector(`.lyric-line-${currentLyricIndex}`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentLyricIndex, isLyricsOverlayOpen, userScrolled]);

    if (!isLyricsOverlayOpen || !currentTrack) return null;

    const coverUrl = toHDCover(currentTrack.cover, currentTrack.videoId || currentTrack.id);

    return (
        <div
            id="lyrics-overlay"
            className="fixed inset-0 flex flex-col z-[200] text-white overflow-hidden transition-transform duration-300 ease-out"
        >
            {/* Blurred Artwork Background */}
            <div className="player-bg-container">
                <img src={coverUrl} className="player-bg-blur-img" alt="" onError={handleImgError} />
                {bgGlowEnabled && <div id="lyrics-bg-glow" className="player-bg-glow"></div>}
                <div className="player-bg-vignette"></div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden flex justify-between items-center p-4 pt-safe flex-shrink-0 bg-black/30 backdrop-blur-md border-b border-white/10 relative z-20">
                <div className="flex items-center gap-3 overflow-hidden">
                    <img
                        src={coverUrl}
                        alt=""
                        className="w-12 h-12 rounded-md object-cover shadow-md flex-shrink-0 bg-white/5"
                        onError={handleImgError}
                    />
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-base truncate">{currentTrack.title}</span>
                        <span className="text-white/70 text-sm truncate">{currentTrack.artist}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsLyricsOverlayOpen(false)}
                    className="text-white/70 hover:text-white p-2 rounded-full active:scale-90 flex-shrink-0 transition-all bg-white/10 ml-3"
                >
                    <ChevronDown className="w-6 h-6" />
                </button>
            </div>

            {/* Floating Toggle & Sync Controls */}
            <button
                onClick={toggleBgGlow}
                className="md:hidden absolute top-[100px] left-6 z-30 bg-black/40 backdrop-blur-md w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all cursor-pointer"
                title="Latar Bergerak"
            >
                <AudioWaveform className="w-4 h-4" />
            </button>

            <div className="md:hidden absolute top-[100px] right-6 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <button
                    onClick={lyricSyncPrev}
                    className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                >
                    <Minus className="w-4 h-4" />
                </button>
                {lyricOffset !== 0 && (
                    <p className="text-xs font-bold text-white tracking-wide">
                        {lyricOffset > 0 ? `+${lyricOffset}` : lyricOffset}s
                    </p>
                )}
                <button
                    onClick={lyricSyncNext}
                    className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Desktop Close Button */}
            <button
                onClick={() => setIsLyricsOverlayOpen(false)}
                className="hidden md:flex absolute top-8 right-8 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-full active:scale-90 transition-all cursor-pointer"
            >
                <ChevronDown className="w-8 h-8" />
            </button>

            {/* Lyrics Scrollable Container */}
            <div className="flex-1 flex flex-col md:flex-row w-full h-full overflow-hidden relative z-10">
                <div
                    ref={scrollContainerRef}
                    id="lyrics-scroll-container"
                    onWheel={() => setUserScrolled(true)}
                    onTouchMove={() => setUserScrolled(true)}
                    className="w-full md:w-3/5 h-full overflow-y-auto px-6 md:px-16 hide-scrollbar z-10 relative scroll-smooth"
                >
                    <div className="pt-[30vh] pb-[60vh] w-full max-w-3xl mx-auto md:mx-0">
                        {lyrics.lines && lyrics.lines.length > 0 && !synced && (
                            <p className="mb-6 text-center text-xs text-white/50">Lirik ini tidak memiliki timestamp, jadi tidak ikut bergulir bersama lagu.</p>
                        )}
                        {lyrics.type === 'loading' ? (
                            <div className="flex justify-center items-center h-[30vh] w-full">
                                <div className="w-10 h-10 border-4 border-[#cfd3d8] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (!lyrics.lines || lyrics.lines.length === 0) ? (
                            <div className="flex justify-center items-center h-[30vh] w-full text-white/50 text-center">
                                <div>
                                    <p className="text-lg font-bold mb-1">Lirik tidak tersedia</p>
                                    <p className="text-sm">Tidak dapat menemukan lirik untuk lagu ini</p>
                                </div>
                            </div>
                        ) : (
                            lyrics.lines.map((line, idx) => {
                                const isActive = idx === currentLyricIndex;
                                const isPast = idx < currentLyricIndex;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => { if (synced) { seek(line.time); setUserScrolled(false); } }}
                                        className={`lyric-line lyric-line-${idx} ${
                                            isActive ? 'active-lyric' : isPast ? 'past-lyric' : ''
                                        }`}
                                    >
                                        <div>{line.text}</div>
                                        {line.translation && (
                                            <span className="lyric-translation">({line.translation.replace(/^\(|\)$/g, '').trim()})</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {userScrolled && synced && currentLyricIndex >= 0 && (
                <button
                    onClick={jumpToActive}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-xl active:scale-95 transition"
                >
                    <RefreshCw className="w-4 h-4" /> Sinkron ulang
                </button>
            )}

            {/* Right side artwork on desktop */}
                <div className="hidden md:flex md:w-2/5 h-full items-center justify-center p-8 z-10">
                    <div className="w-80 h-80 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                        <img src={coverUrl} alt="" className="w-full h-full object-cover" onError={handleImgError} />
                    </div>
                </div>
            </div>
        </div>
    );
}
