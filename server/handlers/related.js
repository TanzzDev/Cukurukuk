'use strict';
// GET /api/related?videoId=…&title=…&artist=…&artistId=…&limit=24
// Rekomendasi lagu yang COCOK dengan lagu tertentu (dipakai "Mix Antrean" & "Konten Serupa").
// Sumber: radio YouTube Music (youtubei/v1/next) + lagu dari artis yang sama (handler search yang ada).
const axios = require('axios');
const { load } = require('../lib/shared');

const TTL = 10 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map();
const CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20240101.00.00', hl: 'id', gl: 'ID' };

async function fetchRadio(videoId) {
    const { data } = await axios.post('https://music.youtube.com/youtubei/v1/next?prettyPrint=false', {
        context: { client: CLIENT },
        videoId,
        playlistId: `RDAMVM${videoId}`,
        params: 'wAEB',
        enablePersistentPlaylistPanel: true,
        isAudioOnly: true,
        tunerSettingValue: 'AUTOMIX_SETTING_NORMAL'
    }, {
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Origin: 'https://music.youtube.com' },
        timeout: 12000
    });
    return data;
}

// Memakai handler search yang sudah ada (tanpa menggandakan parser hasil lagu)
function searchSongs(query) {
    const handler = require('./search.js');
    return new Promise((resolve, reject) => {
        const res = { status() { return this; }, json: (o) => resolve(o), send: () => resolve(null) };
        Promise.resolve(handler({ method: 'GET', query: { query, type: 'songs' } }, res)).catch(reject);
    });
}

const cap = (v, n) => String(v || '').slice(0, n);

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(200).send('OK');
    const videoId = String(req.query.videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ status: false, message: 'Parameter videoId tidak valid' });
    }
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const key = `${videoId}:${limit}`;
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) {
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
        return res.json(hit.value);
    }

    const { parseWatchNext, rankRelated } = await load('related');
    let seed = { videoId, title: cap(req.query.title, 160), artist: cap(req.query.artist, 120), artistId: cap(req.query.artistId, 40) };
    let radio = [];
    let artistSongs = [];
    const failed = [];

    try {
        const parsed = parseWatchNext(await fetchRadio(videoId), { limit: 60 });
        const self = parsed.find((p) => p.videoId === videoId);
        if (self) {
            seed = { ...seed, ...Object.fromEntries(Object.entries(self).filter(([, v]) => v && (!Array.isArray(v) || v.length))) };
        }
        radio = parsed.filter((p) => p.videoId !== videoId);
    } catch (e) {
        failed.push('radio');
    }

    const artistName = (seed.artists && seed.artists[0]) || seed.artist;
    if (artistName) {
        try {
            const r = await searchSongs(artistName);
            artistSongs = (r && r.result && r.result.songs ? r.result.songs : []).slice(0, 15);
        } catch (e) {
            failed.push('artist');
        }
    }

    if (!radio.length && !artistSongs.length && failed.length) {
        return res.status(502).json({ status: false, message: 'Sumber rekomendasi tidak dapat dihubungi.' });
    }

    const items = rankRelated(seed, { radio, artist: artistSongs }, { limit });
    const value = {
        status: true,
        seed: { videoId, title: seed.title, artist: seed.artist, album: seed.album || '' },
        items,
        sources: { radio: radio.length, artist: artistSongs.length },
        partial: failed.length > 0
    };
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { exp: Date.now() + TTL, value });
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.json(value);
};
