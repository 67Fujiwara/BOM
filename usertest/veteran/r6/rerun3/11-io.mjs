// 入出力の往復: JSON（300 行）・社内 Excel → 新規 BOM、作り込んだ Excel（書式つき文字・数式・エラー値・結合・表紙シート）
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, goto, toColKey, sleep, dumpErrors, save, proj, panel, closeAll, palette, toastNow, ws, DL, wizardCreate, bom300 } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1200)) }
async function grab(fn, n = 1) { const files = []; const h = async (d) => { const f = path.join(DL, Date.now() + '-' + d.suggestedFilename()); await d.saveAs(f); files.push(f) }; page.on('download', h); await fn(); for (let i = 0; i < 80 && files.length < n; i++) await sleep(100); page.off('download', h); return files }
async function wizardFile(id, file) {
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('2'); await sleep(40)
  await page.getByTestId('wizard-file').setInputFiles(file); await sleep(1500)
  const t = await toastNow(page)
  await page.keyboard.press('Enter'); await sleep(100)
  const prev = (await page.getByTestId('wizard-preview').textContent().catch(() => ''))?.slice(0, 600)
  await page.keyboard.press('Enter'); await sleep(300)
  await closeAll(page)
  return { toast: t.slice(0, 120), preview: prev }
}
// A: 300 行 JSON 往復
{
  await fresh(page)
  await wizardCreate(page, 'P-RT', bom300())
  const files = await grab(() => palette(page, 'JSON を書き出す'))
  const text = fs.readFileSync(files[0], 'utf8')
  const before = await ws(page)
  await fresh(page)
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.getByTestId('import-file').setInputFiles(files[0]); await sleep(300)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(80)
  if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(200) }
  const after = await ws(page)
  const strip = (w) => JSON.stringify({ projects: w.projects.map((p) => ({ ...p, events: undefined, version: undefined, updatedAt: undefined })), suppliers: w.suppliers, rules: w.rules })
  log('A json roundtrip 300', { bytes: text.length, same: strip(before) === strip(after), projects: after.projects.map((p) => p.id + ':' + p.rows.length) })
}
// B: 社内 Excel（Ctrl+E）→ 新しい BOM に読み込み → 行・部品名・型式・数量が一致するか
{
  await page.keyboard.press('Control+p'); await sleep(40)
  const opts = await page.locator('[data-testid^="panel-"]').first().innerText()
  await closeAll(page)
  const files = await grab(async () => { await page.keyboard.press('Control+e'); await sleep(60); await page.keyboard.press('Enter') })
  const p0 = await proj(page)
  const r = await wizardFile('P-RT2', files[0])
  const w = await ws(page)
  const p1 = w.projects.find((p) => p.id === 'P-RT2')
  const cmp = p1 ? p0.rows.filter((x) => x.status !== 'cancelled').map((x, i) => { const y = p1.rows[i]; return y && x.name === y.name && x.model === y.model && x.qtyNeeded === y.qtyNeeded && (x.category ?? '') === (y.category ?? '') }).filter(Boolean).length : 0
  log('B excel → new BOM', { file: path.basename(files[0] ?? ''), ...r, rowsSrc: p0.rows.length, rowsNew: p1?.rows.length, matching: cmp, sampleNew: p1?.rows.slice(0, 2).map((x) => [x.category, x.name, x.model, x.qtyNeeded, x.unit]) })
}
// C: 作り込んだ Excel
{
  const wb = new ExcelJS.Workbook()
  const sh = wb.addWorksheet('BOM')
  sh.addRow(['分類', '品名', '形式', 'メーカー', '員数', '単位', '備考'])
  sh.addRow(['電源', { richText: [{ text: '電源' }, { font: { bold: true, color: { argb: 'FFFF0000' } }, text: 'ユニット（変更）' }] }, 'S8VK-G24024', 'オムロン', { formula: '2*3', result: 6 }, '個', ''])
  sh.addRow(['', 'リレー', 'MY4N', 'オムロン', { formula: 'E2/0', result: { error: '#DIV/0!' } }, '個', ''])
  sh.addRow(['', 'ヒューズ', { text: 'F-1', hyperlink: 'https://example.com' }, '', 4, '個', new Date('2026-12-01')])
  sh.addRow(['端子', '端子台', 'XW2B', 'オムロン', '１２', '個', '全角数字'])
  sh.mergeCells('A2:A4')
  sh.getRow(6).values = ['', '（削除）旧部品', 'OLD-1', '', 1, '個', '非表示の行']
  sh.getRow(6).hidden = true
  const f1 = path.join(DL, 'crafted.xlsx'); await wb.xlsx.writeFile(f1)
  const wb2 = new ExcelJS.Workbook(); const cover = wb2.addWorksheet('表紙'); cover.addRow(['部品表']); cover.addRow(['案件', 'P-XXXX']); const b2 = wb2.addWorksheet('部品表'); b2.addRow(['品名', '形式', '員数']); b2.addRow(['リレー', 'MY4N', 2])
  const f2 = path.join(DL, 'cover-first.xlsx'); await wb2.xlsx.writeFile(f2)
  await fresh(page)
  const n = errors.length
  const r1 = await wizardFile('P-CRAFT', f1)
  const pc = (await ws(page)).projects.find((p) => p.id === 'P-CRAFT')
  const r2 = await wizardFile('P-COVER', f2)
  const pv = (await ws(page)).projects.find((p) => p.id === 'P-COVER')
  log('C crafted excel', { crafted: { ...r1, rows: pc?.rows.map((x) => [x.category, x.name, x.model, x.qtyNeeded, x.note]) }, coverFirst: { ...r2, rows: pv?.rows.map((x) => [x.name, x.model, x.qtyNeeded]) }, errors: errors.slice(n).map((e) => e.text.slice(0, 80)) })
}
// D: 選定記録・商社向け Excel が 300 行で出るか（時間）
{
  await fresh(page)
  await wizardCreate(page, 'P-X300', bom300())
  const t0 = Date.now()
  const files = await grab(async () => { await page.keyboard.press('Control+e'); await sleep(60); await page.keyboard.press('Enter') })
  const ms = Date.now() - t0
  let rows = null
  if (files[0]) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(files[0]); rows = wb.worksheets.map((s) => `${s.name}:${s.rowCount}`) }
  log('D excel 300', { ms, file: path.basename(files[0] ?? ''), sheets: rows })
}
save('11-io.json', out)
dumpErrors(errors, '11')
await browser.close()
