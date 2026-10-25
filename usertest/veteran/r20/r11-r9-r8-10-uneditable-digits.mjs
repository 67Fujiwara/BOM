// ラウンド8: 自分が書けない列（自動計算・他の役割の列）で数字・記号から打ち始めたとき、
// 1 文字目がビュー切替・コマンドになり、残りがどこへ行くか（別の列・別の行に値が入らないか）。現行 5176 と r7 ビルド 5198 を比べる
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib20.mjs'
const PORTS = (process.env.PORTS ?? '5176,5198').split(',').map(Number)
const CASES = [
  ['design', 1, 'R040', '単価', '25'],
  ['design', 1, 'R040', '採用', '2SC1815'],
  ['design', 1, 'R040', '金額', '4700'],
  ['design', 1, 'R040', '納期', '45'],
  ['design', 1, 'R040', 'スコア', '90'],
  ['design', 1, 'R040', '発注数', '20'],
  ['design', 1, 'R040', '必要日', '2026-12-01'],
  ['design', 1, 'R040', '期限', '11/30'],
  ['design', 1, 'R040', '待ち', '6'],
  ['design', 1, 'R040', 'ボール', '8 個'],
  ['design', 1, 'R040', '起因', '2個'],
  ['design', 9, 'R040', '発注数', '25'],
  ['design', 1, 'R040', '入荷予定', '2026/11/30'],
  ['purchasing', 9, 'R040', '必要数', '25'],
  ['purchasing', 1, 'R040', '部品名', '9x'],
  ['purchasing', 1, 'R040', '単価', '120'],
]
const out = {}
for (const port of PORTS) {
  const env = await open(port); const pg = env.page
  for (const [role, view, row, col, word] of CASES) {
    await reset(env, { role })
    const ok = await gotoCell(pg, view, row, col)
    await installToastLog(pg); await takeToasts(pg)
    const a = await snap(pg)
    const steps = []
    for (const ch of word) { await pg.keyboard.type(ch); await sleep(40); const s = await state(pg); steps.push(`${ch}→${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}${s.filter ? '/filter=' + s.filter : ''}`) }
    await pg.keyboard.press('Enter'); await sleep(120)
    const b = await snap(pg)
    const rec = { port, role, view, row, col, word, found: ok, steps, after: { cursor: b.cursor, view: b.view, mode: b.mode }, diff: diffRows(a, b), toasts: await takeToasts(pg) }
    ;(out[port] ??= []).push(rec); console.log(JSON.stringify(rec).slice(0, 900))
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
  console.log(port, 'errors', JSON.stringify(env.errs.slice(0, 5)))
  await env.browser.close()
}
saveJson('r8-10-uneditable-digits.json', out)
