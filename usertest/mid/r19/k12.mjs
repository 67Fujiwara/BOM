// k12: 取引停止の商社（ミスミ）と出力・依頼のパネル（購買）
//   Ctrl+E の「商社向け: ミスミ」、概算見積の依頼先の一覧、一括採用（ミスミを採らない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)); await t.open('design', ws)
log('bulk →', await t.bulk())
let p = await t.proj(); const ms = p.rows.filter((r) => r.adoptedSupplierId === 'S3').map((r) => r.id); log('adopted ミスミ after bulk', JSON.stringify(ms))
check('K12-1 取引停止のミスミは一括採用で採らない', ms.length === 0, JSON.stringify(ms))
await t.role('purchasing'); await page.keyboard.press('Control+e'); await page.waitForTimeout(150); const ex = await t.panel(); await t.press('Escape'); log('Ctrl+E options', JSON.stringify(ex?.options ?? []))
const mi = (ex?.options ?? []).findIndex((o) => /ミスミ/.test(o))
let rowsM = []
if (mi >= 0) {
  const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < mi; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) rowsM.push(v[0]) }) }
  log('ミスミ向け Excel rows', rowsM.length, '| toast', await t.toast())
}
check('K12-2 取引停止の商社の「商社向け」Excel は出さないか、取引停止と分かる', mi < 0 || /取引停止|取引不可/.test(ex.options[mi]) || rowsM.length === 0, mi >= 0 ? ex.options[mi] + ' rows=' + rowsM.length : 'none')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(120); const rq = await t.panel(); await t.press('Escape'); log('rough panel options', JSON.stringify(rq?.options ?? []))
const ri = (rq?.options ?? []).findIndex((o) => /ミスミ/.test(o))
check('K12-3 概算見積の依頼先の一覧で、取引停止のミスミは選べないか取引停止と分かる', ri < 0 || /取引停止|取引不可/.test(rq.options[ri]), ri >= 0 ? rq.options[ri] : 'none')
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
