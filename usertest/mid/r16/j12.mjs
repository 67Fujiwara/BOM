// j12: 商社向け Excel（Ctrl+E →「商社向け: 因幡電機（その商社に頼む行だけ）」）に、因幡に頼まなくなった行が出ないか
//   X: 支給品、Y: 社内在庫、Z: 別の商社（立花）の指定商社、C: 取消 ― いずれも元は因幡で採用・正式依頼中
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function excelPick(label) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(150); const pn = await t.panel(); const i = (pn?.options ?? []).findIndex((o) => o.includes(label)); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); return { opts: pn?.options, sh: await sheetsOf(n0), toast: await t.toast() } }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'formalRequested' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const [X, Y, Z, C] = fr.slice(0, 4).map((r) => r.id); log('X Y Z C', X, Y, Z, C)
await t.role('design'); await t.press('1'); await t.showCol('procurement', 'designated')
await t.setCellKey(X, 'procurement', '支給品'); await t.setCellKey(Y, 'procurement', '社内在庫'); await t.setCellKey(Z, 'procurement', '指定商社'); await t.setCellKey(Z, 'designated', '立花エレテック')
await t.goto(C); await t.press('Shift+Delete'); await page.waitForTimeout(100); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('Enter'); await page.waitForTimeout(80) } }
log('publish →', await t.publish('1'))
p = await t.proj(); for (const id of [X, Y, Z, C]) log('after', h.show(p, id), '|', await h.status(id))
await t.role('purchasing')
const e1 = await excelPick('商社向け: 因幡電機'); log('options', JSON.stringify(e1.opts)); log('toast', e1.toast)
const bom = e1.sh.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows); const head = bom[0] ?? []
const ids = bom.slice(1).map((r) => r[0])
log('因幡 file sheets', JSON.stringify(e1.sh.map((s) => s.sh)), 'head', JSON.stringify(head), 'rows', ids.length, 'has X,Y,Z,C', [X, Y, Z, C].map((id) => ids.includes(id)))
check('J12-1 因幡向けの Excel に、支給品・社内在庫・立花の指定商社・取消にした行が出ない（因幡に頼む行だけ）', ![X, Y, Z, C].some((id) => ids.includes(id)), JSON.stringify([X, Y, Z, C].map((id) => [id, ids.includes(id)])))
check('J12-2 商社向けに価格・採用・状態の列と社内シートが無い', !head.some((x) => /単価|採用|金額|状態|ボール/.test(String(x))) && e1.sh.every((s) => s.sh === 'BOM'), JSON.stringify({ head, sheets: e1.sh.map((s) => s.sh) }))
const e2 = await excelPick('商社向け: 全商社共通'); const ids2 = e2.sh.filter((s) => s.sh === 'BOM').flatMap((s) => s.rows).slice(1).map((r) => r[0])
log('INFO 全商社共通 has X(支給品),Y(社内在庫),C(取消)', ids2.includes(X), ids2.includes(Y), ids2.includes(C))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j12')
summary(); await t.close()
