'use strict';
// Perlindungan SSRF untuk proxy audio/gambar: tolak host internal/privat, juga setelah DNS di-resolve.
const dns = require('dns');
const net = require('net');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  return true;
}

/** Validasi URL proxy: hanya http(s), bukan literal IP privat, bukan nama host lokal. */
function assertSafeUrl(input) {
  let u;
  try { u = new URL(input); } catch (_) { throw Object.assign(new Error('URL tidak valid'), { code: 'EBADURL' }); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw Object.assign(new Error('Protokol tidak diizinkan'), { code: 'EBADURL' });
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) throw Object.assign(new Error('Host tidak diizinkan'), { code: 'EBLOCKED' });
  if (net.isIP(host) && isPrivateIp(host)) throw Object.assign(new Error('Alamat tidak diizinkan'), { code: 'EBLOCKED' });
  return u;
}

/** Pasang di opsi http(s).get({ lookup: safeLookup }) agar alamat hasil DNS ikut diperiksa saat koneksi. */
function safeLookup(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      return cb(Object.assign(new Error('Alamat tujuan diblokir'), { code: 'EBLOCKED' }));
    }
    if (options && options.all) return cb(null, addrs);
    return cb(null, addrs[0].address, addrs[0].family);
  });
}

module.exports = { isPrivateIp, assertSafeUrl, safeLookup };
