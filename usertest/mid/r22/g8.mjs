// g8:
//   mode=tabs    : 2 タブ（同じ設計者）。A が Alt+Shift+A の一覧を開いたまま、B が同じ行を指定商社（立花）にして公開 → A が 1
//   mode=wipcheck: 設計の作業中（未公開）の値が、購買の社内 Excel の「チェック結果」に出ないか（M13-01 の続き）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'tabs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
if (mode === 'tabs') {
  await t.open('design'); await t.press('1')
  let p = await t.proj()
  const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
  const X = p.rows.find((r) => clean.includes(r.id) && r.status === 'quoted' && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
  const sc = await page.evaluate(async (id) => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return m.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => x.supplierId) }, X)
  const other = sc[0] === 'S2' ? 'S1' : 'S2'; const NAMES = { S1: '因幡電機', S2: '立花エレテック' }
  log('X', X, 'ranking', sc.join('>'), 'designate', other)
  const p2 = await context.newPage()
  await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor(); await p2.getByTestId('role-design').click(); await p2.locator('.gridwrap').focus()
  const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
  async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
  async function col2(key) { for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowRight') } for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowLeft') } }
  async function set2(id, col, v) { await goto2(id); await col2(col); await p2.keyboard.press('Enter'); await p2.waitForTimeout(40); await p2.keyboard.press('Control+a'); await p2.keyboard.type(v); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) }
  await p2.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ hiddenCols: s.getState().hiddenCols.filter((k) => !['procurement', 'designated'].includes(k)) }) })
  await t.goto(X); await t.press('Shift+A'); await page.waitForTimeout(120); log('A list', (await t.dialog()).slice(0, 200))
  await set2(X, 'procurement', '指定商社'); await set2(X, 'designated', NAMES[other])
  await p2.keyboard.press('Control+Enter'); await p2.waitForTimeout(150)
  for (let g = 0; g < 3; g++) { const pn = await S2('const x = st.panel; return x ? x.kind : null'); if (!pn) break; if (g === 0) await p2.keyboard.press('1'); await p2.waitForTimeout(60); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) }
  await page.waitForTimeout(400)
  log('B toast', await S2('return st.toast?.text ?? ""'), 'B working', JSON.stringify(await S2(`return p.rows.find(r=>r.id==='${X}').working ?? null`)), 'B panel', JSON.stringify(await S2('return st.panel ? st.panel.title ?? st.panel.kind : null')))
  p = await t.proj(); log('B published', h.show(p, X))
  await page.keyboard.press('1'); await page.waitForTimeout(150); const pn = await t.panel(); if (pn) { log('A after 1 panel', pn.title); await page.keyboard.press('Escape') }
  const msg = await t.toast(); await page.waitForTimeout(200); p = await t.proj(); const r = p.rows.find((x) => x.id === X)
  log('A 1 →', msg, '|', h.show(p, X))
  check('G8-1 一覧を開いたあとで別のタブが指定商社（指定先）にして公開した行に、一覧の 1 位で採用しない（指定先の採用を上書きしない）', r.adoptedSupplierId === other && r.procurement === '指定商社', `${msg} / ${h.show(p, X)}`)
} else {
  await t.open('design'); await t.press('1')
  log('R010 model (WIP) →', await t.setCellKey('R010', 'model', '未定'))
  log('R012 maker (WIP) →', await t.setCellKey('R012', 'maker', '#REF!'))
  await t.role('purchasing'); await t.press('1'); log('purch grid R010', await t.cellText('R010', 'model'), 'R012', await t.cellText('R012', 'maker'))
  const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const found = []; const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(t.downloads[n0].name)
  wb.eachSheet((sh) => sh.eachRow((rr) => { const txt = JSON.stringify(rr.values); if (/"R01[02]"/.test(txt)) found.push(sh.name + ': ' + txt.slice(0, 200)) }))
  for (const f of found) log('purch excel', f)
  check('G8-2 設計の作業中（未公開）の値（型式「未定」・メーカ「#REF!」）は、購買の社内 Excel の「チェック結果」にも出ない', !found.some((x) => /未定|#REF!/.test(x)), JSON.stringify(found.filter((x) => /チェック/.test(x))))
}
summary(); await t.close()
