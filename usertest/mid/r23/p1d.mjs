// p1d: 発注済・入荷済の行の商社 S1 を商社マスタから消したあと、画面の「採用」の列・詳細・選定記録 Excel・保管用 Excel で誰に発注したか分かるか（M21-05 の残り）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { importWs, errs } from './plib.mjs'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.bulk(); await t.role('purchasing'); await t.requestFormal()
let p = await t.proj(); const B = p.rows.find((r) => r.status === 'formalRequested' && r.adoptedSupplierId === 'S1' && r.procurement === '相見積' && !r.needDateFixed).id
const q = p.quotes.find((x) => x.rowId === B && x.supplierId === 'S1' && !x.stale)
await t.press('8'); await t.setCellKey(B, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(B, 'q.formalLeadDays@A', '10'); await t.press('Escape'); log('order', await t.order(B))
log('remove S1 →', await importWs(t, (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S1') }))
p = await t.proj(); log('B', h.show(p, B).slice(0, 140))
await t.role('purchasing'); await t.press('3'); const cell = await t.cellText(B, 'adopted'); log('grid 採用 =', JSON.stringify(cell))
check('P1D-1 発注済の行の画面の「採用」の列に、発注先が分かる文字（名前か ID）が出る', !!String(cell).trim(), JSON.stringify(cell))
const n0 = t.downloads.length; await t.cmd('選定記録を出力'); await page.waitForTimeout(1500)
const dl = t.downloads[n0]; if (dl) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let row = null; sh.eachRow((r) => { if (r.values[1] === B) row = r.values.slice(1) }); log('選定記録 row', JSON.stringify(row)); check('P1D-3 選定記録 Excel の「採用」に発注先が分かる文字が出る', !!row && !!String(row[3] ?? '').trim(), JSON.stringify(row)) } else check('P1D-3 選定記録のダウンロード', false, 'no download')
errs(t, 'P1D-9'); summary(); await t.close()
