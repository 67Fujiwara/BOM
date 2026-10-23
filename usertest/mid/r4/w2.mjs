// w2: 指定商社・客先指定品（§3.4）: 自動選定・依頼先・スコア・集計・集約・Excel
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const sups = (await t.ws()).suppliers.map((s) => `${s.id}:${s.name}:${(s.handledMakers ?? []).join('/')}`); log('suppliers', sups.join(' | '), 'project sups', p.supplierIds)
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} des=${r.designated} maker=${r.maker} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty} reason=${r.adoptReason ?? ''} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const fixedRows = p.rows.filter((r) => ['指定商社', '客先指定品'].includes(r.procurement)).map((r) => r.id); log('fixed rows in sample', fixedRows)
for (const id of fixedRows) log(show(p, id))
// 金額集計に含まれるか（ヘッダー概算 = 採用行の 単価×発注数 の合計 + 追加費用）
const money0 = await t.money(); log('money', money0)
const exp = p.rows.filter((r) => r.status !== 'cancelled' && r.status !== 'replaced' && !['支給品', '社内在庫'].includes(r.procurement) && r.adoptedSupplierId).reduce((s, r) => { const q = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale); return s + (q?.unitPrice ?? 0) * (r.orderQty ?? r.qtyNeeded) + (r.extraCost ?? 0) }, 0)
log('hand rough', exp)
check('W2-1 ヘッダー概算に指定系の行も含まれ、手計算と一致', money0.includes(exp.toLocaleString('ja-JP')), `${money0} vs ${exp}`)
// Shift+A のパネル（指定商社）
await t.press('1'); await t.goto('R045'); await t.press('Shift+A'); await page.waitForTimeout(80); log('Shift+A R045 →', JSON.stringify(await t.panel())?.slice(0, 200), await t.toast()); await t.press('Escape')
await t.goto('R045'); await t.press(' '); await page.waitForTimeout(80); log('R045 detail:', (await page.getByTestId('detail').textContent()).slice(0, 400)); await t.press(' ')
// 新しい行: 客先指定品（パナソニック）と指定商社（立花・名前で）
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  log(id, await t.setCellKey(id, 'model', model)); log(await t.setCellKey(id, 'maker', maker)); log(await t.setCellKey(id, 'procurement', proc)); if (des) log(await t.setCellKey(id, 'designated', des))
  log(await t.setCellKey(id, 'qtyNeeded', '4')); log(await t.setCellKey(id, 'ref', 'X' + id))
  return id
}
const k1 = await addRow('R080', '客先指定リレー', 'G2R-1 DC24', 'オムロン', '客先指定品', '客先承認 KS-1')
const k2 = await addRow(k1, '指定商社ブレーカ', 'NV32-SV 3P 15A', '三菱電機', '指定商社', '立花エレテック')
const k3 = await addRow(k2, '指定商社（誤記）', 'AB-1', 'オムロン', '指定商社', '立花エレテク')
p = await t.proj(); log('problems k3', await page.evaluate(async (id) => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const row = p.rows.find((x) => x.id === id); return r.checkRow(row, s.ws.rules, p).map((x) => x.severity + ':' + x.message) }, k3))
for (const id of ['R076', 'R077', 'R078', 'R079', 'R080', k1, k2, k3]) { await t.goto(id); await t.colKey('ref') }
log('publish →', await t.publish('1'))
p = await t.proj(); for (const id of [k1, k2, k3]) log(show(p, id))
// 購買: 概算見積を依頼 → 依頼先
await t.role('purchasing'); const n0 = t.downloads.length
log('request →', await t.requestRough())
await page.waitForTimeout(800)
const req = {}
for (const d of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const sh = wb.worksheets[0]; const ids = []; sh.eachRow((r) => { const v = r.values[1]; if (typeof v === 'string' && /^R\d+$/.test(v)) ids.push(v) }); req[d.suggested] = ids }
log('request files', JSON.stringify(req))
p = await t.proj(); for (const id of [k1, k2, k3]) log(show(p, id))
const qk1 = p.quotes.filter((q) => q.rowId === k1 && !q.stale).map((q) => q.supplierId), qk2 = p.quotes.filter((q) => q.rowId === k2 && !q.stale).map((q) => q.supplierId), qk3 = p.quotes.filter((q) => q.rowId === k3 && !q.stale).map((q) => q.supplierId)
check('W2-2 客先指定品はメーカ（オムロン）を扱う第 1 商社 1 社にだけ依頼', qk1.length === 1, qk1.join(','))
check('W2-3 指定商社（立花）は立花 1 社にだけ依頼', qk2.length === 1 && qk2[0] === 'S2', qk2.join(','))
log('W2-x 指定先の誤記（立花エレテク）の行の依頼先', qk3.join(','))
// 6 で回答: k1 の依頼先と、別の商社にも値を入れる（誤入力）
await t.press('6')
const s1 = qk1[0]
const other = ['S1', 'S2', 'S3'].find((x) => x !== s1)
log(await t.setCellKey(k1, `q.unitPrice@${other}`, '500')); await t.press('Escape'); log(await t.setCellKey(k1, `q.leadDays@${other}`, '3')); await t.press('Escape')
p = await t.proj(); log('after entering OTHER supplier first:', show(p, k1))
log(await t.setCellKey(k1, `q.unitPrice@${s1}`, '800')); await t.press('Escape'); log(await t.setCellKey(k1, `q.leadDays@${s1}`, '5')); await t.press('Escape')
log(await t.setCellKey(k2, 'q.unitPrice@S2', '12000')); await t.press('Escape'); log(await t.setCellKey(k2, 'q.leadDays@S2', '5')); await t.press('Escape')
log(await t.setCellKey(k2, 'q.unitPrice@S1', '9000')); await t.press('Escape'); log(await t.setCellKey(k2, 'q.leadDays@S1', '5')); await t.press('Escape')
p = await t.proj(); log(show(p, k1)); log(show(p, k2))
check('W2-4 客先指定品は指定（依頼）先の見積で選定済（スコアなし）', p.rows.find((r) => r.id === k1).adoptedSupplierId === s1 && p.rows.find((r) => r.id === k1).status === 'selected', show(p, k1))
check('W2-5 指定商社は指定先 S2 で選定済（安い S1 があっても）', p.rows.find((r) => r.id === k2).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === k2).status === 'selected', show(p, k2))
// 集約しても指定系は動かない
await t.role('design'); await t.cmd('商社を集約'); await page.waitForTimeout(150); let pn = await t.panel(); const opts = pn?.options ?? []; const i1 = opts.findIndex((o) => o.startsWith('因幡電機 ::')); log('consolidate', opts[i1]); for (let i = 0; i < i1; i++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); log('apply →', await t.toast())
p = await t.proj(); log(show(p, k1)); log(show(p, k2)); log(show(p, 'R045')); log(show(p, 'R034'))
check('W2-6 集約（因幡のみ）でも指定商社・客先指定品の採用は変わらない', p.rows.find((r) => r.id === k2).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === 'R045').adoptedSupplierId === 'S2')
// 正式見積 → 発注
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); log(show(p, k1), JSON.stringify(p.quotes.find((q) => q.rowId === k1 && q.supplierId === s1 && !q.stale)?.formalRequestNo)); log(show(p, 'R034'))
await t.press('8'); log(await t.setCellKey(k1, 'q.formalPrice@A', '800')); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o k1 →', await t.order(k1)); log('o R034 →', await t.order('R034'))
p = await t.proj(); log(show(p, k1)); log(show(p, 'R034'))
check('W2-7 客先指定品を正式見積 → 発注まで進められる', p.rows.find((r) => r.id === k1).ordered)
// 商社向け Excel（指定先の商社だけに出るか）
const exp2 = async (label) => { const before = t.downloads.length; await t.press('Control+e'); await page.waitForTimeout(100); const o = (await t.panel()).options; const i = o.findIndex((x) => x.includes(label)); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); for (let k = 0; k < 40 && t.downloads.length === before; k++) await page.waitForTimeout(100); const d = t.downloads.at(-1); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const sh = wb.getWorksheet('BOM') ?? wb.worksheets[0]; const ids = []; sh.eachRow((r, n) => { if (n > 1) ids.push(r.values[1]) }); return { name: d.suggested, ids, hdr: sh.getRow(1).values.slice(1), sheets: wb.worksheets.map((s) => s.name), opts: o } }
const xs1 = await exp2('商社向け: 因幡'); log('export options', JSON.stringify(xs1.opts)); log('S1 file', xs1.name, xs1.ids.length, 'has k2(立花指定)?', xs1.ids.includes(k2), 'has R045?', xs1.ids.includes('R045'), 'hdr', xs1.hdr.join('|'))
const xs2 = await exp2('商社向け: 立花'); log('S2 file', xs2.name, xs2.ids.length, 'has k2?', xs2.ids.includes(k2), 'has R045?', xs2.ids.includes('R045'))
check('W2-8 商社向け（因幡）に立花指定の行が出ない', !xs1.ids.includes(k2) && !xs1.ids.includes('R045'))
check('W2-9 商社向け（立花）に立花指定の行が出る', xs2.ids.includes(k2) && xs2.ids.includes('R045'))
summary(); await t.close()
