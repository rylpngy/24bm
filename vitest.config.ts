import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 前端单测:jsdom 环境 + jest-dom 断言。覆盖 packages/* 与 apps/* 的 *.test.ts(x)。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/**/src/**/*.test.{ts,tsx}',
      'apps/**/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'legacy/**'],
  },
});
