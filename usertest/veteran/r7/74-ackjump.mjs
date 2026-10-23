// ラウンド7: 警告を確認済みにして行が問題の一覧から消えた直後の n / F8 はどこへ行くか（次の行か、先頭へ戻るか）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
for (const [start, col, keys] of [['R005', 'ID', ['x', 'n']], ['R005', '型式', ['Alt+x', 'F8']], ['R005', 'ID', ['x', 'F8']], ['R061', 'ID', ['x', 'Shift+N']], ['R054', 'ID', ['x', 'n', 'x', 'n', 'x', 'n', 'x', 'n']]]) {
  await reset(env); await gotoCell(pg, 4, start, col)
  const a = await snap(pg); const seq = [a.cursor]; const toasts = []
  for (const k of keys) { await pg.keyboard.press(k); await sleep(60); const s = await snap(pg); seq.push(s.cursor); toasts.push(s.toast.slice(0, 50)) }
  const b = await snap(pg)
  const rec = { start, col, keys: keys.join(' '), seq, acked: diffRows(a, b), toasts }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('74-ackjump.json', out); await env.browser.close()
