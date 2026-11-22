import React, { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Play, Pause, UserCheck } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isArtistLiked, toggleLikeArtist, toHDCover, FI, handleImgError } from '../utils/helpers';

export default function ArtistModal() {
    const {
        activeArtist,
        setActiveArtist,
        playTrack,
        currentTrack,
        isPlaying,
        isLoading,
        showToast,
        togglePlay,
        setActiveAlbum
    } = usePlayer();

    const [artistData, setArtistData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (!activeArtist || !activeArtist.id) return;
        setIsLiked(isArtistLiked(activeArtist.id));
        setLoading(true);
        setScrolled(false);
        fetch(`/api/artist?id=${encodeURIComponent(activeArtist.id)}`)
            .then(res => res.json())
            .then(data => {
                if (data.status && data.result) {
                    setArtistData(data.result);
                } else {
                    setArtistData(null);
                }
                setLoading(false);
            })
            .catch(() => {
                setArtistData(null);
                setLoading(false);
            });
    }, [activeArtist]);

    if (!activeArtist) return null;

    const getThumb = (item) => {
        if (item?.thumbnails && item.thumbnails.length > 0) {
            const lastT = item.thumbnails[item.thumbnails.length - 1];
            const raw = typeof lastT === 'string' ? lastT : (lastT.url || lastT.src || FI);
            return toHDCover(raw, item?.videoId);
        }
        return toHDCover(item?.cover || item?.thumbnail || FI, item?.videoId);
    };

    const tImg = activeArtist.cover || FI;
    const headerImg = (artistData && artistData.thumbnails && artistData.thumbnails.length > 0)
        ? (artistData.thumbnails[artistData.thumbnails.length - 1].url || tImg)
        : tImg;
    const artistName = (artistData && artistData.name) || activeArtist.name || 'Artist';

    const handleToggleLike = () => {
        const added = toggleLikeArtist({ artistId: activeArtist.id, name: artistName, thumbnail: headerImg });
        setIsLiked(added);
        showToast(added ? 'Artist ditambahkan ke Favorit' : 'Artist dihapus dari Favorit');
    };

    const handleShare = () => {
        const url = `${window.location.origin}/artist/${activeArtist.id}`;
        if (navigator.share) {
            navigator.share({
                title: `${artistName} - NanzMusify`,
                text: `Dengarkan lagu & album terbaik dari ${artistName} di NanzMusify!`,
                url: url
            }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => showToast('Link artist berhasil disalin!'));
        }
    };

    const handleScroll = (e) => {
        setScrolled(e.currentTarget.scrollTop > 50);
    };

    const topSongsList = (artistData && artistData.topSongs) ? artistData.topSongs.slice(0, 10).map(s => {
        return {
            id: s.videoId,
            videoId: s.videoId,
            title: s.title,
            artist: s.artist || artistName,
            artistId: activeArtist.id,
            cover: getThumb(s),
            ytUrl: `https://youtube.com/watch?v=${s.videoId}`
        };
    }) : [];

    return (
        <div
            id="artist-modal"
            className="fixed inset-0 bg-[#1a1b22] flex flex-col z-[100] animate-slide-up-modal overflow-hidden text-white"
        >
            {/* Sticky Header */}
            <div
                className={`flex items-center justify-between gap-3 p-4 pt-safe absolute top-0 left-0 w-full z-[100] transition-colors duration-300 ${
                    scrolled ? 'bg-[#1a1b22]/90 backdrop-blur-md' : 'bg-transparent'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => setActiveArtist(null)}
                        className="glass glass-hover rounded-full text-white p-3 active:scale-90 shadow-md bg-black/40 cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1
                        className={`text-xl font-black text-white truncate transition-opacity duration-300 ${
                            scrolled ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                        {artistName}
                    </h1>
                </div>
                <button
                    onClick={handleShare}
                    className="glass glass-hover rounded-full text-white p-3 active:scale-90 shadow-md bg-black/40 cursor-pointer"
                    title="Bagikan Artist"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto hide-scrollbar pb-36 relative"
            >
                {/* Hero Header */}
                <div className="relative w-full aspect-square max-h-[50vh] overflow-hidden -mt-20 mb-6">
                    <img src={headerImg} className="w-full h-full object-cover" alt="" onError={handleImgError} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14151a] via-[#14151a]/60 to-transparent"></div>

                    <div className="absolute bottom-6 left-6 right-6 flex flex-col justify-end items-center text-center">
                        <img src={headerImg} className="artist-photo mb-4" alt="" onError={handleImgError} />
                        <h2 className="text-3xl md:text-5xl font-black text-white drop-shadow-md">{artistName}</h2>

                        <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                                onClick={handleToggleLike}
                                className={`px-6 py-2.5 rounded-full border text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                    isLiked ? 'text-white border-white/60 bg-white/20' : 'text-white border-white/20 hover:bg-white/10'
                                }`}
                            >
                                <UserCheck className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                <span>{isLiked ? 'Disukai' : 'Sukai'}</span>
                            </button>
                            <button
                                onClick={handleShare}
                                className="px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/10 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 bg-white/5 shadow-md cursor-pointer"
                            >
                                <Share2 className="w-4 h-4" />
                                <span>Bagikan</span>
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center mt-12">
                        <div className="w-8 h-8 border-3 border-[#cfd3d8] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* 1. Lagu Teratas (Top Songs) */}
                        {topSongsList.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Lagu Teratas</h3>
                                <div className="space-y-1 px-2">
                                    {topSongsList.map((s, idx) => {
                                        const isCur = currentTrack && (
                                            currentTrack.id === s.videoId ||
                                            currentTrack.videoId === s.videoId ||
                                            (currentTrack.title === s.title && currentTrack.artist === s.artist)
                                        );
                                        const isPlay = isCur && isPlaying;
                                        const isLoad = isCur && isLoading;

                                        const rowBg = isPlay
                                            ? 'bg-[#343a4e] border border-white/40 shadow-xl'
                                            : isCur
                                            ? 'bg-[#2e3344] border border-white/30'
                                            : 'bg-[#20222c] border border-white/10 hover:bg-[#282b38]';

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    if (isCur) togglePlay();
                                                    else playTrack(s, topSongsList, idx, 'artist');
                                                }}
                                                className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-all duration-300 shadow-lg group ${rowBg}`}
                                            >
                                                <span className="text-white/70 w-6 text-center text-xs font-bold group-hover:text-white shrink-0">
                                                    {isLoad ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                                                    ) : isPlay ? (
                                                        <div className="flex items-end justify-center gap-[2px] w-4 h-4 pb-0.5 mx-auto">
                                                            <span className="w-[2px] bg-white rounded-full animate-eq-1"></span>
                                                            <span className="w-[2px] bg-white rounded-full animate-eq-2"></span>
                                                            <span className="w-[2px] bg-white rounded-full animate-eq-3"></span>
                                                        </div>
                                                    ) : isCur ? (
                                                        <Pause className="w-4 h-4 text-white fill-current mx-auto" />
                                                    ) : (
                                                        idx + 1
                                                    )}
                                                </span>

                                                <img
                                                    src={s.cover}
                                                    className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 border border-white/10"
                                                    alt=""
                                                    onError={handleImgError}
                                                />
                                                <div className="flex-1 min-w-0 truncate">
                                                    <p className={`text-sm truncate ${isCur ? 'text-white font-bold' : 'text-white/90 font-semibold'}`}>
                                                        {s.title}
                                                    </p>
                                                    <p className="text-white/60 text-xs truncate mt-0.5">{s.artist}</p>
                                                </div>
                                                <div className="shrink-0 p-1">
                                                    {isPlay ? (
                                                        <Pause className="w-5 h-5 text-white fill-current" />
                                                    ) : (
                                                        <Play className="w-5 h-5 text-white/70 group-hover:text-white fill-current" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2. Album (Top Albums) */}
                        {artistData && artistData.topAlbums && artistData.topAlbums.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Album</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.topAlbums.map((alb, i) => {
                                        const im = getThumb(alb);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setActiveAlbum({ id: alb.browseId || alb.id, cover: im })}
                                                className="flex-shrink-0 w-36 cursor-pointer group p-2 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all"
                                            >
                                                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 shadow-md">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white px-0.5">{alb.name || alb.title}</p>
                                                <p className="text-white/60 text-[10px] truncate px-0.5 mt-0.5">Album • {alb.artist || artistName}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 3. Singles & EP (Top Singles) */}
                        {artistData && artistData.topSingles && artistData.topSingles.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Singles & EP</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.topSingles.map((sg, i) => {
                                        const im = getThumb(sg);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setActiveAlbum({ id: sg.browseId || sg.id, cover: im })}
                                                className="flex-shrink-0 w-36 cursor-pointer group p-2.5 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all flex flex-col"
                                            >
                                                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 shadow-md">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white px-0.5">{sg.name || sg.title}</p>
                                                <p className="text-white/60 text-[10px] truncate px-0.5 mt-0.5">Single</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4. Video (Top Videos) */}
                        {artistData && artistData.topVideos && artistData.topVideos.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Video</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.topVideos.map((vd, i) => {
                                        const im = getThumb(vd);
                                        const isCur = currentTrack && (
                                            currentTrack.id === vd.videoId ||
                                            currentTrack.videoId === vd.videoId
                                        );
                                        const isPlay = isCur && isPlaying;
                                        const videoTrack = {
                                            id: vd.videoId,
                                            videoId: vd.videoId,
                                            title: vd.name || vd.title,
                                            artist: vd.artist || artistName,
                                            artistId: activeArtist.id,
                                            cover: im,
                                            ytUrl: `https://youtube.com/watch?v=${vd.videoId}`
                                        };

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    if (isCur) togglePlay();
                                                    else playTrack(videoTrack, [videoTrack], 0, 'artist');
                                                }}
                                                className="flex-shrink-0 w-48 cursor-pointer group p-2.5 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all flex flex-col"
                                            >
                                                <div className="w-full h-28 rounded-xl overflow-hidden mb-2 relative shadow-md">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                    <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md rounded-full p-1.5">
                                                        {isPlay ? (
                                                            <Pause className="w-4 h-4 fill-current text-white" />
                                                        ) : (
                                                            <Play className="w-4 h-4 fill-current text-white" />
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white px-0.5">{vd.name || vd.title}</p>
                                                <p className="text-white/60 text-[10px] truncate px-0.5 mt-0.5">{vd.artist || artistName}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 5. Playlist */}
                        {artistData && artistData.playlists && artistData.playlists.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Playlist</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.playlists.map((pl, i) => {
                                        const im = getThumb(pl);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setActiveAlbum({ id: pl.browseId || pl.id, cover: im })}
                                                className="flex-shrink-0 w-36 cursor-pointer group p-2.5 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all flex flex-col"
                                            >
                                                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 shadow-md">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white px-0.5">{pl.name || pl.title}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 6. Tampil Di (Featured On) */}
                        {artistData && artistData.featuredOn && artistData.featuredOn.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Tampil Di</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.featuredOn.map((fo, i) => {
                                        const im = getThumb(fo);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setActiveAlbum({ id: fo.browseId || fo.id, cover: im })}
                                                className="flex-shrink-0 w-36 cursor-pointer group p-2.5 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all flex flex-col"
                                            >
                                                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 shadow-md">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white px-0.5">{fo.name || fo.title}</p>
                                                <p className="text-white/60 text-[10px] truncate px-0.5 mt-0.5">{fo.artist || ''}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 7. Artis Serupa (Similar Artists) */}
                        {artistData && artistData.similarArtists && artistData.similarArtists.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-[#b3b3b3] uppercase tracking-wider mb-3 px-4">Artis Serupa</h3>
                                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4">
                                    {artistData.similarArtists.map((s, i) => {
                                        const im = getThumb(s);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setActiveArtist({ id: s.browseId || s.id, name: s.name, cover: im })}
                                                className="flex-shrink-0 w-32 cursor-pointer group p-2.5 rounded-2xl bg-[#20222c] border border-white/10 shadow-xl hover:bg-[#282b38] transition-all flex flex-col items-center"
                                            >
                                                <div className="w-20 h-20 rounded-full overflow-hidden mb-2 border-2 border-white/10 shadow-md group-hover:scale-105 transition-transform duration-300">
                                                    <img
                                                        src={im}
                                                        className="w-full h-full object-cover"
                                                        alt=""
                                                        onError={handleImgError}
                                                    />
                                                </div>
                                                <p className="font-semibold text-xs truncate text-white text-center w-full px-0.5">{s.name}</p>
                                                <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold mt-0.5">Artist</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
