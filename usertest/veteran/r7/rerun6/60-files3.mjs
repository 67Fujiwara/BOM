// ラウンド5: 壊れた・変わったファイル（その 2）。ガイドの「ファイルから」に読ませる
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, panel, toastNow, DL, ws, dumpErrors, save } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r7/dl3', f)
{
  // 数式だけ（計算結果を持たない）セル: 他のツールが書いた xlsx に多い
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', { formula: 'CONCATENATE("MY4N","-D2")' }, 'オムロン', { formula: '2*6' }]); s.addRow(['端子台', 'XW2B', 'オムロン', 3])
  await wb.xlsx.writeFile(P('formula-noresult.xlsx'))
}
{
  // 遠くのセル（XFD1048576）に 1 文字だけある
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 2])
  s.getCell('XFD1048576').value = 'x'
  await wb.xlsx.writeFile(P('far-cell.xlsx'))
}
{
  // 1 行目の右端（XFD1）に 1 文字、2〜2,000 行
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品名', '型式', 'メーカ', '員数']); for (let i = 0; i < 2000; i++) s.addRow(['部品' + i, 'M' + i, 'オムロン', 1])
  for (let i = 2; i < 2002; i++) s.getCell('XFD' + i).value = '.'
  await wb.xlsx.writeFile(P('wide-xfd-2000.xlsx'))
}
{
  // 型式が数値・日付に化けたセル、見出しが結合セル
  const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM')
  s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['チップ抵抗', 805, 'KOA', 10]); s.addRow(['IC', new Date(Date.UTC(2026, 0, 2)), 'TI', 1]); s.addRow(['IC2', 7805, 'TI', 2]); s.addRow(['ダイオード', '1N4148', 'Vishay', { formula: 'SUM(1,2)', result: 3 }])
  await wb.xlsx.writeFile(P('model-number-date.xlsx'))
}
{
  // BOM のシートが非表示（表紙だけ見える）
  const wb = new ExcelJS.Workbook(); const c = wb.addWorksheet('表紙'); c.addRow(['案件', '第3ライン']); const s = wb.addWorksheet('部品表', { state: 'hidden' })
  s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'MY4N', 'オムロン', 2])
  await wb.xlsx.writeFile(P('hidden-sheet.xlsx'))
}
async function tryWizard(f) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-F' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  const t0 = Date.now()
  if (await page.getByTestId('wizard-file').count()) { await page.getByTestId('wizard-file').setInputFiles(P(f)); }
  const tl0 = Date.now(); for (let i = 0; i < 120; i++) { if (/読み込みました|読めませんでした/.test(await toastNow(page)) || /読み込み済み/.test(await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => ''))) break; await sleep(250) } console.log('loadMs', f, Date.now() - tl0)
  const toast = (await toastNow(page)).slice(0, 200)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(f === '5000.tsv' ? 1500 : 200) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  const stepText = prev ? '' : ((await page.locator('[data-testid="panel-wizard"]').innerText().catch(() => '')).slice(-300).replace(/\n/g, ' | '))
  let created = null
  if (prev) {
    const t1 = Date.now(); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 30000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    created = { ms: Date.now() - t1, rows: p?.rows.length, sample: p?.rows.slice(0, 10).map((r) => [r.category, r.name, r.model, r.maker, r.qtyNeeded]) }
  }
  const rec = { f, toast, preview: prev.slice(0, 260), stepText, created, ms: Date.now() - t0, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 900))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of (process.env.ONLYF ? process.env.ONLYF.split(',') : ['sjis.csv', 'utf8bom.csv', 'utf16-unicode-text.txt', 'cr-only.csv', 'fullwidth-qty.csv', 'formula-noresult.xlsx', 'far-cell.xlsx', 'wide-xfd-2000.xlsx', 'model-number-date.xlsx', 'hidden-sheet.xlsx'])) await tryWizard(f)
save('../60-files3.json', out)
dumpErrors(errors, '60')
await browser.close()
