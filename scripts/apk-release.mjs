// Menyiapkan public/apk/release.json dari APK yang BENAR-BENAR ada.
// Pemakaian: npm run release:apk -- ./drowify-3.0.0.apk --version 3.0.0 --url https://cdn.contoh/drowify.apk
// Tanpa --url, berkas disalin ke public/apk/ dan dilayani dari situs (perhatikan batas ukuran hosting Vercel; gunakan CDN/GitHub Releases bila besar).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name, def = '') => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : def; };
if (!file || !existsSync(file)) {
  console.error('Berkas APK tidak ditemukan. Pemakaian: npm run release:apk -- <path.apk> [--version x.y.z] [--url https://...] [--notes "a;b;c"]');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = opt('version', pkg.version);
const buf = readFileSync(file);
let url = opt('url');
if (!url) {
  mkdirSync('public/apk', { recursive: true });
  const name = `drowify-music-${version}.apk`;
  copyFileSync(resolve(file), resolve('public/apk', name));
  url = `/apk/${name}`;
}
const notes = opt('notes').split(';').map((s) => s.trim()).filter(Boolean);
const release = {
  available: true,
  name: 'Drowify Music',
  version,
  url,
  sizeBytes: statSync(file).size,
  sha256: createHash('sha256').update(buf).digest('hex'),
  minAndroid: opt('min-android', 'Android 7.0 (API 24) atau lebih baru'),
  releasedAt: new Date().toISOString().slice(0, 10),
  changelog: notes,
};
writeFileSync('public/apk/release.json', `${JSON.stringify(release, null, 2)}\n`);
console.log(`release.json diperbarui: ${basename(file)} (${release.sizeBytes} byte, sha256 ${release.sha256.slice(0, 12)}…)`);
