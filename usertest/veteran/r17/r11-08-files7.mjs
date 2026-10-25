// ラウンド10: 新しい形の Excel（結合した 2 段の見出し・表題行・数式・エラー値・リッチテキスト・リンク・日付の数量・全角数字・
// 折りたたんだ行・隠した見出しの行・隠した列と行の両方・3,000 行・中身が CSV / テキストの .xlsx・空のブック）。ガイドの「ファイルから」
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib17.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r17/dl', f)
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
const H = ['部品名', '型式', 'メーカ', '員数']
await wbFile('merged-2row-header.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品', '', '手配', '']); s.mergeCells('A1:B1'); s.mergeCells('C1:D1'); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('title-rows.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品表　第4ライン 制御盤']); s.addRow([]); s.addRow(['作成：設計部', '', '日付', new Date('2026-10-01')]); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('formula-qty.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow([...H, '台数']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', { formula: 'E2*6', result: 12 }, 2]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', { formula: 'E3*1', result: 2 }, 2]) })
await wbFile('formula-noresult.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', { formula: '6*2' }]); s.addRow(['端子台', { formula: 'CONCATENATE("XW2B","-20G4")' }, 'オムロン', 2]) })
await wbFile('error-cells.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', { error: '#N/A' }, 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', { error: '#REF!' }]) })
await wbFile('richtext-link.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', { richText: [{ text: 'MY4N' }, { text: '-D2 DC24', font: { bold: true } }] }, 'オムロン', 12]); s.addRow(['端子台', { text: 'XW2B-20G4', hyperlink: 'https://example.com/xw2b' }, 'オムロン', 2]) })
await wbFile('date-qty-fullwidth.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', new Date('2026-01-12')]); s.addRow(['端子台', ' XW2B-20G4 ', 'オムロン', '１２']); s.addRow(['ヒューズ', '0012', 'X', '3個']) })
await wbFile('outline-collapsed.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); for (let i = 0; i < 3; i++) { const r = s.addRow(['予備 ' + i, 'SP-' + i, 'X', 1]); r.outlineLevel = 1; r.hidden = true } s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('hidden-header-row.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); const h = s.addRow(H); h.hidden = true; s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('hidden-col-and-rows.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow([...H, '備考']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12, 'a']); const r = s.addRow(['電源', 'S8VK', 'オムロン', 1, 'b']); r.hidden = true; s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2, 'c']); s.getColumn(5).hidden = true })
await wbFile('qty-hidden-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(4).hidden = true })
await wbFile('rows-3000.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H); for (let i = 0; i < 3000; i++) s.addRow(['部品' + i, 'PN-' + i, 'メーカ' + (i % 7), (i % 9) + 1]) })
await wbFile('empty-book.xlsx', (wb) => { wb.addWorksheet('Sheet1') })
await wbFile('header-only.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(H) })
fs.writeFileSync(P('csv-renamed.xlsx'), '部品名,型式,メーカ,員数\nリレー,MY4N-D2 DC24,オムロン,12\n')
fs.writeFileSync(P('text-renamed.xlsx'), 'これは Excel ではありません')
const { browser, page, errors } = await launch()
const out = []
async function tryWizard(f) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-G' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length; const t0 = Date.now()
  await page.getByTestId('wizard-file').setInputFiles(P(f))
  for (let i = 0; i < 240; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(250) }
  const loadMs = Date.now() - t0
  const toast = (await toastNow(page)).slice(0, 260)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  let created = null
  if (prev) {
    const t1 = Date.now()
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { ms: Date.now() - t1, rows: p?.rows.length, sample: p?.rows.slice(0, 5).map((r) => [r.name, r.model, r.maker, r.qtyNeeded]), last: p?.rows.at(-1) && [p.rows.at(-1).name, p.rows.at(-1).qtyNeeded] }
  }
  const rec = { f, loadMs, toast, preview: prev.slice(0, 700), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1100))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of ['merged-2row-header.xlsx', 'title-rows.xlsx', 'formula-qty.xlsx', 'formula-noresult.xlsx', 'error-cells.xlsx', 'richtext-link.xlsx', 'date-qty-fullwidth.xlsx', 'outline-collapsed.xlsx', 'hidden-header-row.xlsx', 'hidden-col-and-rows.xlsx', 'qty-hidden-only.xlsx', 'rows-3000.xlsx', 'empty-book.xlsx', 'header-only.xlsx', 'csv-renamed.xlsx', 'text-renamed.xlsx']) await tryWizard(f)
saveJson('08-files7.json', out)
await browser.close()
