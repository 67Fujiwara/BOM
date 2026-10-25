// ラウンド14: 大きい .xlsx で、ラウンド13 の修正の副作用（ページの見出しに列が足りない・版の印の書き方・ページ番号の書き方）が何行に効くか。
// ガイド「ファイルから」。現行（BOM_URL 既定 5176）と r13 ビルド（5198）
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib19.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r19/dl', f)
const TAG = process.env.TAG ?? ''
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const MK = ['オムロン', '三菱電機', 'IDEC']
// K1 2,500 行・50 ページ。偶数ページの見出しはメーカの列が無い（そのページの部品の行もメーカなし）
await wbFile('k1-2500-even-pages-no-maker.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); let k = 0; for (let pg = 1; pg <= 50; pg++) { const even = pg % 2 === 0; s.addRow(even ? ['部品名', '型式', '員数'] : ['部品名', '型式', 'メーカ', '員数']); for (let i = 0; i < 50; i++) { k++; s.addRow(even ? [`部品${k}`, `MDL-${k}`, (k % 9) + 1] : [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1]) } } })
// K2 2,500 行・50 ページ。1 ページ目「回路記号・部品名・型式・メーカ・数量」、2 ページ目以降は回路記号の列なし
await wbFile('k2-2500-ref-first-page-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); let k = 0; for (let pg = 1; pg <= 50; pg++) { const first = pg === 1; s.addRow(first ? ['回路記号', '部品名', '型式', 'メーカ', '数量'] : ['部品名', '型式', 'メーカ', '数量']); for (let i = 0; i < 50; i++) { k++; s.addRow(first ? [`K${k}`, `部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1] : [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1]) } } })
// K3 300 行の設計変更 BOM「部品名・型式・変更前の数量・変更後の数量」（変えた行は 30 行おき）
await wbFile('k3-300-henkouzen-no-suuryou.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '変更前の数量', '変更後の数量']); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `MDL-${k}`, (k % 9) + 1, k % 30 === 0 ? (k % 9) + 11 : (k % 9) + 1]) })
// K4 2,500 行・50 ページ。各ページの下に「n/50 ページ」
await wbFile('k4-2500-footer-n-of-50-page.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); let k = 0; for (let pg = 1; pg <= 50; pg++) { for (let i = 0; i < 50; i++) { k++; s.addRow([`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1]) } s.addRow([`${pg}/50 ページ`]) } })
// K5 現在の型式／変更後の型式（300 行、変えた行だけ変更後に値・ほかは空）
await wbFile('k5-300-genzai-henkougo-katashiki.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '現在の型式', '変更後の型式', '数量']); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `OLD-${k}`, k % 10 === 0 ? `NEW-${k}` : '', (k % 9) + 1]) })
const FILES = (process.env.FILES ?? 'k1-2500-even-pages-no-maker,k2-2500-ref-first-page-only,k3-300-henkouzen-no-suuryou,k4-2500-footer-n-of-50-page,k5-300-genzai-henkougo-katashiki').split(',')
const { browser, page, errors } = await launch()
const out = []
for (const f of FILES) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-L' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f + '.xlsx'))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 500)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(f)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r19/shots/${f}${TAG}-preview.png` })
  let created = null; let createMs = null
  if (prev) {
    const t1 = Date.now()
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    createMs = Date.now() - t1
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    const rs = p?.rows ?? []
    created = { rows: rs.length, qty0: rs.filter((r) => r.qtyNeeded === 0).length, makerDigits: rs.filter((r) => /^\d+$/.test(r.maker ?? '')).length, nameNotBuhin: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).length, modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, qtyChangedRows: rs.filter((r, i) => (i + 1) % 30 === 0).map((r) => r.qtyNeeded).slice(0, 4), sample: rs.slice(0, 3).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), page2: rs.slice(50, 53).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), junk: rs.filter((r) => /ページ/.test(r.name ?? '')).length }
  }
  const rec = { f, loadMs, createMs, toast, preview: prev.slice(0, 900), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 2000))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`82-excel-big${TAG}.json`, out)
await browser.close()
