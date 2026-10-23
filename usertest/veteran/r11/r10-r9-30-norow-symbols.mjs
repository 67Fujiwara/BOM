// ラウンド9: 行を選んでいない状態（起動直後・数字でビューを替えた直後・別のタブの変更で選択が外れた直後・分類の見出しの上）で
// 記号・数字・英字で始まる値を打って Enter。1 文字目で行が選ばれて残りがその行に入らないか（V8-02 の残り）。現行 5176 と r8 ビルド 5198
import { open, reset, snap, diffRows, sleep, saveJson, state, typeSeqM, installToastLog, takeToasts } from './lib11.mjs'
const out = []
const WORDS = ['<5mm', '>85℃', '<10', '>1k', '[A]CN-12', ']X', '?要確認', '/N 指定', '.5', '-12', '#3', '@1', '*1', "'1", '2SC1815', '47', 'abc']
const STARTS = ['起動直後', '4 を押した直後', '分類の見出し']
for (const port of [5176, 5198]) {
  const env = await open(port); const pg = env.page
  for (const st0 of STARTS) for (const w of WORDS) for (const gap of [40, 0]) {
    await reset(env)
    if (st0 === '4 を押した直後') { await pg.keyboard.press('4'); await sleep(40) }
    if (st0 === '分類の見出し') { await pg.keyboard.press(']'); await sleep(40) }
    await installToastLog(pg); await takeToasts(pg)
    const s0 = await state(pg); const a = await snap(pg)
    const steps = []
    if (gap) for (const ch of w) { await pg.keyboard.type(ch); await sleep(gap); const s = await state(pg); steps.push(`${ch}→${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}${s.filter ? '/f=' + s.filter : ''}`) }
    else { await typeSeqM(pg, [...w].map((c) => [c === '-' ? '-' : c, 0])); await sleep(60); const s = await state(pg); steps.push(`all→${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}${s.filter ? '/f=' + s.filter : ''}`) }
    await pg.keyboard.press('Enter'); await sleep(120)
    const b = await snap(pg)
    const rec = { port, st0, w, gap, start: s0.cursor, steps, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')).slice(0, 3) }
    out.push(rec); console.log(JSON.stringify(rec).slice(0, 700))
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
  console.log(port, 'errors', JSON.stringify(env.errs.slice(0, 5)))
  await env.browser.close()
}
saveJson('30-norow-symbols.json', out)
