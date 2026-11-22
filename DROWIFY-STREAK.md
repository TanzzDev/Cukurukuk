# Drowify Streak

**Hari aktif** = ≥ `minPlays` (default 1) **pemutaran valid** pada hari kalender lokal. Pemutaran valid = audio benar-benar berjalan ≥ 30 detik (atau separuh lagu pendek). Tidak dihitung: klik Play, pause, buffering, seek/loncat, lagu gagal dimuat, rerender, event ganda, kecepatan >1x (dibatasi waktu nyata). Dua tab: hanya satu pemegang hitungan; server membatasi total detik ≤ waktu nyata.

Misalkan **L** = hari aktif terakhir, **T** = hari ini:
| Kondisi | Status |
|---|---|
| T − L ≤ 1 | **ACTIVE** (T − L = 1: belum mendengarkan hari ini, hari belum berakhir) |
| 2 ≤ T − L ≤ 7 | **DORMANT** — api padam, angka lama tetap terlihat. Masa pemulihan = 7 hari kalender **inklusif** dari hari pertama terlewat (L+1 … L+7); mulai `00:00` L+1, berakhir `00:00` L+8 |
| T − L ≥ 8 | **EXPIRED** — hangus permanen tepat 00:00 hari L+8; streak aktif 0; rekor & riwayat tetap |

Aktivitas berikutnya pada hari R: R−L=1 → +1; 2…7 → **dipulihkan** (nilai lama dipertahankan, bukan 1, tidak bertambah pada hari pemulihan; hari aktif berikutnya melanjutkan); ≥8 → rantai baru mulai 1. Contoh spesifikasi: 1 Nov streak 35 → dormant mulai 3 Nov, 5 Nov "tersisa 4 hari", 8 Nov terakhir bisa dipulihkan (sampai 23:59:59.999), 9 Nov 00:00 hangus.
Status dihitung ulang dari data harian (murni); hanya instan awal/akhir pemulihan dikunci di database agar tidak bergeser saat zona waktu berubah. Tanggal tiap aktivitas dikunci saat dicatat (zona waktu perangkat/profil).

Milestone: 1, 3, 7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365, 450, 500, 600, 750, 900, 999 (hitungan tidak berhenti di 999). Progres = jarak milestone sebelumnya → berikutnya. Achievement: First Spark (1), Kindled (3), `N-Day Flame` (7–450), `N-Day Legend` (500+). Perayaan hanya sekali (id `m:<hari>` / `r:<tanggal>` disimpan).
Record DB (`GET /api/me/streak` → `record`): user_id, current_streak, longest_streak, last_valid_play_at, last_active_date, streak_status, recovery_started_at, recovery_expires_at, streak_started_at, updated_at.
Kode: `shared/streak.js`, `shared/listening.js` · UI: `src/components/streak/`, `src/views/StreakView.jsx` · Test: `tests/streak.test.js`.
