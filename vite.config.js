import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// URL situs untuk meta OG/robots/sitemap: SITE_URL, atau domain produksi Vercel bila tersedia.
const siteUrl = () => {
  const v = process.env.SITE_URL || process.env.URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return v.replace(/\/$/, '');
};

function injectSiteUrl() {
  return {
    name: 'inject-site-url',
    transformIndexHtml: (html) => html.replace(/__SITE_URL__/g, siteUrl()),
    closeBundle() {
      // robots.txt & sitemap.xml di dist: isi token, atau buang baris bila SITE_URL tidak diketahui
      import('node:fs').then(({ readFileSync: r, writeFileSync: w, existsSync }) => {
        for (const f of ['dist/robots.txt', 'dist/sitemap.xml']) {
          if (!existsSync(f)) continue;
          let t = r(f, 'utf8');
          t = siteUrl() ? t.replace(/__SITE_URL__/g, siteUrl()) : t.split('\n').filter((l) => !l.includes('__SITE_URL__')).join('\n');
          w(f, t);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSiteUrl()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 5173,
    host: true,
    // changeOrigin:false agar header Host tetap = Origin (guard same-origin server tetap lolos saat dev)
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom'] } },
    },
  },
});
