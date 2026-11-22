'use strict';
// Verifikasi ID token Google di BACKEND (tanda tangan, issuer, audience, kedaluwarsa).
const { HttpError } = require('./http');

const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
let remote = null;
let override = null; // hanya untuk pengujian: kunci publik lokal

async function verifyGoogleCredential(credential, clientId) {
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) {
    throw new HttpError(400, 'invalid_credential', 'Kredensial Google tidak valid.');
  }
  const { jwtVerify, createRemoteJWKSet } = await import('jose');
  const keys = override || (remote ||= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')));
  try {
    const { payload } = await jwtVerify(credential, keys, { issuer: ISSUERS, audience: clientId, clockTolerance: 30 });
    if (!payload.sub) throw new Error('tanpa sub');
    return {
      sub: String(payload.sub),
      email: String(payload.email || ''),
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: String(payload.name || ''),
      picture: String(payload.picture || ''),
    };
  } catch (e) {
    if (e && e.code === 'ERR_JWT_EXPIRED') throw new HttpError(401, 'token_expired', 'Sesi Google kedaluwarsa. Silakan masuk lagi.');
    throw new HttpError(401, 'invalid_credential', 'Kredensial Google tidak valid.');
  }
}

function setKeyResolverForTests(keys) { override = keys; }

module.exports = { verifyGoogleCredential, setKeyResolverForTests };
