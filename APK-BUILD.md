# APK (Android WebView) — panduan

**Status: APK belum dibangun di paket ini** (source Android Drowify tidak ada; lingkungan pembuatan tidak dapat mengunduh Android SDK/Gradle). Tombol Download APK di web menampilkan "belum tersedia" sampai `public/apk/release.json` menunjuk APK nyata (`npm run release:apk -- ./app.apk --version 3.0.0 [--url https://…]`).

Cara paling praktis: **Capacitor** memuat situs yang sudah di-deploy.
```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
npx cap init "Drowify Music" com.drowify.music --web-dir=dist
# capacitor.config.json → "server": { "url": "https://DOMAIN-VERCEL-KAMU", "cleartext": false }
npx cap add android && npx cap sync
# ikon: pakai public/icons/icon-512.png & icon-maskable-512.png (Android Studio → Image Asset)
# splash native: latar hitam #000000 + simbol putih (public/brand/drowify-simbol-putih.svg); web memuat loading screen sendiri
cd android && ./gradlew assembleRelease   # lalu tanda tangani dengan keystore sendiri (apksigner)
```
Catatan: target SDK 35 (Android 15) → tangani edge-to-edge (`viewport-fit=cover` + safe-area sudah dipakai web); Google **memblokir login OAuth di WebView** → untuk login gunakan Chrome Custom Tabs/Credential Manager native atau pakai mode tamu; perubahan situs terlihat tanpa instal ulang selama URL tetap; perubahan native butuh build & tanda tangan ulang.
