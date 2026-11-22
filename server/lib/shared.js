'use strict';
// Memuat modul ESM bersama (shared/*.js) dari kode CommonJS. Path literal agar ikut terbundel di Vercel.
let cache = {};
const loaders = {
  listening: () => import('../../shared/listening.js'),
  streak: () => import('../../shared/streak.js'),
  library: () => import('../../shared/library.js'),
  spotify: () => import('../../shared/spotify.js'),
  dates: () => import('../../shared/dates.js'),
  config: () => import('../../shared/config.js'),
  related: () => import('../../shared/related.js'),
};
const load = (name) => (cache[name] ||= loaders[name]());
module.exports = { load };
