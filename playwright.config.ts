import { defineConfig, devices } from '@playwright/test';

// 浏览器 E2E:跑真实三端 dev server + 后端(:8080)。本地默认复用已在跑的 dev server。
// 前置:后端 mvn spring-boot:run(:8080,demo 种子)+ 对应前端 dev。
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
    locale: 'zh-CN',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @24bid/tenant-portal dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
