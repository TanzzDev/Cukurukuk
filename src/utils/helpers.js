export const FI = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2523374151%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20width%3D%22100%2525%22%20height%3D%22100%2525%22%20fill%3D%22%252318181b%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20fill%3D%22%252327272a%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M9%2017V5l10-2v12%22%20stroke%3D%22%252352525b%22%20stroke-width%3D%221%22%2F%3E%3Ccircle%20cx%3D%226%22%20cy%3D%2217%22%20r%3D%223%22%20fill%3D%22%252352525b%22%20stroke%3D%22none%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2215%22%20r%3D%223%22%20fill%3D%22%252352525b%22%20stroke%3D%22none%22%2F%3E%3C%2Fsvg%3E';

export function toWebp(url) {
    if (!url) return FI;
    let u = String(url);
    if (u.includes('i.ytimg.com/vi/') || u.includes('img.youtube.com/vi/')) {
        u = u.replace('i.ytimg.com/vi/', 'i.ytimg.com/vi_webp/')
             .replace('img.youtube.com/vi/', 'i.ytimg.com/vi_webp/')
             .replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, '$1.webp');
    } else if (u.includes('i.ytimg.com/vi_webp/')) {
        u = u.replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, '$1.webp');
    }
    if ((u.includes('googleusercontent.com') || u.includes('ggpht.com') || u.includes('yt3.ggpht.com')) && !u.includes('-rw')) {
        if (/=[a-zA-Z0-9\-_]+$/i.test(u)) {
            u = u + '-rw';
        }
    }
    return u;
}

export function toThumbCover(url, videoId) {
    if (!url && videoId) return 'https://i.ytimg.com/vi_webp/' + videoId + '/mqdefault.webp';
    if (!url) return FI;
    let u = String(url);
    if (u.includes('googleusercontent.com') || u.includes('ggpht.com') || u.includes('ytimg.com')) {
        if (/=w\d+-h\d+/i.test(u)) {
            u = u.replace(/=w\d+-h\d+[^?#]*/i, '=w260-h260-l90-rj-rw');
        } else if (/=s\d+/i.test(u)) {
            u = u.replace(/=s\d+[^?#]*/i, '=s260-c-k-c0x00ffffff-no-rj-rw');
        } else if (/=w\d+/i.test(u)) {
            u = u.replace(/=w\d+[^?#]*/i, '=w260-h260-l90-rj-rw');
        } else if (/=[a-zA-Z0-9\-_]+$/i.test(u) && !u.includes('-rw')) {
            u = u + '-rw';
        }
    }
    if (u.includes('i.ytimg.com/vi/') || u.includes('img.youtube.com/vi/')) {
        u = u.replace('i.ytimg.com/vi/', 'i.ytimg.com/vi_webp/')
             .replace('img.youtube.com/vi/', 'i.ytimg.com/vi_webp/')
             .replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, 'mqdefault.webp');
    } else if (u.includes('i.ytimg.com/vi_webp/')) {
        u = u.replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, 'mqdefault.webp');
    }
    return u;
}

export function toHDCover(url, videoId) {
    if (!url && videoId) return 'https://i.ytimg.com/vi_webp/' + videoId + '/hqdefault.webp';
    if (!url) return FI;
    let hd = String(url);
    if (hd.includes('googleusercontent.com') || hd.includes('ggpht.com') || hd.includes('ytimg.com')) {
        if (/=w\d+-h\d+/i.test(hd)) {
            hd = hd.replace(/=w\d+-h\d+[^?#]*/i, '=w800-h800-l90-rj-rw');
        } else if (/=s\d+/i.test(hd)) {
            hd = hd.replace(/=s\d+[^?#]*/i, '=s800-c-k-c0x00ffffff-no-rj-rw');
        } else if (/=w\d+/i.test(hd)) {
            hd = hd.replace(/=w\d+[^?#]*/i, '=w800-h800-l90-rj-rw');
        } else if (/=[a-zA-Z0-9\-_]+$/i.test(hd) && !hd.includes('-rw')) {
            hd = hd + '-rw';
        }
    }
    if (hd.includes('i.ytimg.com/vi/') || hd.includes('img.youtube.com/vi/')) {
        hd = hd.replace('i.ytimg.com/vi/', 'i.ytimg.com/vi_webp/')
               .replace('img.youtube.com/vi/', 'i.ytimg.com/vi_webp/')
               .replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, 'hqdefault.webp');
    } else if (hd.includes('i.ytimg.com/vi_webp/')) {
        hd = hd.replace(/(hqdefault|mqdefault|sddefault|default|maxresdefault)\.(jpg|jpeg|png)/i, 'hqdefault.webp');
    }
    return hd;
}

export function handleImgError(e) {
    const img = e.currentTarget || e.target;
    if (!img) return;
    const retries = parseInt(img.getAttribute('data-img-retry') || '0', 10);
    if (retries >= 3) {
        img.src = FI;
        return;
    }
    img.setAttribute('data-img-retry', String(retries + 1));
    const src = img.src || '';
    if (src.includes('/vi_webp/')) {
        img.src = src.replace('/vi_webp/', '/vi/').replace(/\.webp$/i, '.jpg');
    } else if (src.includes('hqdefault.jpg')) {
        img.src = src.replace('hqdefault.jpg', 'mqdefault.jpg');
    } else if (src.includes('-rw')) {
        img.src = src.replace('-rw', '');
    } else {
        img.src = FI;
    }
}

export function fm(s) {
    if (isNaN(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const se = Math.floor(s % 60);
    return m + ':' + (se < 10 ? '0' : '') + se;
}

export function cn(t) {
    if (!t) return 'Unknown';
    return t.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g, '').replace(/\s*-\s*Topic$/i, '').trim() || 'Unknown';
}

// Pustaka pengguna kini dikelola layanan reaktif (src/services/library.js) agar semua halaman selalu sinkron.
export {
    getLikedSongs, isLikedSong, toggleLikeSong,
    getUserPlaylists, createPlaylist, updateUserPlaylist, deleteUserPlaylist,
    addSongToPlaylist, removeSongFromPlaylist, getLikedArtists, isArtistLiked, toggleLikeArtist,
} from '../services/library.js';

export function getTrackColors(track) {
    if (!track) return ['#ff2a5f', '#7c3aed', '#2563eb', '#059669', '#d97706'];
    const str = (track.videoId || '') + (track.title || '') + (track.artist || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    hash = Math.abs(hash);
    const baseHue = hash % 360;
    return [
        'hsl(' + baseHue + ', 88%, 50%)',
        'hsl(' + ((baseHue + 55) % 360) + ', 92%, 55%)',
        'hsl(' + ((baseHue + 140) % 360) + ', 82%, 46%)',
        'hsl(' + ((baseHue + 215) % 360) + ', 86%, 49%)',
        'hsl(' + ((baseHue + 295) % 360) + ', 84%, 48%)'
    ];
}
