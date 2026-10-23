// ラウンド8: 新しい形の Excel（ガイドの「ファイルから」）。非表示の列・非表示のシート・表示形式（先頭の 0）・inlineStr・ふりがな（rPh）・
// 書式だけの 100 万行・日付になった型式
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import JSZip from '/home/user/BOM/node_modules/jszip/lib/index.js'
import { launch, fresh, palette, sleep, toastNow, ws, dumpErrors } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib15.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r15/dl', f)
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); await build(wb); await wb.xlsx.writeFile(P(name)) }
await wbFile('hidden-col-dup.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'OLD-111', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'OLD-222', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(2).hidden = true })
await wbFile('hidden-col-old.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '旧型式', '型式', 'メーカ', '員数']); s.addRow(['リレー', 'OLD-111', 'MY4N-D2 DC24', 'オムロン', 12]); s.addRow(['端子台', 'OLD-222', 'XW2B-20G4', 'オムロン', 2]); s.getColumn(2).hidden = true })
await wbFile('hidden-qty-col.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '数量', '数量']); s.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 999, 12]); s.addRow(['端子台', 'XW2B-20G4', 'オムロン', 999, 2]); s.getColumn(4).hidden = true })
await wbFile('hidden-sheet.xlsx', (wb) => { const a = wb.addWorksheet('BOM_v1', { state: 'hidden' }); a.addRow(['部品名', '型式', 'メーカ', '員数']); a.addRow(['リレー', 'OLD-111', 'オムロン', 99]); const b = wb.addWorksheet('BOM'); b.addRow(['部品名', '型式', 'メーカ', '員数']); b.addRow(['リレー', 'MY4N-D2 DC24', 'オムロン', 12]); b.addRow(['端子台', 'XW2B-20G4', 'オムロン', 2]) })
await wbFile('numfmt-zero.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); const r = s.addRow(['チップ抵抗', 805, 'KOA', 1000]); r.getCell(2).numFmt = '0000'; r.getCell(4).numFmt = '#,##0'; const r2 = s.addRow(['コネクタ', 12345, 'JST', 2]); r2.getCell(2).numFmt = '"B"00000'; const r3 = s.addRow(['ダイオード', 0.5, 'ROHM', 1]); r3.getCell(2).numFmt = '0%' })
await wbFile('date-model.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); const r = s.addRow(['スペーサ', new Date(Date.UTC(2026, 0, 2)), 'ヒロスギ', 4]); r.getCell(2).numFmt = 'm"月"d"日"' })
// inlineStr とふりがな（rPh）は XML を直接
{
  await wbFile('base.xlsx', (wb) => { const s = wb.addWorksheet('BOM'); s.addRow(['部品名', '型式', 'メーカ', '員数']); s.addRow(['抵抗', 'RK73', 'KOA', 3]) })
  const zip = await JSZip.loadAsync(fs.readFileSync(P('base.xlsx')))
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    '<row r="1"><c r="A1" t="inlineStr"><is><t>部品名</t></is></c><c r="B1" t="inlineStr"><is><t>型式</t></is></c><c r="C1" t="inlineStr"><is><t>メーカ</t></is></c><c r="D1" t="inlineStr"><is><t>員数</t></is></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>リレー</t></is></c><c r="B2" t="inlineStr"><is><t>MY4N-D2 DC24</t></is></c><c r="C2" t="inlineStr"><is><t>オムロン</t></is></c><c r="D2"><v>12</v></c></row>' +
    '</sheetData></worksheet>'
  zip.file('xl/worksheets/sheet1.xml', sheet)
  fs.writeFileSync(P('inlinestr.xlsx'), await zip.generateAsync({ type: 'nodebuffer' }))
  const z2 = await JSZip.loadAsync(fs.readFileSync(P('base.xlsx')))
  const ss = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">' +
    '<si><t>部品名</t><rPh sb="0" eb="3"><t>ブヒンメイ</t></rPh><phoneticPr fontId="1"/></si><si><t>型式</t><rPh sb="0" eb="2"><t>カタシキ</t></rPh><phoneticPr fontId="1"/></si>' +
    '<si><t>メーカ</t></si><si><t>員数</t><rPh sb="0" eb="2"><t>インズウ</t></rPh></si><si><t>抵抗</t><rPh sb="0" eb="2"><t>テイコウ</t></rPh><phoneticPr fontId="1"/></si><si><t>RK73</t></si><si><t>興亜</t><rPh sb="0" eb="2"><t>コウア</t></rPh></si></sst>'
  const sh = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2" t="s"><v>6</v></c><c r="D2"><v>3</v></c></row></sheetData></worksheet>'
  z2.file('xl/sharedStrings.xml', ss); z2.file('xl/worksheets/sheet1.xml', sh)
  const ct = await z2.file('[Content_Types].xml').async('string')
  if (!ct.includes('sharedStrings')) z2.file('[Content_Types].xml', ct.replace('</Types>', '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'))
  const rels = await z2.file('xl/_rels/workbook.xml.rels').async('string')
  if (!rels.includes('sharedStrings')) z2.file('xl/_rels/workbook.xml.rels', rels.replace('</Relationships>', '<Relationship Id="rIdSS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'))
  fs.writeFileSync(P('furigana.xlsx'), await z2.generateAsync({ type: 'nodebuffer' }))
  // 書式だけの行が 100 万行目まで（dimension A1:XFD1048576、空の <row> が 20 万）
  const z3 = await JSZip.loadAsync(fs.readFileSync(P('base.xlsx')))
  let rows = '<row r="1"><c r="A1" t="inlineStr"><is><t>部品名</t></is></c><c r="B1" t="inlineStr"><is><t>型式</t></is></c><c r="C1" t="inlineStr"><is><t>員数</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>リレー</t></is></c><c r="B2" t="inlineStr"><is><t>MY4N</t></is></c><c r="C2"><v>2</v></c></row>'
  const parts = [rows]; for (let i = 3; i < 200000; i++) parts.push(`<row r="${i}" s="1" customFormat="1"><c r="A${i}" s="1"/></row>`)
  parts.push('<row r="1048576" s="1" customFormat="1"/>')
  z3.file('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:XFD1048576"/><sheetData>' + parts.join('') + '</sheetData></worksheet>')
  fs.writeFileSync(P('styled-200k.xlsx'), await z3.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
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
  const rec = { f, loadMs, toast, preview: prev.slice(0, 300), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1000))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
for (const f of ['hidden-col-dup.xlsx', 'hidden-col-old.xlsx', 'hidden-qty-col.xlsx', 'hidden-sheet.xlsx', 'numfmt-zero.xlsx', 'date-model.xlsx', 'inlinestr.xlsx', 'furigana.xlsx', 'styled-200k.xlsx']) await tryWizard(f)
saveJson('r8-21-files5.json', out)
await browser.close()
