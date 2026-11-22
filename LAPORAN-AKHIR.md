# Laporan akhir — Drowify Music 3.0.0

## Terverifikasi (dijalankan)
- **67 test otomatis lulus** (`npm test`): logika streak (14 skenario spesifikasi + timeline 35 hari + batas hari ke-7 + zona waktu + 999 hari), pencatatan dengar anti-ganda, antrean, parser/pencocok Spotify, peringkat rekomendasi, server (login Google dengan token bertanda tangan: valid/kedaluwarsa/audience & issuer salah, sesi, CSRF, profil, avatar, pustaka+konflik revisi, isolasi antar pengguna, streak DORMANT/EXPIRED lewat API, SSRF), pengukur dengar (pause/seek/buffering/2x/tab ganda).
- `vite build` sukses (bundel utama ≈159 KB gzip, halaman berat dimuat lazy); ESLint 0 error.
- **Uji browser nyata (Chromium headless; API musik & audio dimock, server/DB asli)**: skenario HP 43/43 lulus — loading screen, navigasi, Cari → tambah antrean (duplikat ditolak), putar audio nyata, panel antrean, Konten Serupa, Putar Berikutnya vs Tambahkan, kunci/buka, urut (menu & seret), hapus, bersihkan (lagu aktif tetap), Mix (pilih/semua/hapus), Next/Prev, audio tetap saat pindah halaman. Putaran kedua: 54/58 lulus — 3 status streak + 999 + baru, animasi api per status, responsif tanpa overflow di 390/768/1024/1366/1920 px, kerangka sesuai layar, panel antrean dari area player. Login Google di browser terbukti di uji terpisah (POST 200, profil tampil); langkah profil/foto/gabung/perayaan 35 dtk **belum terverifikasi di browser** (server-nya teruji di test integrasi).

## Belum diuji / keterbatasan (jujur)
- **Belum ada APK** (lihat `APK-BUILD.md`). Tombol unduh menampilkan "belum tersedia".
- Tidak diuji: deploy Vercel, Upstash/Blob asli, Google/Spotify asli, API YouTube Music asli (jaringan sandbox terbatas), audio dari sumber asli.
- **Spotify**: sejak 2026 daftar lagu hanya dapat dibaca untuk playlist milik/kolaborasi pengguna yang login → import "URL saja" tanpa login tidak mungkin lewat API resmi. Disediakan: pratinjau URL, login Spotify (PKCE), CSV/tempel. Mode developer Spotify dibatasi 5 akun.
- Tidak ada sinkron antrean lintas perangkat (antrean tersimpan lokal per akun/tamu).
- Genre/mood tidak tersedia dari sumber → tidak dipakai/dikarang; alasan rekomendasi hanya dari sinyal nyata.
- Di WebView Android, login Google biasanya diblokir (lihat `APK-BUILD.md`). Layar sentuh seret-urut disediakan alternatif menu.

## Keputusan pada spesifikasi yang bertentangan
- Syarat harian tertulis "3 lagu" dan "1 lagu": default **1 pemutaran valid/hari** (`STREAK_MIN_PLAYS_PER_DAY`).
- Pemulihan: hari pemulihan memulihkan nilai lama (tidak +1, tidak 1); hari aktif berikutnya melanjutkan.
- Mix Antrean versi pertama (acak) digantikan definisi terbaru (rekomendasi berperingkat).
