import React, { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Play, Shuffle, Pause } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { FI, handleImgError } from '../utils/helpers';

export default function AlbumModal() {
    const {
        activeAlbum,
        setActiveAlbum,
        playTrack,
        currentTrack,
        isPlaying,
        isLoading,
        showToast,
        togglePlay
    } = usePlayer();

    const [albumData, setAlbumData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!activeAlbum || !activeAlbum.id) return;
        setLoading(true);
        fetch(`/api/album?id=${activeAlbum.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.status && data.result) {
                    setAlbumData(data.result);
                } else {
                    setAlbumData(null);
                }
                setLoading(false);
            })
            .catch(() => {
                setAlbumData(null);
                setLoading(false);
            });
    }, [activeAlbum]);

    if (!activeAlbum) return null;

    let coverImg = activeAlbum.cover || FI;
    if (albumData) {
        if (albumData.thumbnails && albumData.thumbnails.length) {
            const lastThumb = albumData.thumbnails[albumData.thumbnails.length - 1];
            coverImg = typeof lastThumb === 'string' ? lastThumb : (lastThumb.url || lastThumb.src || coverImg);
        } else if (albumData.songs && albumData.songs.length > 0) {
            const firstSong = albumData.songs[0];
            if (firstSong.thumbnails && firstSong.thumbnails.length) {
                const sThumb = firstSong.thumbnails[0];
                coverImg = typeof sThumb === 'string' ? sThumb : (sThumb.url || sThumb.src || coverImg);
            }
        }
    }

    const songsList = (albumData && albumData.songs) ? albumData.songs.map(s => {
        let sim = null;
        if (s.thumbnails && s.thumbnails.length) {
            const sThumb = s.thumbnails[0];
            sim = typeof sThumb === 'string' ? sThumb : (sThumb.url || sThumb.src || null);
        }
        return {
            id: s.videoId,
            videoId: s.videoId,
            title: s.title,
            artist: s.artist,
            artistId: s.artistId || '',
            cover: sim || coverImg,
            ytUrl: `https://youtube.com/watch?v=${s.videoId}`
        };
    }) : [];

    const handlePlayAll = (startIndex = 0) => {
        if (songsList.length > 0) {
            playTrack(songsList[startIndex], songsList, startIndex, 'album');
        }
    };

    const handleShuffleAll = () => {
        if (songsList.length > 0) {
            const randomIdx = Math.floor(Math.random() * songsList.length);
            playTrack(songsList[randomIdx], songsList, randomIdx, 'album');
        }
    };

    const handleShare = () => {
        const url = `${window.location.origin}/album/${activeAlbum.id}`;
        if (navigator.share) {
            navigator.share({
                title: albumData ? albumData.title : 'Album - NanzMusify',
                url: url
            }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => showToast('Link album disalin!'));
        }
    };

    return (
        <div
            id="album-modal"
            className="fixed inset-0 bg-[#050507] flex flex-col z-[100] animate-slide-up-modal overflow-hidden text-white"
        >
            {/* Top Sticky Header */}
            <div className="flex items-center justify-between p-4 pt-safe bg-black/40 backdrop-blur-md absolute top-0 left-0 w-full z-[100]">
                <button
                    onClick={() => setActiveAlbum(null)}
                    className="glass glass-hover rounded-full text-white p-3 active:scale-90 shadow-md bg-black/80 cursor-pointer"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <button
                    onClick={handleShare}
                    className="glass glass-hover rounded-full text-white p-3 active:scale-90 shadow-md bg-black/80 cursor-pointer"
                    title="Bagikan Album"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-36 relative">
                {loading ? (
                    <div className="flex justify-center mt-32">
                        <div className="w-10 h-10 border-3 border-[#cfd3d8] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : !albumData ? (
                    <div className="p-6 text-center text-white/70 mt-20">Gagal memuat album</div>
                ) : (
                    <>
                        {/* Header Banner */}
                        <div className="relative w-full aspect-square md:aspect-video max-h-[50vh] overflow-hidden -mt-2 mb-6">
                            <img src={coverImg} className="w-full h-full object-cover" alt="" onError={handleImgError} />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/60 to-transparent"></div>

                            <div className="absolute bottom-6 left-6 right-6 flex flex-col justify-end items-center text-center z-10">
                                <img
                                    src={coverImg}
                                    className="w-32 h-32 md:w-48 md:h-48 rounded-xl object-cover border border-white/10 mb-4 shadow-2xl"
                                    alt=""
                                    onError={handleImgError}
                                />
                                <div>
                                    <p className="text-[10px] font-bold text-white uppercase tracking-[0.2em] mb-1">ALBUM / PLAYLIST</p>
                                    <h1 className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight line-clamp-2">
                                        {albumData.title}
                                    </h1>
                                    {albumData.description && (
                                        <p className="text-white text-xs md:text-sm line-clamp-2">{albumData.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Controls Bar */}
                        <div className="px-6">
                            <div className="flex items-center gap-4 mb-6">
                                <button
                                    onClick={() => handlePlayAll(0)}
                                    className="bg-white hover:bg-gray-200 text-black w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-white/20 cursor-pointer"
                                >
                                    <Play className="w-7 h-7 fill-current ml-1" />
                                </button>
                                <button
                                    onClick={handleShuffleAll}
                                    className="text-white/70 hover:text-white p-3 rounded-full active:scale-95 bg-white/5 transition-all cursor-pointer"
                                    title="Acak (Shuffle)"
                                >
                                    <Shuffle className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="text-white/70 hover:text-white p-3 rounded-full active:scale-95 bg-white/5 transition-all cursor-pointer"
                                    title="Bagikan"
                                >
                                    <Share2 className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Songs List */}
                            <div className="space-y-1 pb-10">
                                {songsList.map((s, idx) => {
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
                                                else handlePlayAll(idx);
                                            }}
                                            className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer group active:scale-[0.98] transition-all duration-300 shadow-lg ${rowBg}`}
                                        >
                                            <div className="w-6 text-center text-white/70 text-xs font-bold group-hover:text-white shrink-0">
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
                                            </div>

                                            <img
                                                src={s.cover}
                                                className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 border border-white/10"
                                                alt=""
                                                onError={handleImgError}
                                            />
                                            <div className="truncate flex-1 min-w-0">
                                                <p className={`text-sm truncate ${isCur ? 'text-white font-bold' : 'text-white/90 font-semibold'}`}>
                                                    {s.title}
                                                </p>
                                                <p className="text-white/60 text-xs truncate mt-0.5">{s.artist}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
