// x4: 指定系の依頼先（案件外の商社・一部の商社だけに依頼）、客先指定品の指定先の付け替え、見積済 n/m
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} des=${r.designated} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const a = await addRow('R080', '直販指定リレー', 'G3NA-210B', 'オムロン', '指定商社', 'オムロン直販')
const b = await addRow(a, '立花指定ブレーカ', 'NV32-SV 3P 20A', '三菱電機', '指定商社', '立花エレテック')
const c = await addRow(b, '客先指定スイッチ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
log('publish →', await t.publish('1'))
let p = await t.proj(); for (const id of [a, b, c]) log(show(p, id))
// 購買: ヘッダーの見積済 n/m
await t.role('purchasing')
const lampText = async () => (await page.getByTestId('quote-progress').textContent().catch(() => 'none'))
p = await t.proj()
const quotable = p.rows.filter((r) => !['cancelled', 'replaced', 'draft'].includes(r.status) && ['相見積', '指定商社', '客先指定品'].includes(r.procurement))
const quotedN = quotable.filter((r) => ['quoted', 'selected', 'formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status)).length
log('U4-04 lamp', await lampText(), 'hand', `${quotedN}/${quotable.length}`)
// (1) 依頼先を「因幡電機」だけにして依頼
const n0 = t.downloads.length
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel(); log('request options', JSON.stringify(pr?.options))
const iS1 = (pr?.options ?? []).findIndex((o) => o.startsWith('S1 ')); for (let k = 0; k < iS1; k++) await t.press('ArrowDown')
await t.press('Enter'); await page.waitForTimeout(1200); log('request(S1 only) →', await t.toast())
p = await t.proj(); for (const id of [a, b, c]) log(show(p, id))
const files = async (from) => { const out = []; for (const d of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const sh = wb.worksheets[0]; let sup = ''; const ids = []; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); out.push({ sup, ids }) } return out }
const f1 = await files(n0); log('files', JSON.stringify(f1))
const rb = p.rows.find((r) => r.id === b)
check('X4-1 因幡だけに依頼したとき、立花指定の行は依頼していないので見積中にしない', !(rb.status === 'quoting' && !p.quotes.some((q) => q.rowId === b && !q.stale)) && !(rb.status === 'quoting' && !f1.some((f) => f.ids.includes(b))), show(p, b))
// (2) 残りを「相見積先すべて」で依頼 → オムロン直販指定の行
const n1 = t.downloads.length
log('request(all) →', await t.requestRough())
p = await t.proj(); for (const id of [a, b, c]) log(show(p, id))
const f2 = await files(n1); log('files', JSON.stringify(f2))
const ra = p.rows.find((r) => r.id === a)
await t.press('9'); await t.goto(a); await t.shot('x4-quoting-without-request')
check('X4-2 指定先（オムロン直販）が案件の相見積先に無くても、依頼せずに見積中にしない', !(ra.status === 'quoting' && !f2.some((f) => f.ids.includes(a)) && !f1.some((f) => f.ids.includes(a))), show(p, a) + ' / files ' + JSON.stringify(f2.map((f) => f.sup)))
log('U4-04 lamp after requests', await lampText())
// (3) 客先指定品: 既定の依頼先が辞退 → 別の商社を指定先にできるか
p = await t.proj(); const cq = p.quotes.filter((q) => q.rowId === c && !q.stale).map((q) => q.supplierId); log('c requested to', cq)
const first = cq[0] ?? 'S2'; const other = first === 'S1' ? 'S2' : 'S1'
await t.press('6'); log('decline', await t.setCellKey(c, `q.leadDays@${first}`, '取扱なし')); await t.press('Escape')
p = await t.proj(); log('after decline', show(p, c))
log(await t.setCellKey(c, `q.unitPrice@${other}`, '1500')); await t.press('Escape'); log(await t.setCellKey(c, `q.leadDays@${other}`, '7')); await t.press('Escape')
p = await t.proj(); log('after other answers', show(p, c), 'ball', await t.cellText(c, 'ball'))
await t.press('1'); await t.goto(c); await t.press('Control+.'); await page.waitForTimeout(80); log('purch Ctrl+. on c', JSON.stringify((await t.panel())?.options)); await t.press('Escape')
await t.goto(c); await t.press(' '); await page.waitForTimeout(80); log('detail c', (await page.getByTestId('detail').textContent()).slice(0, 300)); await t.press(' ')
await t.role('design'); await t.press('1'); await t.goto(c); await t.press('Shift+A'); await page.waitForTimeout(80); log('design Shift+A on c', JSON.stringify(await t.panel())?.slice(0, 200), await t.toast()); await t.press('Escape')
await t.goto(c); await t.press('a'); await page.waitForTimeout(80); log('design a on c', await t.toast())
p = await t.proj(); log('final c', show(p, c))
await t.role('purchasing'); await t.press('1'); await t.goto(c); await t.shot('x4-customer-designated-stuck')
check('X4-3 客先指定品の既定の依頼先が辞退したとき、購買が別の商社を指定して進められる（§3.1 購買が 6 で 1 社を指定）', p.rows.find((r) => r.id === c).adoptedSupplierId === other, show(p, c))
summary(); await t.close()
