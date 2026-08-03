import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 商城门户独立部署:与三端各自打包,商城版形态只起本端 + 后端(见 M-5)。
export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
});
