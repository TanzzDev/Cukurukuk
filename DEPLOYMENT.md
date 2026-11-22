# Deploy ke Vercel

1. Import repo/ZIP ke Vercel. Preset **Vite** (sudah di `vercel.json`): build `npm run build`, output `dist`.
2. Seluruh API berjalan di **satu** function `api/index.js` (Express) → tidak menambah function.
3. Isi Environment Variables (lihat `.env.example`):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `GOOGLE_CLIENT_ID` | untuk login | OAuth client (Web). Authorized JavaScript origins = domain Vercel & `http://localhost:5173` |
| `SESSION_SECRET` | untuk login | ≥ 32 karakter acak |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | untuk akun/sinkron | Vercel Marketplace → Upstash Redis (gratis). Nama `KV_REST_API_URL/TOKEN` juga dikenali |
| `BLOB_READ_WRITE_TOKEN` | opsional | Vercel Blob untuk foto profil; tanpa ini foto (≤64 KB) disimpan di Redis |
| `SPOTIFY_CLIENT_ID` | opsional | Hanya Client ID (PKCE). Redirect URI: `https://DOMAIN/spotify/callback` |
| `STREAK_MIN_PLAYS_PER_DAY` | opsional | default 1 (dokumen menyebut 3 dan 1; ubah ke 3 bila perlu) |
| `STREAK_RECOVERY_DAYS` | opsional | default 7 |
| `SITE_URL` | opsional | untuk meta OG/sitemap |

4. Cek `https://DOMAIN/api/health` → `{"status":true,"storage":"upstash"}` dan `/api/config` → `features`.
5. Fitur yang belum dikonfigurasi otomatis **disembunyikan/dinonaktifkan** di UI (tidak ada tombol palsu).

**Catatan jujur (belum diuji di Vercel dari sandbox ini):**
- `/api/proxy-audio` men-stream audio; `maxDuration` diset 60 dtk. Jika audio terpotong, jalankan `server.cjs` di host Node (Render/VPS) atau naikkan durasi sesuai paket.
- `ytplay.js` mencoba `yt-dlp` bila ada; di Vercel biasanya tidak ada dan otomatis memakai jalur lain.
- Sumber musik (YouTube Music) diakses dari server; ketersediaannya di luar kendali aplikasi.
- Netlify (`netlify.toml`, `netlify/functions`) dihapus; salinannya ada di `Drowify-Original-Backup.zip`.
