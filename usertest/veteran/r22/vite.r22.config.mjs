// ラウンド22（ベテラン）試験用：usertest 以下を監視しない（ほかの試験が書く画像・Excel で開発サーバーが落ちるため。src は同じ）
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: '/home/user/BOM',
  plugins: [react()],
  resolve: { alias: { '@': '/home/user/BOM/src' } },
  server: { port: 5176, strictPort: true, watch: { ignored: ['**/usertest/**', '**/test-results/**', '**/dist/**', '**/docs/**', '**/e2e/**'] } },
})
