// ラウンド6: 300〜2,500 行での表示範囲の切り替えと連続入力（実打鍵）。
// A: 2,500 行の 1,200 行目付近から 部品名 を「値 → Enter」で 150 行続けて入れる（打鍵の間 0ms）→ 各行に正しく入ったか
// B: PageDown / Ctrl+↓ / Ctrl+G のあとすぐ打つ → 見えている行に入るか
// C: 部品名で並べ替えた状態で 部品名 を「値 → Enter」（確定で並びが変わる列）→ 飛ばし・二重書きが無いか
// D: Alt+h を 2,500 行で連打（隠す）・Alt+Shift+D（複製）・Ctrl+Z の連打 → 反応時間と結果
import { open, reset, snap, sleep, saveJson } from './lib6.mjs'
import { wizardCreate, bom300 } from './rerun5/lib.mjs'
const port = Number(process.env.PORT ?? 5195)
const N = Number(process.env.N ?? 2500)
const env = await open(port); const pg = env.page; const out = { port, N }
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 900)) }
const rowsNow = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.map((r) => ({ id: r.id, name: r.working?.name ?? r.name, hidden: !!r.hidden })) })
const cur = async () => (await pg.getByTestId('cursor').textContent()) ?? ''
await reset(env)
const t0 = Date.now()
const wz = await wizardCreate(pg, 'P-W' + N, bom300(N))
log('create', { ...wz, total: Date.now() - t0 })
await pg.keyboard.press('1'); await sleep(100)
// A
await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R1200'); await pg.keyboard.press('Enter'); await sleep(100)
await pg.keyboard.press('Home'); for (let i = 0; i < 20 && !(await cur()).endsWith('部品名'); i++) await pg.keyboard.press('ArrowRight')
const startCur = await cur()
const tA = Date.now()
for (let i = 0; i < 150; i++) { await pg.keyboard.type(`v${i}x`); await pg.keyboard.press('Enter') }
const msA = Date.now() - tA
if (process.env.ONLY_A) { log('A0', { msA, perRow: +(msA / 150).toFixed(1) }); saveJson(process.env.OUT ?? `56-window-A-${N}-${port}.json`, out); await env.browser.close(); process.exit(0) }
await sleep(400)
{
  const rows = await rowsNow()
  const s = rows.findIndex((r) => r.id === startCur.split(' ')[0])
  const bad = []
  for (let i = 0; i < 150; i++) if (rows[s + i]?.name !== `v${i}x`) bad.push({ i, id: rows[s + i]?.id, name: rows[s + i]?.name })
  const stray = rows.filter((r, j) => /^v\d+x$/.test(r.name) && (j < s || j >= s + 150)).map((r) => r.id + ':' + r.name)
  log('A', { startCur, endCur: await cur(), msA, perRow: +(msA / 150).toFixed(1), bad: bad.slice(0, 10), badN: bad.length, stray: stray.slice(0, 10) })
}
// B
const B = []
for (const [k, label] of [['PageDown', 'PageDown'], ['Control+ArrowDown', 'Ctrl+↓'], ['PageUp', 'PageUp'], ['Control+ArrowUp', 'Ctrl+↑']]) {
  await pg.keyboard.press(k); await pg.keyboard.type('Bq'); await sleep(60)
  const s1 = await snap(pg)
  const vis = await pg.evaluate(() => { const ed = document.querySelector('[data-testid="cell-editor"]'); if (!ed) return null; const r = ed.getBoundingClientRect(); const w = document.querySelector('.gridwrap').getBoundingClientRect(); return { inView: r.top >= w.top && r.bottom <= w.bottom } })
  await pg.keyboard.press('Escape')
  B.push({ label, cursor: s1.cursor, mode: s1.mode, edit: s1.edit, editorVisible: vis })
}
log('B', B)
// C: 部品名で並べ替え（Alt+s）→ 値 → Enter を 30 行
await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R1500'); await pg.keyboard.press('Enter'); await sleep(80)
await pg.keyboard.press('Home'); for (let i = 0; i < 20 && !(await cur()).endsWith('部品名'); i++) await pg.keyboard.press('ArrowRight')
await pg.keyboard.press('Alt+KeyS'); await sleep(200)
const chips = (await snap(pg)).chips
const visOrder = async () => pg.evaluate(() => [...document.querySelectorAll('.gridwrap tr.row')].map((tr) => tr.querySelector('td')?.textContent?.trim()))
const before = await cur()
const seen = []
for (let i = 0; i < 30; i++) { seen.push(await cur()); await pg.keyboard.type(`c${String(i).padStart(2, '0')}`); await pg.keyboard.press('Enter'); await sleep(20) }
await sleep(300)
{
  const rows = await rowsNow()
  const written = rows.filter((r) => /^c\d\d$/.test(r.name)).map((r) => r.id + '=' + r.name)
  const ids = seen.map((s) => s.split(' ')[0])
  log('C', { chips, before, cursorsVisited: seen.slice(0, 30), uniqueRowsVisited: new Set(ids).size, writtenN: written.length, written: written.slice(0, 30), after: await cur() })
}
await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.keyboard.press('Alt+KeyS'); await sleep(100); await pg.keyboard.press('Alt+KeyS'); await sleep(100)
// D: 2,500 行での Alt+h 連打・Alt+Shift+D・Ctrl+Z 連打の反応時間
await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R2000'); await pg.keyboard.press('Enter'); await sleep(80)
const lat = await pg.evaluate(async () => {
  const fire = (init) => { const t = performance.now(); document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); return performance.now() - t }
  const res = { altH: [], altShiftD: [], ctrlZ: [], altJ: [] }
  for (let i = 0; i < 10; i++) { res.altH.push(fire({ key: 'h', code: 'KeyH', altKey: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))) }
  for (let i = 0; i < 5; i++) { res.altShiftD.push(fire({ key: 'D', code: 'KeyD', altKey: true, shiftKey: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))) }
  for (let i = 0; i < 10; i++) { res.altJ.push(fire({ key: 'j', code: 'KeyJ', altKey: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))) }
  for (let i = 0; i < 15; i++) { res.ctrlZ.push(fire({ key: 'z', code: 'KeyZ', ctrlKey: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))) }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[s.length >> 1].toFixed(1) }
  return Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { median: med(v), max: +Math.max(...v).toFixed(1) }]))
})
const rowsD = await rowsNow()
log('D', { lat, hiddenAfterUndo: rowsD.filter((r) => r.hidden).length, rows: rowsD.length, rendered: await pg.evaluate(() => document.querySelectorAll('.gridwrap tr.row').length) })
log('errors', env.errs)
saveJson(process.env.OUT ?? `56-window-${N}-${port}.json`, out)
await env.browser.close()
