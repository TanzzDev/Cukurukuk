'use strict';
// Sesi = JWT HS256 bertanda tangan di cookie httpOnly. Identitas SELALU diverifikasi server;
// nama/email dari frontend tidak pernah dianggap sebagai bukti autentikasi.
const cfg = require('./config');
const { HttpError, parseCookies, serializeCookie, isSecureRequest } = require('./http');

const COOKIE = 'drowify_session';
const MAX_AGE = 30 * 24 * 3600;
let joseP = null;
const jose = () => (joseP ||= import('jose'));

function secretKey() {
  const s = cfg.get().sessionSecret;
  if (!s || s.length < 32) {
    throw new HttpError(503, 'auth_not_configured', 'Login belum dikonfigurasi di server (SESSION_SECRET minimal 32 karakter).');
  }
  return new TextEncoder().encode(s);
}

async function createSession(req, res, uid) {
  const { SignJWT } = await jose();
  const token = await new SignJWT({ sub: uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('drowify')
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  res.append('Set-Cookie', serializeCookie(COOKIE, token, { httpOnly: true, secure: cfg.get().isProd || isSecureRequest(req), maxAge: MAX_AGE }));
}

/** -> uid atau null (tidak ada / kedaluwarsa / tidak valid). */
async function readSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  try {
    const { jwtVerify } = await jose();
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'drowify', algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return null;
  }
}

function clearSession(req, res) {
  res.append('Set-Cookie', serializeCookie(COOKIE, '', { httpOnly: true, secure: cfg.get().isProd || isSecureRequest(req), maxAge: 0 }));
}

module.exports = { createSession, readSession, clearSession, COOKIE };
