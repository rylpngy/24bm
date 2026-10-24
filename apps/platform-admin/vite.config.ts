import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = {
    '/api': { target: env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
    '/realms': { target: env.DEV_AUTH_PROXY_TARGET || 'http://127.0.0.1:8081', changeOrigin: true },
  };
  return {
    plugins: [react()],
    server: { port: 5174, proxy },
    preview: { host: '127.0.0.1', proxy },
  };
});
