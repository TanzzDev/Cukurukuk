'use strict';
// Drowify Music — server Express tunggal.
//  • Lokal / VPS : `node server.cjs` (menyajikan dist/ + API)
//  • Vercel      : api/index.js mengekspor app ini sebagai SATU serverless function
const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const compression = require('compression');
const { assertSafeUrl, safeLookup } = require('./server/lib/safeFetch');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        if (req.path.startsWith('/api/proxy-audio')) return false;
        if (/\.(mp4|mov|webm)$/i.test(req.path)) return false;
        return compression.filter(req, res);
    }
}));

// Parser body lama hanya untuk endpoint musik lama. Rute akun (/api/auth, /api/me) memasang parser sendiri.
const legacyJson = express.json({ limit: '1mb' });

const CSP = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
].join('; ');

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // dibutuhkan popup Google Sign-In
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!req.path.startsWith('/api/')) res.setHeader('Content-Security-Policy', CSP);
    next();
});

// Origin yang cocok dengan host saat ini (perilaku asli untuk endpoint musik publik)
function getAllowedOrigin(req) {
    const origin = req.headers.origin || req.headers.referer;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (origin) {
        try { return new URL(origin).origin; } catch (e) { return null; }
    }
    if (host) {
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        return `${proto}://${host}`;
    }
    return '*';
}

const CREDENTIALED = /^\/api\/(auth|me)(\/|$)/;
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let sameOrigin = false;
    try { sameOrigin = !!origin && new URL(origin).host === host; } catch (e) { /* abaikan */ }
    if (CREDENTIALED.test(req.path)) {
        // Endpoint akun: HANYA same-origin yang boleh membawa cookie.
        if (sameOrigin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
    } else {
        res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req) || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── API baru: config, health, auth, me, avatar, spotify (semua di bawah satu router) ──
app.use('/api', require('./server/routes'));

// ── API musik (dipertahankan dari source original) ──
app.all('/api/home', legacyJson, require('./server/handlers/home.js'));
app.all('/api/search', legacyJson, require('./server/handlers/search.js'));
app.all('/api/related', require('./server/handlers/related.js'));
app.all('/api/lyrics', legacyJson, require('./server/handlers/lyrics.js'));
app.all('/api/lyrics1', legacyJson, require('./server/handlers/lyrics1.js'));
app.all('/api/lyrics2', legacyJson, require('./server/handlers/lyrics2.js'));
app.all('/api/artist', legacyJson, require('./server/handlers/artist.js'));
app.all('/api/album', legacyJson, require('./server/handlers/album.js'));
app.all('/api/suggest', legacyJson, require('./server/handlers/suggest.js'));
app.all('/api/ytplay', legacyJson, require('./server/handlers/ytplay.js'));
app.all('/api/translate', legacyJson, require('./server/handlers/translate.js'));
app.all('/api/transcribe', legacyJson, require('./server/handlers/transcribe.js'));

// Konfigurasi developer/aplikasi
app.get('/profile.json', (req, res) => {
    const pubFile = path.join(__dirname, 'public', 'profile.json');
    const distFile = path.join(__dirname, 'dist', 'profile.json');
    const target = fs.existsSync(pubFile) ? pubFile : distFile;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (fs.existsSync(target)) res.sendFile(target);
    else res.status(404).json({ error: 'profile.json not found' });
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36';

// Proxy audio (dukung Range). SSRF dicegah: host privat/internal ditolak, termasuk hasil DNS & redirect.
function streamAudioProxy(currentUrl, req, res, redirectCount = 0) {
    if (redirectCount > 5) return res.status(502).send('Too many redirects from audio upstream');
    let parsed;
    try {
        parsed = assertSafeUrl(currentUrl);
    } catch (e) {
        return res.status(e.code === 'EBLOCKED' ? 403 : 400).send(e.code === 'EBLOCKED' ? 'Target tidak diizinkan' : 'Invalid url parameter');
    }

    const options = { headers: { 'User-Agent': UA }, lookup: safeLookup };
    if (req.headers.range) options.headers['Range'] = req.headers.range;
    if (parsed.hostname.includes('vidssave.com') || parsed.hostname.includes('aliyuncs.com')) {
        options.headers['Referer'] = 'https://vidssave.com/';
        options.headers['Origin'] = 'https://vidssave.com';
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const proxyReq = client.get(parsed, options, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            proxyRes.resume();
            const nextUrl = new URL(proxyRes.headers.location, currentUrl).href;
            return streamAudioProxy(nextUrl, req, res, redirectCount + 1);
        }
        res.status(proxyRes.statusCode);
        const allowedOrigin = getAllowedOrigin(req) || '*';
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
        ['content-type', 'content-length', 'accept-ranges', 'content-range'].forEach((h) => {
            if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
        });
        if (!res.getHeader('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
        proxyRes.pipe(res);
        req.on('close', () => proxyRes.destroy());
    });

    proxyReq.on('error', (err) => {
        if (!res.headersSent) res.status(err.code === 'EBLOCKED' ? 403 : 502).send(err.code === 'EBLOCKED' ? 'Target tidak diizinkan' : 'Proxy error: ' + err.message);
    });
    req.on('close', () => proxyReq.destroy());
}

app.get('/api/proxy-audio', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');
    streamAudioProxy(String(targetUrl), req, res);
});

// Proxy gambar (cache panjang). Hanya meneruskan respons bertipe image/*.
app.get('/api/proxy-image', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');
    let parsed;
    try {
        parsed = assertSafeUrl(String(targetUrl));
    } catch (e) {
        return res.status(e.code === 'EBLOCKED' ? 403 : 400).end();
    }
    const client = parsed.protocol === 'https:' ? https : http;
    client.get(parsed, { lookup: safeLookup, headers: { 'User-Agent': UA } }, (proxyRes) => {
        const type = String(proxyRes.headers['content-type'] || '');
        if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300 && !type.startsWith('image/')) {
            proxyRes.resume();
            return res.status(415).end();
        }
        res.status(proxyRes.statusCode);
        if (type) res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        proxyRes.pipe(res);
    }).on('error', () => {
        if (!res.headersSent) res.status(502).end();
    });
});

// /api/* yang tidak dikenal -> JSON 404 (bukan index.html)
app.use('/api', (req, res) => {
    res.status(404).json({ status: false, code: 'not_found', message: 'Endpoint tidak ditemukan.' });
});

// Berkas statis (lokal/VPS). Di Vercel berkas statis dilayani CDN.
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;

app.use(express.static(staticDir, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, pathUrl) => {
        if (pathUrl.endsWith('.html') || pathUrl.endsWith('release.json') || pathUrl.endsWith('boot.js')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (pathUrl.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (/\.(mp4|mov|webm)$/i.test(pathUrl)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
            res.setHeader('Accept-Ranges', 'bytes');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

app.use((req, res) => {
    const indexPath = fs.existsSync(path.join(distDir, 'index.html'))
        ? path.join(distDir, 'index.html')
        : path.join(__dirname, 'index.html');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(indexPath);
});

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Drowify Music berjalan di http://localhost:${port}`);
    });
}

module.exports = app;
