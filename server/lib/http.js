'use strict';
class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function serializeCookie(name, value, o = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=${o.path || '/'}`;
  if (o.maxAge != null) s += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.httpOnly) s += '; HttpOnly';
  if (o.secure) s += '; Secure';
  s += `; SameSite=${o.sameSite || 'Lax'}`;
  return s;
}

function isSecureRequest(req) {
  return !!req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

/** Tolak request tulis lintas-origin (pertahanan CSRF tambahan di atas SameSite=Lax). */
function sameOriginGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (new URL(origin).host === host) return next();
  } catch (_) { /* jatuh ke penolakan */ }
  return res.status(403).json({ status: false, code: 'bad_origin', message: 'Permintaan lintas-situs ditolak.' });
}

function handleError(res, err) {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    return res.status(err.status).json({ status: false, code: err.code, message: err.message, ...(err.extra || {}) });
  }
  if (err && err.code === 'busy') {
    return res.status(503).json({ status: false, code: 'busy', message: 'Server sedang sibuk, coba lagi sebentar.' });
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ status: false, code: 'too_large', message: 'Data terlalu besar.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: false, code: 'bad_json', message: 'Format JSON tidak valid.' });
  }
  console.error('[api]', err && err.stack ? err.stack : err);
  return res.status(500).json({ status: false, code: 'internal', message: 'Terjadi kesalahan pada server.' });
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => handleError(res, e));

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

/** Pembatas laju sederhana per IP (per instance). Cukup menahan lonjakan/penyalahgunaan ringan. */
function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${clientIp(req)}`;
    const e = hits.get(key);
    if (!e || e.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++e.n > max) {
      res.setHeader('Retry-After', String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ status: false, code: 'rate_limited', message: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return next();
  };
}

module.exports = { HttpError, parseCookies, serializeCookie, isSecureRequest, sameOriginGuard, handleError, wrap, rateLimit, clientIp };
