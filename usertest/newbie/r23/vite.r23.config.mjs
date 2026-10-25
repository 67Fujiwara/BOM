// ラウンド22 試験用：usertest 以下（ダウンロードした Excel など）を監視しない（ENOSPC で開発サーバーが落ちるため）。src は /home/user/BOM/src をそのまま配る
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: '/home/user/BOM',
  plugins: [react()],
  resolve: { alias: { '@': '/home/user/BOM/src' } },
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/usertest/**', '**/test-results/**', '**/dist/**', '**/docs/**', '**/e2e/**', '**/.git/**'] } },
})
