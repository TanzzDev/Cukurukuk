import React, { createContext, useContext, useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { toHDCover, getTrackColors } from '../utils/helpers';
import { extractClientSide } from '../utils/clientExtractor';
import { emit } from '../services/bus';
import { readStore, writeStore, useScope } from '../services/storage';
import { flushOutbox, recordListening } from '../services/listening';
import { PlaybackTracker, createListenLock } from '../services/tracker';
import { appendUnique, clearUpcoming, insertNext, moveItem, parseDurationText, removeAt, trackId } from '../../shared/queue';

const PlayerContext = createContext();
const ProgressContext = createContext(null);

// Waktu putar disimpan di store terpisah agar progress bar (4x/detik) tidak merender ulang seluruh aplikasi.
function createProgressStore() {
    let snap = { currentTime: 0, duration: 0 };
    const subs = new Set();
    return {
        get: () => snap,
        set(currentTime, duration) {
            if (snap.currentTime === currentTime && snap.duration === duration) return;
            snap = { currentTime, duration };
            subs.forEach((f) => f());
        },
        subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    };
}

export function useProgress() {
    const store = useContext(ProgressContext);
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}

const safeStorage = () => {
    try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem() {}, removeItem() {} }; }
};
const QUEUE_LIMIT = 300;
const queued = (t) => ({ ...t, _q: true }); // penanda: lagu yang ditambahkan pengguna ke antrean

