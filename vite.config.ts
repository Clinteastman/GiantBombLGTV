import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// webOS loads index.html via file:// from inside the .ipk, so we need
// relative asset paths. `base: ''` makes Vite emit ./assets/... refs.
export default defineConfig({
  base: '',
  plugins: [react()],
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Dev-only: route /gb/* to giantbomb.com to avoid CORS during local dev.
      // In production (.ipk on webOS), the client fetches the real host directly.
      // User-Agent must be "GBTV" (uppercase) — giantbomb.com's Cloudflare zone
      // whitelists that UA. Default Node UAs get hit with the challenge page
      // intermittently, especially on /upcoming_json.
      '/gb': {
        target: 'https://giantbomb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gb/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'GBTV');
          });
        },
      },
    },
  },
});
