// ラウンド13: Excel ならではの形（結合セルの 2 段見出し・ページごとの繰り返し・隠した旧の列・2,500 行に 50 ページの見出し）を
// ガイド「ファイルから」で。現行（BOM_URL=5176/5197）と r12 ビルド（5198）
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib20.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r20/dl', f)
const TAG = process.env.TAG ?? ''
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const H = ['部品名', '型式', 'メーカ', '員数']
// M1 結合セルの 2 段見出し（型式・数量を 2 列に結合、下の段に 旧／新）
await wbFile('m1-merged-2stage.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '', '数量', '']); s.addRow(['', '旧', '新', '旧', '新']); s.mergeCells('B1:C1'); s.mergeCells('D1:E1'); s.mergeCells('A1:A2'); s.addRow(['リレー', 'MY2N', 'MY4N', 10, 12]); s.addRow(['端子台', 'XW2A', 'XW2B', 1, 2]) })
// M2 M1 をページごとに繰り返す（3 ページ）
await wbFile('m2-merged-2stage-repeat.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 0; pg < 3; pg++) { const r0 = s.rowCount + 1; s.addRow(['部品名', '型式', '', '数量', '']); s.addRow(['', '旧', '新', '旧', '新']); s.mergeCells(`B${r0}:C${r0}`); s.mergeCells(`D${r0}:E${r0}`); s.addRow([`リレー${pg}`, `MY2N-${pg}`, `MY4N-${pg}`, 10, 12]); s.addRow([`端子台${pg}`, `XW2A-${pg}`, `XW2B-${pg}`, 1, 2]) } })
// M3 旧／新の 1 段見出しを繰り返し、旧の列を隠す
await wbFile('m3-oldnew-hidden-old-repeat.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 0; pg < 2; pg++) { s.addRow(['部品名', '型式(旧)', '型式(新)', '数量']); s.addRow([`リレー${pg}`, `OLD-${pg}`, `NEW-${pg}`, 12]) } s.getColumn(2).hidden = true })
// M4 旧／新の 1 段見出しを繰り返す（隠さない）＝ c1 の Excel 版
await wbFile('m4-oldnew-repeat.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); for (let pg = 0; pg < 3; pg++) { s.addRow(['部品名', '型式(旧)', '型式(新)', '数量(旧)', '数量(新)']); s.addRow([`リレー${pg}`, `OLD-${pg}`, `NEW-${pg}`, 1, 10 + pg]); s.addRow([`端子台${pg}`, `OLDT-${pg}`, `NEWT-${pg}`, 2, 20 + pg]) } })
// M5 2,500 行・50 行ごとに見出しとページ表題（部品表 (n/50)・P.n）を繰り返す
await wbFile('m5-2500-pages.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); let k = 0; for (let pg = 1; pg <= 50; pg++) { s.addRow([`部品表 (${pg}/50)`, '', '', '', `P.${pg}`]); s.addRow(H); for (let i = 0; i < 50; i++) { k++; s.addRow([`部品${k}`, `MDL-${k}`, ['オムロン', '三菱電機', 'IDEC'][k % 3], (k % 9) + 1]) } } })
// M6 M5 の途中（1,200 行目）に「部品取付板 / 品番なし / メーカ不問 / 1」の 1 行
await wbFile('m6-2500-one-lookalike.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); for (let k = 1; k <= 2500; k++) { if (k === 1200) s.addRow(['部品取付板', '品番なし', 'メーカ不問', 1]); s.addRow([`部品${k}`, `MDL-${k}`, 'オムロン', (k % 9) + 1]) } })
const FILES = (process.env.FILES ?? 'm1-merged-2stage,m2-merged-2stage-repeat,m3-oldnew-hidden-old-repeat,m4-oldnew-repeat,m5-2500-pages,m6-2500-one-lookalike').split(',')
const { browser, page, errors } = await launch()
const out = []
for (const f of FILES) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-M' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f + '.xlsx'))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 500)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(f)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r20/shots/${f}${TAG}-preview.png` })
  let created = null; let createMs = null
  if (prev) {
    const t1 = Date.now()
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    createMs = Date.now() - t1
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, qty0: p?.rows.filter((r) => r.qtyNeeded === 0).length, junk: p?.rows.filter((r) => /^(部品表|旧|新)$|部品表 \(/.test(r.name) || r.model === '新' || r.model === '旧').length, sample: p?.rows.slice(0, 6).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), tail: p?.rows.slice(-3).map((r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')), around1200: p?.rows.slice(1197, 1202).map((r) => [r.name, r.model, r.qtyNeeded].join(' / ')) }
  }
  const rec = { f, loadMs, createMs, toast, preview: prev.slice(0, 700), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 2000))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`65-excel-r13${TAG}.json`, out)
await browser.close()
