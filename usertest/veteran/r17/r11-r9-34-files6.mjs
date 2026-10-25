// ラウンド9: 新しい形の Excel（旧・変更前の見出し、隠した列だけが今の値、veryHidden・全シート非表示、オートフィルタ、以上・計の備考、幅 0 の列）。元はラウンド8（ガイドの「ファイルから」）。非表示の列・非表示のシート・表示形式（先頭の 0）・inlineStr・ふりがな（rPh）・
// 書式だけの 100 万行・日付になった型式
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import JSZip from '/home/user/BOM/node_modules/jszip/lib/index.js'
import { launch, fresh, palette, sleep, toastNow, ws, dumpErrors } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib17.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r17/dl', f)
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }

await wbFile('old-visible-left.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '旧型式', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'OLD-111', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'OLD-222', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('old-visible-right.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '旧型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N-D2 DC24', 'OLD-111', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'OLD-222', 'オムロン', 2]) })
await wbFile('old-pn-en.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['Description', 'Old P/N', 'P/N', 'Manufacturer', 'Qty']); s.addRow(['Relay', 'OLD-111', 'MY4N-D2 DC24', 'OMRON', 12]); s.addRow(['Terminal', 'OLD-222', 'XW2B-20G4', 'OMRON', 2]) })
await wbFile('qty-before.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '変更前 数量', '数量']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 999, 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 999, 2]) })
await wbFile('model-note-old.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式（旧型式併記）', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N-D2 DC24（旧 MY4N）', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('maker-hidden-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(3).hidden = true })
await wbFile('model-hidden-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(2).hidden = true })
await wbFile('veryhidden-sheet.xlsx', (wb) => { const a = wb.addWorksheet('BOM_old', { state: 'veryHidden' }); a.addRow(['部品名', '型式', 'メーカ', '員数']); a.addRow(['リレー', 'OLD-111', 'オムロン', 99]); a.addRow(['x', 'OLD-2', 'y', 1]); a.addRow(['x', 'OLD-3', 'y', 1]); const b = wb.addWorksheet('BOM'); b.addRow(['部品名', '型式', 'メーカ', '員数']); b.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]) })
await wbFile('all-hidden.xlsx', (wb) => { const a = wb.addWorksheet('BOM', { state: 'hidden' }); a.addRow(['部品名', '型式', 'メーカ', '員数']); a.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]) })
await wbFile('cover-visible-bom-hidden.xlsx', (wb) => { const c = wb.addWorksheet('表紙'); c.addRow(['案件名', '第4ライン']); c.addRow(['作成', '設計部']); const a = wb.addWorksheet('BOM', { state: 'hidden' }); a.addRow(['部品名', '型式', 'メーカ', '員数']); a.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]) })
await wbFile('two-hidden-cols.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'OLD-111', '旧メーカ', 'MY4N-D2 DC24', 'オムロン', 12]); s.getColumn(2).hidden = true; s.getColumn(3).hidden = true })
await wbFile('autofilter-rows.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['分類', '部品名', '型式', 'メーカ', '員数']); s.addRow(['制御', 'リレー', 'MY4N-D2 DC24', 'オムロン', 12]); const r = s.addRow(['電源', '電源', 'S8VK-G12024', 'オムロン', 1]); r.hidden = true; s.addRow(['制御', '端子台', 'XW2B-20G4', 'オムロン', 2]); s.autoFilter = 'A1:E4' })
await wbFile('header-holder.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数', 'Holder', '前回発注日']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12, '佐藤', '2026-01-01']) })
await wbFile('total-ijo.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数', '備考']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12, '以上']); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2, '計']); s.addRow(['ヒューズ', 'F-1', 'X', 2, 'Total']); s.addRow(['■ 予備品', '', '', '', '']); s.addRow(['★ 端子', 'T-1', 'X', 3, '']) })
// 列の幅 0（hidden 属性なし）
{
  await wbFile('w0.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'OLD-111', 'MY4N-D2 DC24', 'オムロン', 12]); s.getColumn(2).width = 0 })
}
const { browser, page, errors } = await launch()
const out = []
async function tryWizard(f) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-F' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f))
  for (let i = 0; i < 240; i++) { if (/読み込みました|読めませんでした/.test(await toastNow(page))) break; await sleep(250) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 240)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { rows: p?.rows.length, sample: p?.rows.slice(0, 6).map((r) => [r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, loadMs, toast, preview: prev.slice(0, 600), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1000))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of ['old-visible-left.xlsx', 'old-visible-right.xlsx', 'old-pn-en.xlsx', 'qty-before.xlsx', 'model-note-old.xlsx', 'maker-hidden-only.xlsx', 'model-hidden-only.xlsx', 'veryhidden-sheet.xlsx', 'all-hidden.xlsx', 'cover-visible-bom-hidden.xlsx', 'two-hidden-cols.xlsx', 'autofilter-rows.xlsx', 'header-holder.xlsx', 'total-ijo.xlsx', 'w0.xlsx']) await tryWizard(f)
saveJson('34-files6.json', out)
await browser.close()
