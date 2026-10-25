// f5: 正式見積済の行で必要数を変える → 据え置き → 再発行前に発注できるか / 再発行の依頼書（Rev+1・差分シート）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
const Y = fr[1].id
const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === fr[1].adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('before', h.show(p, Y), 'qty', p.rows.find((r) => r.id === Y).qtyNeeded, 'oq', p.rows.find((r) => r.id === Y).orderQty)
await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === Y).qtyNeeded; await t.setCellKey(Y, 'qtyNeeded', String(q0 * 5))
log('publish →', await t.publish('2'))
await t.role('purchasing'); await t.press('9')
await t.goto(Y); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const o = (await t.panel())?.options ?? []
const i = o.findIndex((x) => x.includes('据え置き（旧見積')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); log('keep →', await t.toast())
p = await t.proj(); log('after keep', h.show(p, Y), '|', await h.status(Y), 'qty', p.rows.find((r) => r.id === Y).qtyNeeded, 'oq', p.rows.find((r) => r.id === Y).orderQty)
await t.press('8'); log('chip', (await page.locator('.chip.warn').allTextContents()).join(' | '))
const n0 = t.downloads.length
log('formal again →', await t.requestFormal())
const sheets = []
for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(JSON.stringify(r.values).slice(0, 140))); sheets.push(dl.suggested + ' / ' + sh.name + ': ' + rows.slice(0, 8).join(' || ')) }) }
for (const s of sheets) log('xlsx', s)
p = await t.proj(); log('after formal again', h.show(p, Y), '|', await h.status(Y), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === Y && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null, q.prevFormalPrice ?? null])))
check('F5B-2 再発行の依頼書に差分シート（旧→新）が付く（§9.2）', sheets.some((s) => /差分|旧/.test(s)), sheets.map((s) => s.slice(0, 60)).join(' ; '))
await t.shot('f5b')
summary(); await t.close()
