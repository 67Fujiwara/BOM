// y4: 特急・分納の上限（U5-01）と決定の記録（詳細・社内 Excel）、購買から上限が見えるか
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const [L] = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)
log('L', L)
await t.role('pm'); await t.press('7')
async function tryE(cap) {
  await t.goto(L); await t.press('Enter'); await page.waitForTimeout(80); const panel = await t.panel()
  await t.press('e'); await page.waitForTimeout(80); const pr = await t.panel(); log('e prompt', pr?.title, JSON.stringify(pr?.extra))
  await t.promptFill('特急で間に合わせる'); if (cap != null) await t.extraFill('上限金額', cap)
  await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100)
  const after = await t.panel(); const msg = await t.toast()
  if (after) { await t.press('Escape'); await t.press('Escape'); if (await t.panel()) await t.press('Escape') }
  return { panel: panel?.options, after: after?.kind, error: after?.error, msg }
}
let r = await tryE(''); log('cap empty →', JSON.stringify(r))
p = await t.proj(); check('Y4-1 上限金額が空なら決まらない', !p.decisions.some((d) => d.rowId === L && d.kind === '特急・分納'), r.msg)
r = await tryE('たくさん'); log('cap text →', JSON.stringify(r))
p = await t.proj(); check('Y4-2 上限金額が数値でなければ決まらない', !p.decisions.some((d) => d.rowId === L && d.kind === '特急・分納'), r.msg)
r = await tryE('-5000'); log('cap negative →', JSON.stringify(r))
p = await t.proj(); check('Y4-3 上限金額が負なら決まらない', !p.decisions.some((d) => d.rowId === L && d.kind === '特急・分納'), r.msg)
r = await tryE('30,000'); log('cap 30,000 →', JSON.stringify(r))
p = await t.proj(); const d = p.decisions.find((x) => x.rowId === L && x.kind === '特急・分納'); log('decision', JSON.stringify(d))
check('Y4-4 上限 30,000 で決まり、決定に金額が残る', d?.payload?.amount === 30000)
// 詳細
await t.press('1'); await t.goto(L); await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); const k = det.indexOf('決定・履歴'); log('PM detail', det.slice(k, k + 250)); await t.press(' ')
check('Y4-5 行の詳細（Space）に上限金額が出る', /30,000/.test(det.slice(k)))
// 社内 Excel
const nd = t.downloads.length; await t.press('Control+e'); await page.waitForTimeout(100); await t.press('1'); for (let i = 0; i < 40 && t.downloads.length === nd; i++) await page.waitForTimeout(100)
{ const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(t.downloads.at(-1).name); const sh = wb.worksheets.find((s) => /変更点/.test(s.name)); const rows = []; let hdr; sh?.eachRow((rr, n) => { const v = rr.values.slice(1).join('|'); if (n === 1) hdr = v; if (v.includes(L)) rows.push(v) }); log('Excel 変更点 hdr', hdr); log('Excel rows', JSON.stringify(rows)); check('Y4-6 社内 Excel の変更点に上限金額が出る', rows.some((x) => /30,000/.test(x) && /特急/.test(x)), JSON.stringify(rows)) }
// 購買: 3 で上限が見えるか、追加費用を上限超で入れたとき
await t.role('purchasing'); await t.press('3'); await t.goto(L); const sb = (await t.status()); log('purch status bar on L (3)', sb.slice(0, 200))
await t.press(' '); await page.waitForTimeout(80); const det2 = await page.getByTestId('detail').textContent(); await t.press(' ')
log('purch sees cap in detail?', /30,000/.test(det2))
await t.showCol('extraCost', 'extraCostKind'); const ec = await t.setCellKey(L, 'extraCost', '45000'); log('extraCost 45000 →', ec); await t.press('Escape')
p = await t.proj(); log('L extraCost', p.rows.find((x) => x.id === L).extraCost, 'flags', JSON.stringify(p.rows.find((x) => x.id === L).flags))
await t.press('4'); log('purch 4 has L?', (await t.viewRows()).includes(L)); await t.role('pm'); await t.press('7'); log('PM 7 has L?', (await t.viewRows()).includes(L))
await t.role('purchasing'); await t.press('3'); await t.goto(L); await t.shot('y4-extra-over-cap')
summary(); await t.close()
