/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // В этой системе `localhost` резолвится в 127.0.0.1 (IPv4), а Node 18+
    // по умолчанию биндит на ::1 (IPv6). Принудительно IPv4, чтобы ссылка
    // http://localhost:5173 работала без сюрпризов.
    host: '127.0.0.1',
    // Локальный прокси к LZT API: обходит CORS браузера (токен едет в заголовке).
    proxy: {
      '/lzt-api': {
        target: 'https://prod-api.lzt.market',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lzt-api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
