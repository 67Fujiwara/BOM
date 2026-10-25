// ラウンド9: 4 要確認で直して行が 4 から外れたとき（自分の操作）の Tab・Shift+Tab・Ctrl+.・F1・Ctrl+Enter。
// 「同じ位置の次の行へ」の結果、続けて打った値がどこへ入るか。現行 5176 と r8 ビルド 5198
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, installToastLog, takeToasts } from './lib19.mjs'
const CASES = [
  ['R054', '必要数', '5', 'Tab', 'pcs'],
  ['R054', '必要数', '5', 'Tab', '7'],
  ['R022', '型式', 'ABC-123', 'Tab', 'オムロン'],
  ['R061', '型式', 'ABC-123', 'Tab', 'オムロン'],
  ['R041', 'メーカ', 'オムロン', 'Shift+Tab', 'XYZ-1'],
  ['R009', 'メーカ', 'オムロン', 'Tab', '3'],
  ['R016', '型式', 'CP30-BA 1P 10A', 'Tab', 'オムロン'],
  ['R054', '必要数', '5', 'Control+.', ''],
  ['R054', '必要数', '5', 'Control+Shift+C', ''],
]
const out = []
for (const port of [5176, 5198]) {
  const env = await open(port); const pg = env.page
  for (const [row, col, fix, key, next] of CASES) {
    await reset(env)
    await gotoCell(pg, 4, row, col)
    await installToastLog(pg); await takeToasts(pg)
    const a = await snap(pg); const seq = [`start→${(await state(pg)).cursor}`]
    await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(fix)
    await pg.keyboard.press(key); await sleep(120)
    let s = await state(pg); seq.push(`${fix}+${key}→${s.cursor}/${s.mode}${s.panel ? '/' + s.panel : ''}`)
    const inView = await pg.evaluate((id) => !!document.querySelector(`[data-row-id="${id}"]`), row)
    if (next) { await pg.keyboard.type(next); await pg.keyboard.press('Enter'); await sleep(120); s = await state(pg); seq.push(`${next}+Enter→${s.cursor}/${s.mode}`) }
    const b = await snap(pg)
    const rec = { port, row, col, key, next, rowStillIn4: inView, seq, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')).slice(0, 3) }
    out.push(rec); console.log(JSON.stringify(rec).slice(0, 800))
    for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
  }
  await env.browser.close()
}
saveJson('33-fix-leave.json', out)
