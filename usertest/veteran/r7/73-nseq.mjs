// ラウンド7: ID 列での n / F8 の行の順番と、型式などの列での F8 の順番を比べる（同じ問題をすべて回れるか）
import { open, reset, gotoCell, snap, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = {}
for (const [label, col, key, ack] of [['ID 列 n', 'ID', 'n', false], ['ID 列 F8', 'ID', 'F8', false], ['部品名 F8', '部品名', 'F8', false], ['ID 列 x n', 'ID', 'n', true], ['部品名 Alt+x F8', '部品名', 'F8', true], ['ID 列 Shift+N', 'ID', 'Shift+N', false], ['部品名 Shift+F8', '部品名', 'Shift+F8', false]]) {
  await reset(env); await gotoCell(pg, 4, 'R016', col)
  const seq = [(await snap(pg)).cursor]
  for (let i = 0; i < 14; i++) { if (ack) { await pg.keyboard.press(col === 'ID' ? 'x' : 'Alt+x'); await sleep(40) } await pg.keyboard.press(key); await sleep(60); seq.push((await snap(pg)).cursor) }
  const s = await snap(pg)
  out[label] = { seq, toast: s.toast.slice(0, 80), mode: s.mode }
  console.log(label, seq.join(' → '), '|', s.mode)
}
const probs = await pg.evaluate(() => document.querySelector('[data-testid="view-4"]')?.textContent)
console.log('view4 tab', probs)
saveJson('73-nseq.json', out); await env.browser.close()
