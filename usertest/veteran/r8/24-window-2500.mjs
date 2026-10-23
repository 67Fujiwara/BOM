// ラウンド8: 2,500 行の窓（描画される範囲）で: PageDown / Ctrl+↓ の直後に数字・記号で始まる値、F8 → 直して Tab → F8、Alt+h ×5、Undo / Redo 20 手、2 タブで隠す
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib8.mjs'
const port = Number(process.env.PORT ?? 5197)
const URL = `http://localhost:${port}/`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const pg = await ctx.newPage()
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)) })
const out = []; const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const cur = () => pg.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent ?? '')
const st = () => pg.evaluate(() => ({ mode: document.querySelector('[data-testid="mode"]')?.textContent, edit: document.querySelector('[data-testid="cell-editor"]')?.value ?? null, cursor: document.querySelector('[data-testid="cursor"]')?.textContent, view: document.querySelector('[data-testid^="view-"][aria-current="true"]')?.dataset.testid }))
const rowv = (id, k) => pg.evaluate(([id, k]) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r ? (r.working?.[k] ?? r[k]) : '(none)' }, [id, k])
async function setup() {
  await pg.goto(URL); await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await pg.goto(URL)
  await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+s'); await sleep(50)
  await pg.evaluate(() => {
    const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId)
    const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0
    while (p.rows.length < 2500) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ }
    localStorage.setItem(k, JSON.stringify(w))
  })
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus()
}
async function toCol(c) { await pg.keyboard.press('Home'); for (let i = 0; i < 40 && !(await cur()).endsWith(' ' + c); i++) await pg.keyboard.press('ArrowRight') }
await setup()
// A: PageDown ×k → 部品名に 1N4148 / 備考に <5mm → Enter。カーソルの行に入るか
await pg.keyboard.press('Alt+1'); await pg.keyboard.press('ArrowDown'); await toCol('部品名')
for (const [k, col, word] of [[5, '部品名', '1N4148'], [20, '備考', '<5mm'], [40, '型式', '[A]CN-12'], [0, '必要数', '3']]) {
  for (let i = 0; i < k; i++) await pg.keyboard.press('PageDown')
  await toCol(col)
  const c0 = await cur(); const id = c0.split(' ')[0]
  const t = Date.now(); await pg.keyboard.type(word, { delay: 15 }); const s = await st(); await pg.keyboard.press('Enter'); await sleep(100)
  const key = { 部品名: 'name', 備考: 'note', 型式: 'model', 必要数: 'qtyNeeded' }[col]
  log({ case: 'A PageDown 後の値', pages: k, col, word, at: c0, editBefore: s.edit, saved: await rowv(id, key), ms: Date.now() - t, after: await cur() })
}
await pg.keyboard.press('Control+ArrowDown'); await toCol('備考'); { const c0 = await cur(); await pg.keyboard.type('?要確認', { delay: 15 }); await pg.keyboard.press('Enter'); await sleep(100); log({ case: 'A Ctrl+↓ 後の ?要確認', at: c0, saved: await rowv(c0.split(' ')[0], 'note') }) }
// B: F8 → 直して Tab → F8（2,500 行・最後の方の問題）。所要
await pg.keyboard.press('Alt+4'); await sleep(100)
{ const seq = []; const t = Date.now(); for (let i = 0; i < 6; i++) { await pg.keyboard.press('F8'); seq.push(await cur()) } log({ case: 'B F8 ×6', seq, perKey: Math.round((Date.now() - t) / 6) }) }
{ const c0 = await cur(); const t = Date.now(); await pg.keyboard.press('Alt+x'); await pg.keyboard.press('F8'); log({ case: 'B Alt+x → F8', from: c0, to: await cur(), ms: Date.now() - t }) }
// C: Alt+h ×5（1 すべて）→ Ctrl+Z ×5 → Ctrl+Y ×5、時間
await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('X2400'); await pg.keyboard.press('Enter'); await toCol('部品名')
{ const seq = [await cur()]; let t = Date.now(); for (let i = 0; i < 5; i++) { await pg.keyboard.press('Alt+h'); seq.push(await cur()) } const th = Date.now() - t
  t = Date.now(); for (let i = 0; i < 5; i++) await pg.keyboard.press('Control+z'); const tz = Date.now() - t
  const hiddenAfterZ = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return w.projects.find((x) => x.id === w.currentProjectId).rows.filter((r) => r.hidden).length })
  t = Date.now(); for (let i = 0; i < 5; i++) await pg.keyboard.press('Control+y'); const ty = Date.now() - t
  const hiddenAfterY = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return w.projects.find((x) => x.id === w.currentProjectId).rows.filter((r) => r.hidden).length })
  log({ case: 'C Alt+h ×5 / Ctrl+Z ×5 / Ctrl+Y ×5', seq, perHide: th / 5, perUndo: tz / 5, perRedo: ty / 5, hiddenAfterZ, hiddenAfterY }) }
// D: 20 手の編集 → Ctrl+Z ×20 → Ctrl+Y ×20
{ await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('X1200'); await pg.keyboard.press('Enter'); await toCol('備考')
  const t0 = Date.now(); for (let i = 0; i < 20; i++) { await pg.keyboard.type('n' + i); await pg.keyboard.press('Enter') } const te = Date.now() - t0
  let t = Date.now(); for (let i = 0; i < 20; i++) await pg.keyboard.press('Control+z'); const tz = Date.now() - t
  const notesZ = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return w.projects.find((x) => x.id === w.currentProjectId).rows.filter((r) => /^n\d+$/.test(r.working?.note ?? r.note ?? '')).length })
  t = Date.now(); for (let i = 0; i < 20; i++) await pg.keyboard.press('Control+y'); const ty = Date.now() - t
  const notesY = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return w.projects.find((x) => x.id === w.currentProjectId).rows.filter((r) => /^n\d+$/.test(r.working?.note ?? r.note ?? '')).length })
  log({ case: 'D 20 手 / Ctrl+Z ×20 / Ctrl+Y ×20', perEdit: te / 20, perUndo: tz / 20, perRedo: ty / 20, notesAfterZ: notesZ, notesAfterY: notesY }) }
// E: 2 タブ。B が A のカーソルの行（X2000）を隠す → A の relocation の時間とカーソル
{ await pg.keyboard.press('Alt+2'); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('X2000'); await pg.keyboard.press('Enter'); await toCol('部品名')
  const B = await ctx.newPage(); await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  await B.keyboard.press('Control+g'); await B.getByTestId('prompt-text').fill('X2000'); await B.keyboard.press('Enter'); await B.keyboard.press('Home'); await B.keyboard.press('h'); await sleep(500)
  await pg.bringToFront(); await sleep(300)
  log({ case: 'E 2 タブ: B が X2000 を隠す → A のカーソル', cursorA: await cur() })
  await B.close() }
log({ errs: errs.slice(0, 5) })
saveJson('24-window-2500.json', out); await browser.close()
