# Changelog

## 3.0.0
- Redesign UI hitam-putih Drowify (Unbounded + Figtree, lokal), kerangka responsif HP / tablet (rail) / laptop (sidebar + bar pemutar + panel antrean), loading screen D terbelah, Dashboard tanpa banner, Cari, Pustaka (+detail playlist), Kamu, Riwayat, Teratas Saya 50, Pengaturan.
- **Antrean**: satu sumber data (persisten per akun/tamu), tambah dari Cari/Mix/Konten Serupa, Putar Berikutnya vs Tambahkan ke Antrean, kunci/buka (benar-benar memblokir penambahan), bersihkan dengan konfirmasi, urut lewat seret/keyboard/menu, jumlah + total durasi dinamis.
- **Mix Antrean / Konten Serupa**: rekomendasi berperingkat dari radio YouTube Music + artis sama (alasan jujur; bukan acak), cache, fallback.
- **Drowify Streak**: ACTIVE/DORMANT/EXPIRED + pemulihan 7 hari, milestone 1–999, kalender, riwayat, achievement, perayaan sekali, animasi api SVG (5 level).
- Akun Google (verifikasi backend), profil kustom (nama + foto), sinkron pustaka/riwayat/streak, gabung data tamu opsional, Top 50 (semua/30/7 hari), riwayat valid.
- Import Spotify: pratinjau URL, login Spotify (PKCE), CSV/tempel, pencocokan berprogres + cancel (lihat batasan API 2026).
- Backend: SSRF guard pada proxy, CORS ketat untuk endpoint akun, header keamanan/CSP, satu function Vercel; handler asli dipindah ke `server/handlers/`.
- Perbaikan/penghapusan: mode "offline" lama dihapus (hanya daftar metadata, bukan audio); Netlify dihapus; state waktu pemutar dipisah (tanpa render ulang seluruh UI tiap detik); dependensi tak terpakai dibuang.
