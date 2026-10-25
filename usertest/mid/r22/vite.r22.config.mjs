// ラウンド22 試験用：usertest 以下（ダウンロードした Excel など）を監視しない（ENOSPC で開発サーバーが落ちるため）
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: '/home/user/BOM',
  plugins: [react()],
  resolve: { alias: { '@': '/home/user/BOM/src' } },
  server: { port: 5175, strictPort: true, watch: { ignored: ['**/usertest/**', '**/test-results/**', '**/dist/**', '**/docs/**', '**/e2e/**'] } },
})
