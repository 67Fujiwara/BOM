// ラウンド8: Enter・F2 で始めた数値・日付の編集が全選択で始まること（N7-03 の修正）と、Excel の F2（カーソルを末尾に置いて直す）の手癖
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, installToastLog, takeToasts } from './lib9.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
const val = (id, k) => pg.evaluate(([id, k]) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return JSON.stringify(r.working?.[k] ?? r[k]) }, [id, k])
const CASES = [
  ['必要数', 'qtyNeeded', ['Enter', 'T:5', 'Enter'], 'Enter→5→Enter（上書き）'],
  ['必要数', 'qtyNeeded', ['F2', 'Backspace', 'Enter'], 'F2→Backspace→Enter（Excel では最後の 1 文字を消す）'],
  ['必要数', 'qtyNeeded', ['F2', 'T:0', 'Enter'], 'F2→0→Enter（Excel では末尾に 0 を足す＝10 倍）'],
  ['必要数', 'qtyNeeded', ['Enter', 'End', 'T:0', 'Enter'], 'Enter→End→0→Enter'],
  ['必要日(固定)', 'needDateFixed', ['Enter', 'T:2026-12-24', 'Enter'], '日付 Enter→上書き'],
  ['必要日(固定)', 'needDateFixed', ['F2', 'Backspace', 'Backspace', 'T:15', 'Enter'], '日付 F2→BS BS→15→Enter（Excel では日だけ直す）'],
  ['部品名', 'name', ['F2', 'T:X', 'Enter'], '文字 F2→X（末尾に足す）'],
  ['部品名', 'name', ['Enter', 'T:X', 'Enter'], '文字 Enter→X（末尾に足す）'],
]
for (const [col, key, toks, label] of CASES) {
  await reset(env); await gotoCell(pg, 1, 'R040', col)
  if (col === '必要日(固定)') { await pg.keyboard.type('2026-12-01'); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp'); await sleep(50) }
  await installToastLog(pg); await takeToasts(pg)
  const before = await val('R040', key)
  const steps = []
  for (const t of toks) { if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2)); else await pg.keyboard.press(t); await sleep(50); const s = await state(pg); steps.push(`${t}→${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}`) }
  const sel = null
  const after = await val('R040', key)
  const rec = { label, col, before, after, steps, toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')) }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('r8-19-f2-selectall.json', out); await env.browser.close()
