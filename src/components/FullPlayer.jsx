import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronDown, AudioWaveform, MoreVertical,  
    Heart, Volume2, VolumeX, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat,
    Sliders, Timer, ListPlus, Zap, ListMusic, Share2, FlipHorizontal, Sparkles
} from 'lucide-react';
import { usePlayer, useProgress } from '../context/PlayerContext';
import {
    toHDCover, fm, isLikedSong, toggleLikeSong, handleImgError
} from '../utils/helpers';
import FlipCard from './reactbits/FlipCard';

export default function FullPlayer() {
    const {
        currentTrack,
        isPlaying,
        isLoading,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        repeatMode,
        toggleRepeat,
        isShuffle,
        toggleShuffle,
        volume,
        setVolumeLevel,
        toggleMute,
        isFullPlayerOpen,
        setIsFullPlayerOpen,
        fullPlayerView,
        setFullPlayerView,
        setIsLyricsOverlayOpen,
        lyrics,
        currentLyricIndex,
        lyricOffset,
        lyricSyncPrev,
        lyricSyncNext,
        bgGlowEnabled,
        toggleBgGlow,
        setActiveArtist,
        setIsEqualizerOpen,
        setIsSleepTimerOpen,
        setIsSpeedOpen,
        setIsQueueOpen,
        openMix,
        setIsAddToPlaylistOpen,
        setIsShareCardOpen,
        showToast,
        autoNext,
        setAutoNext
    } = usePlayer();
    const { currentTime, duration } = useProgress();

    const [isLiked, setIsLiked] = useState(false);
    const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
    const lyricsScrollRef = useRef(null);

    useEffect(() => {
        if (currentTrack) {
            setIsLiked(isLikedSong(currentTrack));
        }
    }, [currentTrack]);

    // Auto-scroll inline lyrics
    useEffect(() => {
        if (fullPlayerView === 'lyrics' && lyricsScrollRef.current && currentLyricIndex >= 0) {
            const activeEl = lyricsScrollRef.current.querySelector(`.lyric-line-${currentLyricIndex}`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentLyricIndex, fullPlayerView]);

    if (!isFullPlayerOpen || !currentTrack) return null;

    const coverUrl = toHDCover(currentTrack.cover, currentTrack.videoId || currentTrack.id);
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const volPercent = Math.round(volume * 100);

    const handleToggleLike = () => {
        const added = toggleLikeSong(currentTrack);
        setIsLiked(added);
        showToast(added ? 'Ditambahkan ke Lagu Disukai' : 'Dihapus dari Lagu Disukai');
    };

    const handleOpenArtist = () => {
        if (currentTrack.artistId) {
            setIsFullPlayerOpen(false);
            setActiveArtist({ id: currentTrack.artistId, name: currentTrack.artist, cover: coverUrl });
        }
    };

    return (
        <div
            id="full-player"
            className="fixed inset-0 flex flex-col justify-between z-[170] text-white p-4 pt-safe sm:p-6 sm:pt-safe overflow-hidden transition-transform duration-300 ease-out"
        >
            {/* Blurred Artwork Background Container */}
            <div className="player-bg-container">
                <img src={coverUrl} className="player-bg-blur-img" alt="" onError={handleImgError} />
                {bgGlowEnabled && <div id="full-bg-glow" className="player-bg-glow"></div>}
                <div className="player-bg-vignette"></div>
            </div>

            {/* Top Header */}
            <div className="relative z-10 flex justify-between items-center flex-shrink-0 pt-1 pb-1">
                <button
                    onClick={() => setIsFullPlayerOpen(false)}
                    aria-label="Tutup Player"
                    className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full active:scale-90 transition-all cursor-pointer"
                    title="Tutup Player"
                >
                    <ChevronDown className="w-7 h-7" />
                </button>
                <div className="text-center">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#a0a5b0] font-bold">Sedang Diputar</p>
                    <p className="text-xs font-bold text-white/90 truncate max-w-[180px] mt-0.5">{currentTrack.artist}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleBgGlow}
                        aria-label="Matikan atau Nyalakan Latar Bergerak"
                        className={`p-2 rounded-full active:scale-90 transition-all cursor-pointer ${
                            bgGlowEnabled ? 'text-white bg-white/15' : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                        title="Matikan/Nyalakan Latar Bergerak"
                    >
                        <AudioWaveform className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setIsMoreSheetOpen(true)}
                        aria-label="Opsi Lainnya"
                        className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full active:scale-90 transition-all cursor-pointer"
                        title="Opsi"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Toggle Segment: Cover / Lyrics (Smooth Flip trigger) */}
            <div className="relative z-10 flex justify-center items-center my-1 flex-shrink-0">
                <div className="inline-flex items-center bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/15 shadow-inner">
                    <button
                        onClick={() => setFullPlayerView('cover')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            fullPlayerView === 'cover' ? 'text-white bg-white/20 shadow-md' : 'text-white/60 hover:text-white bg-transparent'
                        }`}
                    >
                        <span>Cover</span>
                    </button>
                    <button
                        onClick={() => setFullPlayerView('lyrics')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            fullPlayerView === 'lyrics' ? 'text-white bg-white/20 shadow-md' : 'text-white/60 hover:text-white bg-transparent'
                        }`}
                    >
                        <span>Lirik</span>
                    </button>
                </div>
            </div>

            {/* Cover Artwork / Compact Lyrics FlipCard Container */}
            <div className="relative z-10 flex-1 flex items-center justify-center my-auto px-4 py-1" style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="relative w-[86%] sm:w-[88%] max-w-[340px] max-h-[360px] aspect-square flex items-center justify-center">
                    <FlipCard
                        flipped={fullPlayerView === 'lyrics'}
                        onFlipChange={(isFlipped) => setFullPlayerView(isFlipped ? 'lyrics' : 'cover')}
                        front={
                            <div className="w-full h-full relative rounded-2xl overflow-hidden flex items-center justify-center bg-zinc-900 border border-white/10 shadow-2xl group select-none">
                                <img
                                    src={coverUrl}
                                    alt=""
                                    className={`w-full h-full object-cover transition-all duration-300 ${
                                        isLoading ? 'brightness-75 scale-[0.98]' : 'brightness-100 scale-100'
                                    }`}
                                    onError={handleImgError}
                                />
                                {isLoading && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-20">
                                        <div className="w-12 h-12 rounded-full border-3 border-white/20 border-t-white animate-spin"></div>
                                        <span className="text-xs font-semibold text-white/95 tracking-wide bg-black/60 px-3.5 py-1 rounded-full border border-white/15 backdrop-blur-md">
                                            Memuat audio...
                                        </span>
                                    </div>
                                )}
                                {/* Subtle Flip Cue Badge */}
                                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-white/90 flex items-center gap-1.5 shadow-lg pointer-events-none transition-transform group-hover:scale-105">
                                    <FlipHorizontal className="w-3.5 h-3.5 text-white animate-pulse" />
                                    <span>Lirik</span>
                                </div>
                            </div>
                        }
                        back={
                            <div className="w-full h-full relative rounded-2xl bg-zinc-950/90 backdrop-blur-2xl border border-white/15 p-3.5 overflow-hidden flex flex-col shadow-2xl select-text">
                                {/* Mini Header: small thumbnail + title + artist + Flip Back button */}
                                <div className="flex items-center gap-2.5 pb-2.5 mb-1 border-b border-white/10 shrink-0 relative z-10">
                                    <img
                                        src={coverUrl}
                                        alt=""
                                        className="w-10 h-10 rounded-lg object-cover shadow-md border border-white/10 shrink-0"
                                        onError={handleImgError}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm font-bold text-white truncate">{currentTrack.title}</p>
                                        <p className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</p>
                                    </div>
                                    <button
                                        type="button"
                                        data-no-flip="true"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFullPlayerView('cover');
                                        }}
                                        className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white border border-white/15 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                                        title="Kembali ke Cover"
                                    >
                                        <FlipHorizontal className="w-3 h-3 text-white" />
                                        <span>Cover</span>
                                    </button>
                                </div>

                                {/* Scrollable Synchronized Lyrics */}
                                <div
                                    ref={lyricsScrollRef}
                                    data-no-flip="true"
                                    className="flex-1 w-full overflow-y-auto hide-scrollbar scroll-smooth relative z-10 overscroll-contain"
                                >
                                    {lyrics.type === 'loading' ? (
                                        <div className="h-full flex flex-col items-center justify-center text-white/50 text-xs gap-2 py-8">
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            <span>Memuat lirik...</span>
                                        </div>
                                    ) : (!lyrics.lines || lyrics.lines.length === 0) ? (
                                        <div className="h-full flex flex-col items-center justify-center text-white/50 text-xs text-center py-8">
                                            <span>Lirik tidak tersedia</span>
                                        </div>
                                    ) : (
                                        <div className="min-h-full flex flex-col justify-center text-left py-3">
                                            {lyrics.lines.map((line, idx) => {
                                                const isActive = idx === currentLyricIndex;
                                                const isPast = idx < currentLyricIndex;
                                                return (
                                                    <div
                                                        key={idx}
                                                        data-no-flip="true"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            seek(line.time);
                                                        }}
                                                        className={`inline-lyric-line lyric-line-${idx} ${
                                                            isActive ? 'active-lyric' : isPast ? 'past-lyric' : ''
                                                        }`}
                                                    >
                                                        <div>{line.text}</div>
                                                        {line.translation && (
                                                            <div className="lyric-translation">({line.translation.replace(/^\(|\)$/g, '').trim()})</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Sync Bar + Fullscreen Button */}
                                <div className="relative z-20 shrink-0 pt-2 flex items-center justify-between border-t border-white/10 mt-1 gap-2">
                                    <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 border border-white/10">
                                        <span className="text-[10px] text-white/60 font-semibold mr-0.5">Sync</span>
                                        <button
                                            type="button"
                                            data-no-flip="true"
                                            onClick={(e) => { e.stopPropagation(); lyricSyncPrev(); }}
                                            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-white font-bold text-xs flex items-center justify-center active:scale-90 transition cursor-pointer"
                                            title="Lirik Mundur 0.5s"
                                        >
                                            -
                                        </button>
                                        {lyricOffset !== 0 && (
                                            <span className="text-[10px] font-bold text-white">
                                                {lyricOffset > 0 ? `+${lyricOffset}` : lyricOffset}s
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            data-no-flip="true"
                                            onClick={(e) => { e.stopPropagation(); lyricSyncNext(); }}
                                            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-white font-bold text-xs flex items-center justify-center active:scale-90 transition cursor-pointer"
                                            title="Lirik Maju 0.5s"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        data-no-flip="true"
                                        onClick={(e) => { e.stopPropagation(); setIsLyricsOverlayOpen(true); }}
                                        className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white text-[11px] font-bold border border-white/20 backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                                        title="Buka Lirik Penuh"
                                    >
                                        <span>Lirik Penuh</span>
                                    </button>
                                </div>
                            </div>
                        }
                        width="100%"
                        height="100%"
                        radius={20}
                        axis="y"
                        stiffness={190}
                        damping={22}
                        tilt={true}
                        tiltMax={10}
                        glare={true}
                        hoverScale={1.02}
                        className="w-full h-full"
                    />
                </div>
            </div>

            {/* Song Info + Progress + Controls */}
            <div className="relative z-10 flex-shrink-0 w-full max-w-md mx-auto space-y-3 pb-2">
                {/* Song Info */}
                <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex-1 min-w-0 truncate">
                        <h2 className="text-xl sm:text-2xl font-black text-white truncate leading-tight">
                            {currentTrack.title}
                        </h2>
                        <p
                            onClick={handleOpenArtist}
                            className="text-white/70 text-xs sm:text-sm font-medium truncate cursor-pointer hover:text-white mt-1"
                        >
                            {currentTrack.artist}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setIsQueueOpen(true)}
                            aria-label="Tampilkan Antrean"
                            title="Antrean"
                            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0 cursor-pointer shadow-md bg-white/10 hover:bg-white/20 border border-white/10 text-white"
                        >
                            <ListMusic className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleToggleLike}
                            aria-label={isLiked ? 'Batal Suka Lagu' : 'Sukai Lagu'}
                            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0 cursor-pointer shadow-md ${
                                isLiked
                                    ? 'bg-white text-black border border-white'
                                    : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
                            }`}
                            title="Sukai Lagu"
                        >
                            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current text-black' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-3 px-1 my-2">
                    <span className="text-xs text-white/70 font-mono shrink-0 w-8 text-right font-semibold">
                        {fm(currentTime)}
                    </span>
                    <div className="relative flex-1 h-1.5 bg-white/20 rounded-full flex items-center group cursor-pointer">
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            aria-label="Posisi Durasi Lagu"
                            onChange={(e) => seek(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                            className="relative h-full bg-white rounded-full transition-all duration-75"
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    </div>
                    <span className="text-xs text-white/70 font-mono shrink-0 w-8 font-semibold">
                        {fm(duration)}
                    </span>
                </div>

                {/* Volume Control (Supports up to 150% Boost) */}
                <div className="flex items-center gap-3 px-2 pt-1 pb-1.5">
                    <button
                        onClick={toggleMute}
                        aria-label={volume === 0 ? 'Nyalakan Suara' : 'Bisukan Suara'}
                        className="text-white/70 hover:text-white transition cursor-pointer p-1 rounded-full active:scale-90 shrink-0"
                        title="Mute / Unmute"
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <div className="relative flex-1 h-1.5 bg-white/20 rounded-full flex items-center group cursor-pointer">
                        <input
                            type="range"
                            min="0"
                            max="150"
                            value={volPercent}
                            aria-label="Tingkat Volume Suara (Maks 150%)"
                            onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                            className="relative h-full bg-white rounded-full transition-all duration-75"
                            style={{ width: `${Math.min(100, (volPercent / 150) * 100)}%` }}
                        >
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    </div>
                    <span className="text-xs text-white/90 font-mono font-semibold w-9 text-right shrink-0">
                        {volPercent}%
                    </span>
                </div>

                {/* Music Controls (Shuffle, Prev, Play/Pause, Next, Repeat) */}
                <div className="flex items-center justify-between px-2 py-1">
                    <button
                        onClick={toggleShuffle}
                        aria-label="Putar Acak"
                        className={`relative active:scale-90 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            isShuffle ? 'text-white' : 'text-white/70 hover:text-white'
                        }`}
                        title="Acak (Shuffle)"
                    >
                        <Shuffle className="w-5 h-5" />
                        {isShuffle && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-white rounded-full"></span>}
                    </button>

                    <button
                        onClick={() => prevTrack()}
                        aria-label="Lagu Sebelumnya"
                        className="text-white/80 hover:text-white active:scale-90 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                        title="Lagu Sebelumnya"
                    >
                        <SkipBack className="w-6 h-6 fill-current" />
                    </button>

                    <button
                        onClick={togglePlay}
                        aria-label={isPlaying ? 'Jeda Lagu' : 'Putar Lagu'}
                        className="relative bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-white/20 cursor-pointer flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 shrink-0"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : isPlaying ? (
                            <Pause className="w-8 h-8 fill-current" />
                        ) : (
                            <Play className="w-8 h-8 fill-current ml-0.5" />
                        )}
                    </button>

                    <button
                        onClick={nextTrack}
                        aria-label="Lagu Berikutnya"
                        className="text-white/80 hover:text-white active:scale-90 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                        title="Lagu Berikutnya"
                    >
                        <SkipForward className="w-6 h-6 fill-current" />
                    </button>

                    <button
                        onClick={toggleRepeat}
                        aria-label="Ulangi Lagu"
                        className={`relative active:scale-90 w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            repeatMode !== 'off' ? 'text-white' : 'text-white/70 hover:text-white'
                        }`}
                        title="Ulang (Repeat)"
                    >
                        <Repeat className="w-5 h-5" />
                        {repeatMode === 'one' && (
                            <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-white">1</span>
                        )}
                    </button>
                </div>
            </div>

            {/* More Options Sheet Modal */}
            {isMoreSheetOpen && (
                <div
                    onClick={() => setIsMoreSheetOpen(false)}
                    className="fixed inset-0 z-[250] flex items-end justify-center bg-black/60"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#181922] w-full max-w-md rounded-t-3xl p-6 border-t border-white/10 animate-slide-up-modal"
                    >
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5"></div>

                        {/* Song Header */}
                        <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-white/5">
                            <img src={coverUrl} className="w-12 h-12 rounded-xl object-cover" alt="" onError={handleImgError} />
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-white text-sm truncate">{currentTrack.title}</h4>
                                <p className="text-xs text-[#a0a5b0] truncate">{currentTrack.artist}</p>
                            </div>
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <button
                                onClick={() => {
                                    setAutoNext(!autoNext);
                                    setIsMoreSheetOpen(false);
                                    showToast(autoNext ? 'Auto Next Dinonaktifkan' : 'Auto Next Diaktifkan');
                                }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                                style={{ opacity: autoNext ? 1 : 0.5 }}
                            >
                                <SkipForward className={`w-5 h-5 ${autoNext ? 'text-white' : 'text-zinc-400'}`} />
                                <span className={`text-xs font-semibold ${autoNext ? 'text-white' : 'text-zinc-400'}`}>Auto Next</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsEqualizerOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <Sliders className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Equalizer</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsSleepTimerOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <Timer className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Timer</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsAddToPlaylistOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <ListPlus className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Playlist</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsSpeedOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <Zap className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Speed</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsQueueOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <ListMusic className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Antrean</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); openMix(currentTrack); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <Sparkles className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Mix Antrean</span>
                            </button>

                            <button
                                onClick={() => { setIsMoreSheetOpen(false); setIsShareCardOpen(true); }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer"
                            >
                                <Share2 className="w-5 h-5 text-white" />
                                <span className="text-xs font-semibold text-white/90">Share</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setIsMoreSheetOpen(false)}
                            className="w-full mt-2 py-3 bg-white/10 text-white font-bold rounded-full border border-white/10 active:scale-95 transition cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
