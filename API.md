# API

Semua respons: `{ status: true|false, ... }`; galat: `{ status:false, code, message }`. Endpoint akun memakai cookie `drowify_session` (httpOnly, SameSite=Lax) dan menolak POST/PUT/PATCH/DELETE lintas-origin.

**Publik**: `GET /api/health` · `GET /api/config` (fitur aktif, `streakRules`, `googleClientId`, `spotifyClientId`) · `GET /api/avatar/:uid` · `GET /api/spotify/playlist?url=` (pratinjau oEmbed: judul+sampul)
**Musik (asli)**: `/api/home` · `/api/search?query&type=all|songs|artists|playlists` · `/api/suggest?q` · `/api/artist` · `/api/album` · `/api/lyrics[1|2]` · `/api/translate` · `/api/transcribe` · `POST /api/ytplay` · `/api/proxy-audio?url` · `/api/proxy-image?url` (keduanya memblokir host privat/SSRF)
**Baru**: `GET /api/related?videoId&title&artist&artistId&limit` → rekomendasi berperingkat `{items:[{…,score,reasons[]}], sources, partial}` (radio YouTube Music + artis yang sama, cache 10 mnt)
**Auth**: `POST /api/auth/google {credential,tz}` (ID token diverifikasi di backend: tanda tangan, iss, aud, exp) · `GET /api/auth/session` · `POST /api/auth/logout`
**Akun** (wajib login): `GET|PATCH /api/me` (displayName 1–40) · `POST|DELETE /api/me/avatar` (PNG/JPEG/WebP ≤150 KB, 64–1024 px) · `GET|PUT /api/me/library` (revisi optimistik; 409 bila bentrok) · `GET|POST /api/me/listening` (event idempoten, 1–50/permintaan, dibatasi waktu nyata) · `POST /api/me/listening/celebrate|merge` · `DELETE /api/me/history` · `GET /api/me/streak` (+`record` ala tabel DB) · `GET /api/me/streak/calendar?month=YYYY-MM` · `GET /api/me/top?range=all|30d|7d` · `GET /api/me/history?q=`

Penyimpanan: Upstash Redis REST (kunci `u:<uid>:profile|library|listening`, `avatar:<uid>`), data tiap pengguna terpisah; operasi tulis memakai kunci per pengguna.