export function PlayerProvider({ children }) {
    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const eqNodesRef = useRef({ bass: null, mid: null, treble: null });
    const gainNodeRef = useRef(null);
    const compressorNodeRef = useRef(null);
    const progressRef = useRef(null);
    if (!progressRef.current) progressRef.current = createProgressStore();
    const progress = progressRef.current;
    const pendingStart = useRef(0);
    const errorSkips = useRef(0);
    const hydrated = useRef(false);
    const S = useRef({});
    const tracker = useRef(null);
    const lockRef = useRef(null);
    if (!tracker.current) {
        const tabId = Math.random().toString(36).slice(2, 8);
        lockRef.current = createListenLock({ storage: safeStorage(), tabId });
        tracker.current = new PlaybackTracker({ tabId, ownsLock: () => lockRef.current.owns(), onFlush: (ev) => recordListening(ev) });
    }
    const sessionTrack = (t) => ({
        id: trackId(t), title: t.title || '', artist: t.artist || '', artistId: t.artistId || '',
        cover: t.thumbnail || t.cover || '', duration: parseDurationText(t.duration) || 0,
    });
    const scope = useScope();

    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [playlist, setPlaylist] = useState([]);
    const [playlistIndex, setPlaylistIndex] = useState(-1);
    const [playlistSource, setPlaylistSource] = useState('home');
    const [isQueueLocked, setQueueLocked] = useState(false);
    const [detour, setDetour] = useState(false); // memutar lagu di luar antrean saat antrean terkunci
    const [repeatMode, setRepeatMode] = useState('all'); // 'all', 'one', 'off'
    const [isShuffle, setIsShuffle] = useState(false);
    const [autoNext, setAutoNext] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [volume, setVolume] = useState(() => {
        try {
            const saved = localStorage.getItem('drowify_volume') ?? localStorage.getItem('nanz_volume');
            return saved !== null ? parseFloat(saved) : 1.0;
        } catch {
            return 1.0;
        }
    });
    const [preampBoost, setPreampBoost] = useState(() => {
        try {
            const saved = localStorage.getItem('drowify_preamp_boost') ?? localStorage.getItem('nanz_preamp_boost');
            return saved !== null ? parseFloat(saved) : 1.8;
        } catch {
            return 1.8;
        }
    });
    const [lastVolume, setLastVolume] = useState(1.0);
    const [lyrics, setLyrics] = useState({ type: 'none', lines: [] });
    const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
    const [lyricOffset, setLyricOffset] = useState(0);
    const [accentColors, setAccentColors] = useState(['#ffffff', '#a1a1aa', '#52525b']);
    const [bgGlowEnabled, setBgGlowEnabled] = useState(true);

    // Tampilan
    const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
    const [fullPlayerView, setFullPlayerView] = useState('cover'); // 'cover' or 'lyrics'
    const [isLyricsOverlayOpen, setIsLyricsOverlayOpen] = useState(false);
    const [activeArtist, setActiveArtist] = useState(null); // { id, name, cover }
    const [activeAlbum, setActiveAlbum] = useState(null);   // { id, cover }
    const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
    const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
    const [isSpeedOpen, setIsSpeedOpen] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
    const [isShareCardOpen, setIsShareCardOpen] = useState(false);
    const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
    const [addTarget, setAddTarget] = useState(null);      // lagu yang akan ditambahkan ke playlist (null = lagu aktif)
    const [mixSeed, setMixSeed] = useState(null);        // lagu acuan Mix Antrean
    const [detailTrack, setDetailTrack] = useState(null); // lembar "Lihat Detail Lagu"

    // EQ Preset State
    const [eqValues, setEqValues] = useState({ bass: 0, mid: 0, treble: 0, preset: 'Normal' });

    // Sleep Timer
    const [sleepSecondsLeft, setSleepSecondsLeft] = useState(0);
    const sleepIntervalRef = useRef(null);

    const showToast = (msg) => emit('toast', msg);

    // Theme state: 'dark' (default) or 'light'
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('drowify_theme') || localStorage.getItem('nanz_theme') || 'dark';
        } catch (e) {
            return 'dark';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('drowify_theme', theme);
        } catch (e) {}
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };


    // Load saved settings
    useEffect(() => {
        try {
            const savedRate = parseFloat(localStorage.getItem('drowify_playback_rate'));
            if (savedRate) setPlaybackRate(savedRate);
            const savedAuto = localStorage.getItem('drowify_auto_next');
            if (savedAuto !== null) setAutoNext(savedAuto === 'true');
            const savedGlow = localStorage.getItem('drowify_bg_glow_enabled');
            if (savedGlow !== null) setBgGlowEnabled(savedGlow === '1');
        } catch(e){}
    }, []);


    // Init Audio Context, Equalizer, Preamp Gain & Compressor
    const initAudioContext = () => {
        if (audioCtxRef.current) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext || !audioRef.current) return;
            const ctx = new AudioContext();
            audioCtxRef.current = ctx;

            // 1. Equalizer Filter Nodes
            const bass = ctx.createBiquadFilter();
            bass.type = 'lowshelf';
            bass.frequency.value = 150;
            bass.gain.value = eqValues.bass;

            const mid = ctx.createBiquadFilter();
            mid.type = 'peaking';
            mid.frequency.value = 1000;
            mid.gain.value = eqValues.mid;

            const treble = ctx.createBiquadFilter();
            treble.type = 'highshelf';
            treble.frequency.value = 3500;
            treble.gain.value = eqValues.treble;

            // 2. Master Gain Node (Preamp Volume Booster: default 1.8x boost)
            const masterGain = ctx.createGain();
            const initialGain = Math.max(0, volume * (preampBoost || 1.8));
            masterGain.gain.setValueAtTime(initialGain, ctx.currentTime);

            // 3. Dynamics Compressor (Peak Limiter & Loudness Maximizer)
            // Prevents any clipping/distortion when volume or bass is boosted high!
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-12, ctx.currentTime);
            compressor.knee.setValueAtTime(12, ctx.currentTime);
            compressor.ratio.setValueAtTime(4, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.25, ctx.currentTime);

            // 4. Connect Audio Pipeline:
            // source -> bass -> mid -> treble -> masterGain -> compressor -> ctx.destination
            const source = ctx.createMediaElementSource(audioRef.current);
            source.connect(bass);
            bass.connect(mid);
            mid.connect(treble);
            treble.connect(masterGain);
            masterGain.connect(compressor);
            compressor.connect(ctx.destination);

            sourceNodeRef.current = source;
            eqNodesRef.current = { bass, mid, treble };
            gainNodeRef.current = masterGain;
            compressorNodeRef.current = compressor;

            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
        } catch (e) {
            console.warn('Web Audio initialization failed:', e);
        }
    };

    // Set Preamp Boost level (1.0x to 2.5x)
    const setPreampBoostLevel = (boostFactor) => {
        const factor = Math.max(1.0, Math.min(3.0, boostFactor));
        setPreampBoost(factor);
        try {
            localStorage.setItem('drowify_preamp_boost', String(factor));
        } catch {}

        if (gainNodeRef.current && audioCtxRef.current) {
            const targetGain = Math.max(0, volume * factor);
            try {
                gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.05);
            } catch {
                gainNodeRef.current.gain.value = targetGain;
            }
        }
    };

    // Apply EQ values to nodes
    const applyEqualizer = (bass, mid, treble, preset = 'Custom') => {
        setEqValues({ bass, mid, treble, preset });
        if (eqNodesRef.current.bass) eqNodesRef.current.bass.gain.value = bass;
        if (eqNodesRef.current.mid) eqNodesRef.current.mid.gain.value = mid;
        if (eqNodesRef.current.treble) eqNodesRef.current.treble.gain.value = treble;
    };

    // Equalizer presets
    const setEqPreset = (name) => {
        switch(name) {
            case 'Bass Boost': applyEqualizer(6, 1, -1, 'Bass Boost'); break;
            case 'Treble': applyEqualizer(-1, 0, 6, 'Treble'); break;
            case 'Vocal': applyEqualizer(-2, 5, 2, 'Vocal'); break;
            case 'Electronic': applyEqualizer(5, 1, 4, 'Electronic'); break;
            case 'Rock': applyEqualizer(4, 2, 4, 'Rock'); break;
            case 'Pop': applyEqualizer(2, 3, 2, 'Pop'); break;
            default: applyEqualizer(0, 0, 0, 'Normal'); break;
        }
    };

    // Set Sleep Timer
    const setSleepTimer = (minutes) => {
        if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
        if (minutes <= 0) {
            setSleepSecondsLeft(0);
            showToast('Sleep Timer dimatikan');
            return;
        }
        const totalSec = minutes * 60;
        setSleepSecondsLeft(totalSec);
        showToast(`Sleep Timer disetel untuk ${minutes} menit`);

        sleepIntervalRef.current = setInterval(() => {
            setSleepSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(sleepIntervalRef.current);
                    if (audioRef.current) audioRef.current.pause();
                    setIsPlaying(false);
                    showToast('Waktu habis! Pemutaran musik dihentikan.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Playback Rate
    const changePlaybackRate = (rate) => {
        setPlaybackRate(rate);
        if (audioRef.current) audioRef.current.playbackRate = rate;
        try { localStorage.setItem('drowify_playback_rate', String(rate)); } catch(e){}
        showToast(`Kecepatan putar: ${rate}x`);
    };

    // Toggle Background Glow
    const toggleBgGlow = () => {
        const next = !bgGlowEnabled;
        setBgGlowEnabled(next);
        try { localStorage.setItem('drowify_bg_glow_enabled', next ? '1' : '0'); } catch(e){}
    };


    // Fetch and Load Track
    const loadTrack = async (track, opts = {}) => {
        if (!track) return;
        const vid = track.videoId || track.id;
        if (!vid) return;

        setIsLoading(true);
        progress.set(0, 0);
        pendingStart.current = opts.startAt || 0;
        errorSkips.current = opts.keepErrorCount ? errorSkips.current : 0;
        tracker.current.begin(sessionTrack(track));
        setCurrentLyricIndex(-1);

        // Compute accent colors
        const colors = getTrackColors(track);
        setAccentColors(colors);
        document.documentElement.style.setProperty('--glow-c1', colors[0]);
        document.documentElement.style.setProperty('--glow-c2', colors[1]);
        document.documentElement.style.setProperty('--glow-c3', colors[2]);

        // Fetch stream URL
        try {
            const ytUrl = track.ytUrl || `https://youtube.com/watch?v=${vid}`;
            let audioStreamUrl = '';
            let audioTitle = null;
            let audioThumbnail = null;

            // 1. First attempt: server endpoint /api/ytplay with 5s timeout
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch('/api/ytplay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: ytUrl }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = await res.json().catch(() => ({}));
                if (data && data.status && data.result?.download?.audio) {
                    audioStreamUrl = data.result.download.audio;
                    audioTitle = data.result.title;
                    audioThumbnail = data.result.thumbnail;
                } else if (data && data.url) {
                    audioStreamUrl = data.url;
                }
            } catch (serverErr) {
                console.warn('[Player] Server /api/ytplay error or timeout:', serverErr.message);
            }

            // 2. Client-side extraction fallback (CRITICAL for Netlify serverless Lambda 503)
            if (!audioStreamUrl) {
                console.log('[Player] Falling back to browser-side media extraction for:', vid);
                try {
                    const clientResult = await extractClientSide(vid, ytUrl);
                    if (clientResult && clientResult.audioUrl) {
                        audioStreamUrl = clientResult.audioUrl;
                        audioTitle = clientResult.title;
                        audioThumbnail = clientResult.thumbnail;
                        console.log('[Player] Browser-side extraction succeeded:', clientResult.title);
                    }
                } catch (clientErr) {
                    console.error('[Player] Browser-side extraction failed:', clientErr);
                }
            }

            // Update title and cover dynamically if placeholder was used
            let finalTitle = track.title;
            if (audioTitle) {
                finalTitle = audioTitle;
                setCurrentTrack(prev => {
                    if (!prev) return prev;
                    const isPlaceholder = !prev.title || prev.title === 'Memuat...' || prev.title === 'Lagu';
                    return {
                        ...prev,
                        title: isPlaceholder ? audioTitle : prev.title,
                        cover: prev.cover || audioThumbnail || toHDCover('', vid)
                    };
                });
            }

            if (audioStreamUrl && audioRef.current) {
                // If it's a direct CDN stream (vidssave / aliyuncs / OSS), play directly without crossorigin
                // to prevent browser CORS blocks on cross-origin redirects.
                const isDirectCdn = audioStreamUrl.includes('vidssave.com') || audioStreamUrl.includes('aliyuncs.com');
                const playUrl = isDirectCdn ? audioStreamUrl : `/api/proxy-audio?url=${encodeURIComponent(audioStreamUrl)}`;

                let hasFallenBack = false;
                audioRef.current.onerror = () => {
                    if (!hasFallenBack && audioStreamUrl) {
                        hasFallenBack = true;
                        console.warn('[Player] PlayUrl error, attempting direct stream playback fallback...');
                        try {
                            audioRef.current.removeAttribute('crossorigin');
                        } catch (e) {}
                        audioRef.current.src = audioStreamUrl;
                        audioRef.current.play().then(() => {
                            setIsPlaying(true);
                            setIsLoading(false);
                        }).catch(() => {
                            setIsLoading(false);
                        });
                    } else {
                        setIsLoading(false);
                    }
                };

                try {
                    if (isDirectCdn) {
                        audioRef.current.removeAttribute('crossorigin');
                    } else {
                        audioRef.current.setAttribute('crossorigin', 'anonymous');
                        initAudioContext();
                        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                            audioCtxRef.current.resume().catch(() => {});
                        }
                    }
                } catch(e) {}

                audioRef.current.src = playUrl;
                audioRef.current.playbackRate = playbackRate;
                audioRef.current.volume = Math.min(1.0, volume);
                audioRef.current.play().then(() => {
                    setIsPlaying(true);
                    setIsLoading(false);
                }).catch(err => {
                    // Autoplay was blocked by browser policy (e.g. direct link navigation)
                    console.warn('Autoplay waiting for user interaction:', err.message);
                    setIsLoading(false);
                    setIsPlaying(false);

                    // Allow first touch/click anywhere on page to trigger playback
                    const onFirstUserGesture = () => {
                        if (audioRef.current && audioRef.current.paused) {
                            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                                audioCtxRef.current.resume();
                            }
                            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                        }
                    };
                    window.addEventListener('click', onFirstUserGesture, { once: true });
                    window.addEventListener('touchstart', onFirstUserGesture, { once: true });
                });
            } else {
                showToast('Gagal memuat audio stream');
                setIsLoading(false);
            }
        } catch (e) {
            console.error('Error loading audio:', e);
            showToast('Koneksi bermasalah saat memutar');
            setIsLoading(false);
        }

        // Fetch Lyrics
        fetchLyrics(vid, track.title, track.artist);

        // Update Media Session
        if ('mediaSession' in navigator) {
            const cover = toHDCover(track.cover, vid);
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title || 'Drowify Music',
                artist: track.artist || '',
                album: 'Drowify Music',
                artwork: [
                    { src: cover, sizes: '96x96', type: 'image/webp' },
                    { src: cover, sizes: '256x256', type: 'image/webp' },
                    { src: cover, sizes: '512x512', type: 'image/webp' }
                ]
            });
        }
    };


    // Fetch Lyrics
    const fetchLyrics = async (vid, title, artist) => {
        setLyrics({ type: 'loading', lines: [] });
        try {
            const tParam = title ? `&title=${encodeURIComponent(title)}` : '';
            const aParam = artist ? `&artist=${encodeURIComponent(artist)}` : '';
            const res = await fetch(`/api/lyrics?id=${vid}${tParam}${aParam}`);
            const data = await res.json();
            if (data.status && data.result && data.result.lyrics) {
                setLyrics(data.result.lyrics);
            } else {
                setLyrics({ type: 'none', lines: [] });
            }
        } catch(e) {
            setLyrics({ type: 'none', lines: [] });
        }
    };

    // Volume (Supports up to 150% with preamp gain boost)
    const setVolumeLevel = (val) => {
        const v = Math.max(0, Math.min(1.5, val / 100));
        setVolume(v);
        if (v > 0) setLastVolume(v);

        if (audioRef.current) {
            audioRef.current.volume = Math.min(1.0, v);
        }

        if (gainNodeRef.current && audioCtxRef.current) {
            const targetGain = Math.max(0, v * (preampBoost || 1.8));
            try {
                gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.05);
            } catch {
                gainNodeRef.current.gain.value = targetGain;
            }
        }

        try {
            localStorage.setItem('drowify_volume', String(v));
        } catch {}
    };

    const toggleMute = () => {
        if (volume > 0) {
            setLastVolume(volume);
            setVolumeLevel(0);
        } else {
            setVolumeLevel((lastVolume || 1) * 100);
        }
    };

    // Repeat mode toggle: all -> one -> off -> all
    const toggleRepeat = () => {
        if (repeatMode === 'all') setRepeatMode('one');
        else if (repeatMode === 'one') setRepeatMode('off');
        else setRepeatMode('all');
    };

    // Shuffle toggle
    const toggleShuffle = () => {
        setIsShuffle(prev => !prev);
    };

    // Lyric sync offset
    const lyricSyncPrev = () => setLyricOffset(prev => prev - 0.5);
    const lyricSyncNext = () => setLyricOffset(prev => prev + 0.5);


    // ───────── Antrean: SATU sumber data (playlist + playlistIndex), dipakai Mini/Full player, Cari, Beranda, Pustaka ─────────
    const commit = (list, index) => {
        setPlaylist(list);
        setPlaylistIndex(index);
    };
    const upcomingPool = () => (playlistIndex >= 0 ? playlist.slice(playlistIndex) : playlist);
    const isInQueue = (track) => upcomingPool().some((t) => trackId(t) === trackId(track));

    const queueInfo = (() => {
        const pool = upcomingPool();
        let total = 0;
        let known = 0;
        for (const t of pool) {
            const s = parseDurationText(t.duration);
            if (s != null) { total += s; known += 1; }
        }
        return {
            count: pool.length,
            upcomingCount: Math.max(0, playlist.length - playlistIndex - 1),
            playedCount: Math.max(0, playlistIndex),
            durationSec: total,
            exact: known === pool.length,
        };
    })();

    // Jika belum ada lagu aktif, siapkan lagu pertama antrean (dijeda; audio baru dimuat saat Play ditekan).
    const primeIfIdle = (list, index) => {
        if (currentTrack || !list.length) return;
        const idx = index >= 0 ? index : 0;
        setPlaylistIndex(idx);
        setCurrentTrack(list[idx]);
        pendingStart.current = 0;
    };

    const addToQueue = (input, { silent = false } = {}) => {
        const items = (Array.isArray(input) ? input : [input]).filter(Boolean).map(queued);
        if (!items.length) return { added: 0 };
        if (isQueueLocked) {
            if (!silent) showToast('Antrean dikunci. Buka kunci untuk menambah lagu.');
            return { added: 0, blocked: true };
        }
        const r = appendUnique(playlist, playlistIndex, items);
        if (!r.added) {
            if (!silent) showToast('Sudah di Antrean');
            return { added: 0, exists: true };
        }
        commit(r.list, r.index);
        primeIfIdle(r.list, r.index);
        if (!silent) showToast(r.added === 1 ? 'Ditambahkan ke antrean' : `${r.added} lagu ditambahkan ke antrean`);
        return { added: r.added };
    };

    const playNextInQueue = (input, { silent = false } = {}) => {
        const items = (Array.isArray(input) ? input : [input]).filter(Boolean).map(queued);
        if (!items.length) return { added: 0 };
        if (isQueueLocked) {
            if (!silent) showToast('Antrean dikunci. Buka kunci untuk menambah lagu.');
            return { added: 0, blocked: true };
        }
        const r = insertNext(playlist, playlistIndex, items);
        commit(r.list, r.index);
        primeIfIdle(r.list, r.index);
        if (!silent) showToast('Akan diputar berikutnya');
        return { added: r.added };
    };

    const removeFromQueue = (index) => {
        const r = removeAt(playlist, playlistIndex, index);
        if (r.list === playlist) return false;
        commit(r.list, r.index);
        showToast('Dihapus dari antrean');
        return true;
    };

    const moveQueueItem = (from, to) => {
        const r = moveItem(playlist, playlistIndex, from, to);
        if (r.list !== playlist) commit(r.list, r.index);
    };

    // Hapus seluruh lagu yang MENUNGGU. Lagu yang sedang diputar tidak berhenti; playlist & pustaka tidak tersentuh.
    const clearQueue = () => {
        const r = clearUpcoming(playlist, playlistIndex);
        commit(r.list, r.index);
        showToast('Antrean dibersihkan');
    };

    const goTo = (idx, list = playlist) => {
        const t = list[idx];
        if (!t) return;
        setPlaylist(list);
        setPlaylistIndex(idx);
        setCurrentTrack(t);
        setDetour(false);
        loadTrack(t);
    };

    const playFromQueue = (index) => goTo(index);

    const toggleQueueLock = () => {
        setQueueLocked((v) => {
            showToast(v ? 'Antrean dibuka' : 'Antrean dikunci');
            return !v;
        });
    };

    // Putar lagu: ganti konteks pemutaran, tetapi lagu yang sudah ditambahkan pengguna ke antrean tetap dipertahankan.
    const playTrack = (track, list = null, index = -1, source = 'direct') => {
        const id = trackId(track);
        if (isQueueLocked && playlist.length) {
            const at = playlist.findIndex((t, i) => i >= Math.max(0, playlistIndex) && trackId(t) === id);
            if (at !== -1) { goTo(at); return; }
            setDetour(true);
            setCurrentTrack(track);
            loadTrack(track);
            showToast('Antrean dikunci: lagu diputar tanpa mengubah antrean');
            return;
        }
        let newList;
        let newIndex;
        if (list && list.length > 0) {
            newList = list;
            newIndex = index !== -1 ? index : Math.max(0, list.findIndex((s) => trackId(s) === id));
        } else {
            newList = [track];
            newIndex = 0;
        }
        const kept = playlist.slice(playlistIndex + 1).filter((t) => t._q && !newList.slice(0, newIndex + 1).some((x) => trackId(x) === trackId(t)));
        if (kept.length) {
            const keptIds = new Set(kept.map(trackId));
            newList = [...newList.slice(0, newIndex + 1), ...kept, ...newList.slice(newIndex + 1).filter((t) => !keptIds.has(trackId(t)))];
        }
        setPlaylist(newList);
        setPlaylistIndex(newIndex);
        setPlaylistSource(source);
        setDetour(false);
        setIsLoading(true);
        setCurrentTrack(track);
        loadTrack(track);
    };

    const playNow = (track) => playTrack(track, null, -1, 'direct');

    // Putar acak: aktifkan mode acak lalu mulai dari lagu acak dalam daftar (tidak mengubah urutan antrean yang dibuat pengguna)
    const playShuffled = (list, source = 'direct') => {
        if (!list || !list.length) return;
        setIsShuffle(true);
        const i = Math.floor(Math.random() * list.length);
        playTrack(list[i], list, i, source);
    };

    // Toggle Play / Pause
    const togglePlay = () => {
        const au = audioRef.current;
        if (!au) return;
        if (!currentTrack) {
            if (playlist.length) { goTo(playlistIndex >= 0 ? playlistIndex : 0); return; }
            showToast('Pilih lagu terlebih dahulu');
            return;
        }
        if (!au.getAttribute('src')) { // lagu hasil pemulihan antrean: muat audio saat pertama kali diputar
            loadTrack(currentTrack, { startAt: pendingStart.current });
            return;
        }
        if (au.paused) {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            au.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
            au.pause();
            setIsPlaying(false);
        }
    };

    // Next Track: lagu teratas yang menunggu menjadi lagu aktif; lagu yang selesai tidak muncul lagi sebagai menunggu.
    const nextTrack = () => {
        if (!playlist.length) return;
        if (detour) { // selingan selesai: lanjutkan antrean setelah lagu yang terputus
            const idx = playlistIndex + 1;
            if (idx < playlist.length) goTo(idx);
            else if (repeatMode === 'all') goTo(0);
            else { setDetour(false); setIsPlaying(false); }
            return;
        }
        let nextIdx = playlistIndex + 1;
        let list = playlist;
        if (nextIdx >= playlist.length) {
            if (repeatMode === 'all') nextIdx = 0;
            else return;
        } else if (isShuffle && playlist.length - nextIdx > 1) {
            const j = nextIdx + Math.floor(Math.random() * (playlist.length - nextIdx));
            list = moveItem(playlist, playlistIndex, j, nextIdx).list; // urutan antrean mencerminkan lagu yang benar-benar berikutnya
        }
        goTo(nextIdx, list);
    };

    // Previous Track
    const prevTrack = (forcePrev = false) => {
        const au = audioRef.current;
        if (au && au.currentTime > 3 && !forcePrev) {
            au.currentTime = 0;
            return;
        }
        if (!playlist.length) return;
        if (detour) { goTo(Math.max(0, playlistIndex)); return; }
        let prevIdx = playlistIndex - 1;
        if (prevIdx < 0) {
            if (repeatMode !== 'all') { if (au) au.currentTime = 0; return; }
            prevIdx = playlist.length - 1;
        }
        goTo(prevIdx);
    };

    // Seek
    const seek = (time) => {
        if (audioRef.current && isFinite(time)) {
            audioRef.current.currentTime = time;
            progress.set(time, progress.get().duration);
        }
    };

    const stopAudio = () => {
        const au = audioRef.current;
        if (au) { try { au.pause(); au.removeAttribute('src'); au.load(); } catch (e) { /* abaikan */ } }
        tracker.current.begin(null);
        progress.set(0, 0);
        setIsPlaying(false);
        setIsLoading(false);
        setLyrics({ type: 'none', lines: [] });
        setCurrentLyricIndex(-1);
    };

    const openAddToPlaylist = (track) => { setAddTarget(track || null); setIsAddToPlaylistOpen(true); };
    const openMix = (track) => { setMixSeed(track || currentTrack || null); };
    const closeMix = () => setMixSeed(null);

    // ───────── Pemulihan & penyimpanan antrean per-cakupan (tamu / akun) ─────────
    useEffect(() => {
        stopAudio();
        setDetour(false);
        const q = readStore('queue', null);
        const pos = readStore('queue_pos', null);
        if (q && Array.isArray(q.list) && q.list.length) {
            const idx = Number.isInteger(q.index) ? Math.min(q.index, q.list.length - 1) : -1;
            setPlaylist(q.list);
            setPlaylistIndex(idx);
            setQueueLocked(!!q.locked);
            const t = idx >= 0 ? q.list[idx] : null;
            setCurrentTrack(t);
            pendingStart.current = t && pos && pos.id === trackId(t) ? pos.pos || 0 : 0;
        } else {
            setPlaylist([]);
            setPlaylistIndex(-1);
            setQueueLocked(false);
            setCurrentTrack(null);
        }
        hydrated.current = true;
    }, [scope]);

    useEffect(() => {
        if (!hydrated.current) return undefined;
        const id = setTimeout(() => {
            const cut = Math.max(0, playlist.length - QUEUE_LIMIT);
            writeStore('queue', { v: 1, list: playlist.slice(cut), index: playlistIndex >= cut ? playlistIndex - cut : -1, locked: isQueueLocked });
        }, 400);
        return () => clearTimeout(id);
    }, [playlist, playlistIndex, isQueueLocked, scope]);

    // Audio element event listeners (dipasang sekali; membaca keadaan terbaru lewat S.current)
    useEffect(() => {
        const au = audioRef.current;
        if (!au) return undefined;
        let lastPosSave = 0;
        const T = () => tracker.current;

        const handleTimeUpdate = () => {
            const cur = au.currentTime || 0;
            const dur = Number.isFinite(au.duration) ? au.duration : 0;
            progress.set(cur, dur);
            T().tick({ currentTime: cur, paused: au.paused, seeking: au.seeking, ready: au.readyState >= 3, rate: au.playbackRate || 1 });

            const { lyrics: ly, lyricOffset: off, currentTrack: ct } = S.current;
            if (ly && ly.lines && ly.lines.length > 0) {
                const effectiveTime = cur + off;
                let activeIndex = -1;
                for (let i = 0; i < ly.lines.length; i++) {
                    if (ly.lines[i].time <= effectiveTime) activeIndex = i;
                    else break;
                }
                setCurrentLyricIndex(activeIndex);
            }
            const now = Date.now();
            if (ct && !au.paused && now - lastPosSave > 5000) {
                lastPosSave = now;
                writeStore('queue_pos', { id: trackId(ct), pos: cur });
            }
        };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => { setIsPlaying(false); T().interrupt(); };
        const handleLoadStart = () => setIsLoading(true);
        const handleWaiting = () => { setIsLoading(true); T().interrupt(); };
        const handleSeeking = () => { setIsLoading(true); T().interrupt(); };
        const handleSeeked = () => setIsLoading(false);
        const handleCanPlay = () => setIsLoading(false);
        const handlePlaying = () => {
            setIsLoading(false);
            setIsPlaying(true);
            errorSkips.current = 0;
        };
        const handleLoadedMeta = () => {
            const d = au.duration;
            if (Number.isFinite(d)) {
                if (T().track) T().track = { ...T().track, duration: d };
                progress.set(au.currentTime || 0, d);
                if (pendingStart.current > 0 && pendingStart.current < d - 2) au.currentTime = pendingStart.current;
            }
            pendingStart.current = 0;
        };
        const handleError = () => {
            setIsLoading(false);
            setIsPlaying(false);
            T().interrupt();
            if (!au.getAttribute('src')) return;
            const s = S.current;
            if (s.autoNext && errorSkips.current < 3 && s.playlistIndex + 1 < s.playlist.length) {
                errorSkips.current += 1;
                s.showToast('Lagu tidak dapat diputar. Melewati ke lagu berikutnya…');
                setTimeout(() => S.current.nextTrack(), 900);
            } else {
                s.showToast('Lagu tidak dapat diputar. Coba lagi nanti.');
            }
        };
        const handleEnded = () => {
            T().interrupt();
            const { repeatMode: rm, autoNext: an, currentTrack: ct } = S.current;
            if (rm === 'one') {
                T().begin(ct ? sessionTrack(ct) : null); // ulang = pemutaran baru
                au.currentTime = 0;
                au.play().catch(() => {});
            } else if (an) {
                S.current.nextTrack();
            } else {
                setIsPlaying(false);
            }
        };

        const events = { timeupdate: handleTimeUpdate, play: handlePlay, pause: handlePause, loadstart: handleLoadStart, waiting: handleWaiting, seeking: handleSeeking, seeked: handleSeeked, canplay: handleCanPlay, playing: handlePlaying, loadedmetadata: handleLoadedMeta, error: handleError, ended: handleEnded };
        Object.entries(events).forEach(([k, fn]) => au.addEventListener(k, fn));
        return () => Object.entries(events).forEach(([k, fn]) => au.removeEventListener(k, fn));
    }, []);

    // Setor sisa waktu dengar saat tab disembunyikan / ditutup (tidak menghitung apa pun yang belum benar-benar diputar)
    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === 'hidden') { tracker.current.flush(); flushOutbox({ beacon: true }); }
        };
        const onPageHide = () => { tracker.current.flush(); lockRef.current.release(); flushOutbox({ beacon: true }); };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onPageHide);
            tracker.current.flush();
        };
    }, []);

    // MediaSession action handlers
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        try {
            const call = (fn) => (...a) => S.current[fn](...a);
            navigator.mediaSession.setActionHandler('play', call('togglePlay'));
            navigator.mediaSession.setActionHandler('pause', call('togglePlay'));
            navigator.mediaSession.setActionHandler('previoustrack', () => S.current.prevTrack(true));
            navigator.mediaSession.setActionHandler('nexttrack', call('nextTrack'));
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) S.current.seek(details.seekTime);
            });
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (e) { /* tidak didukung */ }
    }, [isPlaying, currentTrack]);

    S.current = { playlist, playlistIndex, isShuffle, repeatMode, autoNext, detour, lyrics, lyricOffset, currentTrack, nextTrack, prevTrack, togglePlay, seek, showToast };

    const value = {
        audioRef, currentTrack, isPlaying, isLoading, playlist, playlistIndex, playlistSource,
        repeatMode, isShuffle, autoNext, playbackRate, volume, preampBoost, lastVolume,
        lyrics, currentLyricIndex, lyricOffset, accentColors, bgGlowEnabled,
        isFullPlayerOpen, fullPlayerView, isLyricsOverlayOpen, activeArtist, activeAlbum,
        isEqualizerOpen, isSleepTimerOpen, isSpeedOpen, isQueueOpen, isAddToPlaylistOpen,
        isShareCardOpen, isCreatePlaylistOpen, eqValues, sleepSecondsLeft, mixSeed, detailTrack,
        // antrean
        isQueueLocked, detour, queueInfo, isInQueue, addToQueue, playNextInQueue, removeFromQueue,
        moveQueueItem, clearQueue, playFromQueue, toggleQueueLock, openMix, closeMix, setDetailTrack, addTarget, openAddToPlaylist,
        // aksi pemutar
        playTrack, playNow, playShuffled, togglePlay, nextTrack, prevTrack, seek, setVolumeLevel, toggleMute,
        toggleRepeat, toggleShuffle,
        setAutoNext: (val) => {
            setAutoNext(val);
            try { localStorage.setItem('drowify_auto_next', String(val)); } catch (e) { /* abaikan */ }
        },
        changePlaybackRate, toggleBgGlow, lyricSyncPrev, lyricSyncNext, showToast,
        setIsFullPlayerOpen, setFullPlayerView, setIsLyricsOverlayOpen, setActiveArtist, setActiveAlbum,
        setIsEqualizerOpen, setIsSleepTimerOpen, setIsSpeedOpen, setIsQueueOpen, setIsAddToPlaylistOpen,
        setIsShareCardOpen, setIsCreatePlaylistOpen, setEqPreset, applyEqualizer, setSleepTimer,
        setPreampBoostLevel, theme, setTheme, toggleTheme,
    };

    return (
        <ProgressContext.Provider value={progress}>
            <PlayerContext.Provider value={value}>
                <audio ref={audioRef} preload="auto" crossOrigin="anonymous" style={{ display: 'none' }} />
                {children}
            </PlayerContext.Provider>
        </ProgressContext.Provider>
    );
}

export function usePlayer() {
    return useContext(PlayerContext);
}
