// a8: 相見積の行を 1 社（因幡）だけに依頼 → あとから立花・ミスミに依頼できるか（§7「相見積先の確定・概算依頼は購買」）
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} maker=${r.maker} st=${r.status} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const A = await addRow('R080', 'リレー追加', 'G2R-1 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
let p = await t.proj(); log('after publish', show(p, A))
await t.role('purchasing')
const files = async (from) => { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let sup = ''; const ids = []; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); out.push({ sup, ids }) } return out }
async function requestTo(prefix) { const n0 = t.downloads.length; await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel(); const i = prefix ? pr.options.findIndex((o) => o.startsWith(prefix + ' ')) : 0; for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(1300); return { msg: await t.toast(), f: await files(n0) } }
const r1 = await requestTo('S1'); p = await t.proj(); log('S1 only →', r1.msg, JSON.stringify(r1.f.map((f) => [f.sup, f.ids.includes(A)]))); log(show(p, A), 'status cell', await t.cellText(A, 'status'))
const r2 = await requestTo('S2'); p = await t.proj(); log('S2 only →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(A)])))
const r3 = await requestTo(null); p = await t.proj(); log('all →', r3.msg, JSON.stringify(r3.f.map((f) => [f.sup, f.ids.includes(A)])))
const toS2 = r2.f.some((f) => f.sup === '立花エレテック' && f.ids.includes(A)) || r3.f.some((f) => f.sup === '立花エレテック' && f.ids.includes(A))
check('A8-1 因幡だけに依頼した相見積の行を、あとで立花に依頼できる（依頼書に入る）', toS2, `${r2.msg} / ${r3.msg}`)
// 因幡が答えても、立花・ミスミの回答待ちのまま？
await t.press('6'); await t.setCellKey(A, 'q.unitPrice@S1', '1500'); await t.press('Escape'); await t.setCellKey(A, 'q.leadDays@S1', '5'); await t.press('Escape')
p = await t.proj(); log('after S1 answer', show(p, A), 'status cell', await t.cellText(A, 'status'), 'rule', p.settings.quoteCompleteRule)
await t.press('9'); log('9 has A', (await t.viewRows()).includes(A)); await t.press('4'); log('purch 4 has A', (await t.viewRows()).includes(A))
check('A8-2 依頼していない商社の回答を待って見積中に止まらない', p.rows.find((r) => r.id === A).status === 'quoted' || toS2, show(p, A))
summary(); await t.close()
