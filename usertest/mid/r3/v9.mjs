// v9: 5 変更あり の確認（自分が未確認）、再見積要の行の正式依頼 → 概算依頼、案件納期変更の再発行（差分シート）、取消が公開前に購買の金額から消える
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(300)
await t.press('1'); log(await t.setCellKey('R025', 'qtyNeeded', '5')); log(await t.setCellKey('R026', 'note', '変更'))
await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
log('publish →', await t.toast())
// 5: 購買が R026 を x で確認 → PM / 設計の 5 から消えるか
await t.role('purchasing'); await t.press('5'); log('purchasing 5 has R025,R026', (await t.viewRows()).filter((x) => ['R025', 'R026'].includes(x)))
await t.goto('R026'); await t.press('x'); await page.waitForTimeout(60); log('x →', await t.toast())
await t.role('pm'); await t.press('5'); const pm5 = await t.viewRows(); log('PM 5 has R026?', pm5.includes('R026'))
check('M3 5 変更あり は「自分が」未確認の差分（購買の確認で PM の 5 から消えない）', pm5.includes('R026'))
// 再見積要の行を正式依頼 → 概算依頼
await t.role('purchasing')
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100); await t.press('2'); await page.waitForTimeout(1500)
let r = await t.row('R025'); log('R025 after formal', r.status, JSON.stringify(r.flags))
await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800); log('rough →', await t.toast())
r = await t.row('R025'); log('R025 after rough', r.status, r.adoptedSupplierId, JSON.stringify(r.flags))
// 案件納期変更 → 再発行対象 → 正式見積を依頼（Rev+1 の差分シート）
await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80); await t.press('ArrowDown'); await t.press('Enter')
const addD = (d, n) => new Date(new Date(d).getTime() + n * 86400e3).toISOString().slice(0, 10)
const p0 = await t.proj(); await page.getByTestId('settings-input').fill(addD(p0.dueDate, 7)); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(150)
pn = await t.panel(); log('impact', JSON.stringify(pn?.lines)); await t.press('Enter'); await page.waitForTimeout(60); await t.promptFill('客先都合で後ろ倒し'); await t.press('Enter'); await page.waitForTimeout(100)
pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
let p = await t.proj(); const reissue = p.rows.filter((x) => x.flags.reissue).map((x) => x.id); log('reissue rows', reissue.length, 'due', p.dueDate)
await t.role('purchasing'); await t.press('8'); log('8 header/toolbar:', (await page.locator('.toolbar, .viewbar').first().textContent().catch(() => '')).slice(0, 120))
const nBefore = t.downloads.length
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100); pn = await t.panel(); log('reissue confirm', pn?.title); await t.press('2'); await page.waitForTimeout(2000)
log('reissue →', await t.toast(), 'downloads', t.downloads.length - nBefore)
const dl = t.downloads.at(-1); if (dl) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); log('sheets', wb.worksheets.map((s) => s.name)); const d = wb.getWorksheet('差分'); const rows = []; d?.eachRow((x) => rows.push(x.values.slice(1).join('|'))); log('差分 sheet', rows.slice(0, 6)); check('S 再発行の依頼書に差分シート（必要納期 旧→新）', rows.some((x) => /必要納期\|\d{4}-\d\d-\d\d\|\d{4}/.test(x)), rows.slice(0, 3).join(' / ')) }
// 取消が公開前に購買の金額から消える
await t.role('purchasing'); const m0 = await t.money()
await t.role('design'); await t.press('1'); await t.goto('R047'); await t.press('Shift+Delete'); await page.waitForTimeout(60)
await t.role('purchasing'); const m1 = await t.money(); log('purchasing money before/after design cancel (unpublished):', m0, '→', m1)
check('M3 未公開の取消で購買のヘッダー金額が変わらない', m0 === m1)
summary(); await t.close()
