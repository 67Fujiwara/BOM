// ラウンド14: 設計変更の様式（上の段に結合した「変更前」「変更後」、下の段に項目）を .xlsx（結合セル）で。300 行。ガイド「ファイルから」2 ビルド


import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib15.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r15/dl', f)
const TAG = process.env.TAG ?? ''
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const MK = ['オムロン', '三菱電機', 'IDEC']
await wbFile('n1-ecn-merged-300.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['', '変更前', '', '', '変更後', '', '']); s.mergeCells('B1:D1'); s.mergeCells('E1:G1'); s.addRow(['部品名', '型式', 'メーカ', '数量', '型式', 'メーカ', '数量']); for (let k = 1; k <= 300; k++) { const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, MK[k % 3], (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, MK[k % 3], ch ? (k % 9) + 11 : (k % 9) + 1]) } })
await wbFile('n2-ecn-merged-kyu-shin.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '旧', '', '新', '']); s.mergeCells('A1:A2'); s.mergeCells('B1:C1'); s.mergeCells('D1:E1'); s.addRow(['', '型式', '数量', '型式', '数量']); for (let k = 1; k <= 300; k++) { const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, ch ? (k % 9) + 11 : (k % 9) + 1]) } })
const FILES = (process.env.FILES ?? 'n1-ecn-merged-300,n2-ecn-merged-kyu-shin').split(',')
const { browser, page, errors } = await launch()
const out = []
for (const f of FILES) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-N' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f + '.xlsx'))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 500)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(f)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r15/shots/${f}${TAG}-preview.png` })
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
saveJson(`89-ecn-xlsx${TAG}.json`, out)
await browser.close()
