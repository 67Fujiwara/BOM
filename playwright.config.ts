import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: { baseURL: 'http://localhost:5173', locale: 'ja-JP', viewport: { width: 1440, height: 900 }, launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined },
  webServer: { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60000 },
  reporter: [['list']],
})
