import { defineConfig, devices } from '@playwright/test';

// 浏览器 E2E:跑真实三端 dev server(5173/5174/5175)+ 后端(:8080,demo 种子)。
// 本地默认复用已在跑的 dev server;按文件名前缀分派到对应端 project(各自 baseURL)。
//   tenant-*.spec.ts   → :5173 采购方端
//   platform-*.spec.ts → :5174 平台端
//   supplier-*.spec.ts → :5175 供应商端
//   mall-*.spec.ts     → :5176 商城门户(独立部署的第四端;正则锚定文件名开头,
//                        否则 tenant-mall-*.spec.ts 会被两个 project 各跑一遍)
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { headless: true, trace: 'on-first-retry', locale: 'zh-CN' },
  projects: [
    {
      name: 'tenant',
      testMatch: /tenant-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
    {
      name: 'platform',
      testMatch: /platform-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
    {
      name: 'supplier',
      testMatch: /supplier-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5175' },
    },
    {
      name: 'mall',
      testMatch: /(^|\/)mall-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5176' },
    },
  ],
  webServer: [
    { command: 'npx -y pnpm@9.15.0 --filter @24bid/tenant-portal dev', port: 5173, reuseExistingServer: true, timeout: 120_000 },
    { command: 'npx -y pnpm@9.15.0 --filter @24bid/platform-admin dev', port: 5174, reuseExistingServer: true, timeout: 120_000 },
    { command: 'npx -y pnpm@9.15.0 --filter @24bid/supplier-portal dev', port: 5175, reuseExistingServer: true, timeout: 120_000 },
    { command: 'npx -y pnpm@9.15.0 --filter @24bid/mall-portal dev', port: 5176, reuseExistingServer: true, timeout: 120_000 },
  ],
});
