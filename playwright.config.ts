import { defineConfig } from '@playwright/test'

// E2E_PORT で別ポートの開発サーバーに向けられる（複数の作業ツリーを同時に試すとき）
const port = process.env.E2E_PORT ?? '5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: { baseURL: `http://localhost:${port}`, locale: 'ja-JP', viewport: { width: 1440, height: 900 }, launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true, timeout: 60000 },
  reporter: [['list']],
})
