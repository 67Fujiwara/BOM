// ラウンド8: 書けない列の数字で別のビューへ移り、カーソルの行がそのビューに無いとき、残りの文字は別の行（先頭の行）の部品名に入るか
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state } from './lib13.mjs'
const out = []
for (const port of [5176, 5198]) {
  const env = await open(port); const pg = env.page
  for (const [row, col, word] of [['R078', '単価', '6pcs'], ['R078', '金額', '61'], ['R030', '単価', '8pcs'], ['R030', 'ボール', '4x'], ['R070', 'スコア', '9.5'], ['R030', '納期', '6週']]) {
    await reset(env); const ok = await gotoCell(pg, 1, row, col)
    const a = await snap(pg); const steps = []
    for (const ch of word) { await pg.keyboard.type(ch); await sleep(40); const s = await state(pg); steps.push(`${ch}→${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}`) }
    await pg.keyboard.press('Enter'); await sleep(120)
    const b = await snap(pg)
    const rec = { port, row, col, word, found: ok, steps, diff: diffRows(a, b) }
    out.push(rec); console.log(JSON.stringify(rec))
    await pg.keyboard.press('Escape')
  }
  await env.browser.close()
}
saveJson('r8-10b-other-row.json', out)
