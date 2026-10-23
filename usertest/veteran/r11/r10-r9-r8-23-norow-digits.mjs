// ラウンド8: 行を選んでいないとき（起動直後・絞り込み 0 行）に数字・記号で始まる値を打って Enter。1 文字目のビュー切替で選ばれた行に残りが入らないか（現行 / r7 ビルド）
import { open, reset, snap, diffRows, sleep, saveJson, state } from './lib11.mjs'
const out = []
for (const port of [5176, 5198]) {
  const env = await open(port); const pg = env.page
  for (const [st0, word] of [['起動直後', '47'], ['起動直後', '2SC1815'], ['起動直後', '<5mm'], ['起動直後', '[A]CN-12'], ['起動直後', '100uF'], ['1 で ↓→Esc 後の起動直後', '4K7']]) {
    await reset(env)
    const a = await snap(pg)
    const steps = []
    for (const ch of word) { await pg.keyboard.type(ch); await sleep(40); const s = await state(pg); steps.push(`${ch}→${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}`) }
    await pg.keyboard.press('Enter'); await sleep(120)
    const b = await snap(pg)
    const rec = { port, st0, word, steps, diff: diffRows(a, b) }
    out.push(rec); console.log(JSON.stringify(rec))
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
  await env.browser.close()
}
saveJson('r8-23-norow-digits.json', out)
