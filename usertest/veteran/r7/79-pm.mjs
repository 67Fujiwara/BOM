// ラウンド7: PM の 7 要決定での連続操作（ID 列で y / Shift+Y / n、部品名で Alt+y / F8）、購買の 9 での連続（ID 列で x n / o）
import { open, reset, snap, diffRows, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const toCol = async (col) => { await pg.keyboard.press('Home'); for (let i = 0; i < 60 && !(await snap(pg)).cursor.endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight') }
for (const [role, view, col, keys] of [
  ['pm', 7, null, ['y']],
  ['pm', 7, 'ID', ['n', 'n', 'n']],
  ['pm', 7, 'ID', ['y']],
  ['pm', 7, null, ['Alt+y']],
  ['pm', 7, 'ID', ['Enter']],
  ['pm', 7, null, ['F8', 'F8', 'F8']],
  ['purchasing', 9, 'ID', ['x', 'n', 'x', 'n']],
  ['purchasing', 9, null, ['4']],
  ['purchasing', 9, 'ID', ['4']],
]) {
  await reset(env, { role })
  await pg.keyboard.press(`Alt+${view}`); await sleep(50); await pg.keyboard.press('ArrowDown'); await sleep(30)
  if (col) await toCol(col)
  const a = await snap(pg); const seq = [a.cursor]; const toasts = []
  for (const k of keys) { await pg.keyboard.press(k); await sleep(80); const s = await snap(pg); seq.push(s.cursor); toasts.push(s.toast.slice(0, 70)) }
  const b = await snap(pg)
  log({ role, view, col: col ?? '(↓ のまま)', keys: keys.join(' '), seq, view2: b.view, mode: b.mode, panel: b.panel, diff: diffRows(a, b).slice(0, 6), toasts })
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
}
log({ errors: env.errs })
saveJson('79-pm.json', out); await env.browser.close()
