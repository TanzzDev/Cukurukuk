# Drowify Music

Aplikasi streaming musik (React 18 + Vite 5 + Tailwind 3, server Express) dengan lirik sinkron, antrean pintar (Mix Antrean & Konten Serupa), **Drowify Streak** (ACTIVE / DORMANT / EXPIRED, pemulihan 7 hari), akun Google, riwayat, Top 50, dan import playlist Spotify.
Developer: **Sulthan Nazirul Asrofi** (GitHub: TanzzDev) · https://sulthan-porto.web.id

## Menjalankan
```bash
npm install
cp .env.example .env        # isi sesuai kebutuhan (lihat DEPLOYMENT.md)
npm run dev                 # API :3000 + Vite :5173  → buka http://localhost:5173
npm test                    # 67 test (logika streak, antrean, server, tracker)
npm run build && npm start  # produksi lokal di :3000
```
Tanpa `.env` aplikasi tetap berjalan sebagai **tamu** (data di perangkat). Login Google & sinkronisasi butuh `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, dan database (Upstash Redis; lokal otomatis memakai `.data/db.json`).

## Struktur
| Folder | Isi |
|---|---|
| `src/` | UI: `context/` (Player, Nav, App), `services/` (storage, library, listening, tracker, cloud, spotify), `components/`, `views/` |
| `shared/` | Logika murni dipakai klien & server: `streak.js`, `listening.js`, `queue.js`, `related.js`, `spotify.js`, `library.js` |
| `server/` | `handlers/` (endpoint musik asli), `routes/` (auth, me, config…), `lib/` (KV, sesi, Google, SSRF guard) |
| `api/index.js` | Entry Vercel: satu serverless function (Express) |
| `tests/` | `node --test` |
| `public/` | aset brand, manifest PWA, `apk/release.json` |

## Dokumen
`DEPLOYMENT.md` · `API.md` · `DROWIFY-STREAK.md` · `APK-BUILD.md` · `CHANGELOG.md` · `LAPORAN-AKHIR.md`
