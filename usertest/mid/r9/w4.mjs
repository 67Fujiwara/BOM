// w4: 要再確認・再見積要の決め方（§4・§6.3）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
let p = await t.proj()
const full = p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3 && !p.issues.some((i) => i.rowId === r.id)).map((r) => r.id)
log('rows with 3 answers', full.slice(0, 10))
const [A, B, C, D] = full
const st = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)}:q=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.reconfirm ?? '']))}` }
// (a) A に代替提案（S2）→ 設計が適用 → 公開 → 購買 据え置き / 据え置き / 提案値
await t.press('1'); await t.goto(A); await t.press('Shift+I'); await t.press('a'); await page.waitForTimeout(60)
await page.getByTestId('issue-text').fill('同等品の提案'); await page.getByTestId('issue-text').press('Tab'); await page.waitForTimeout(40)
for (const [k, v] of Object.entries({ model: 'ALT-' + A, maker: 'オムロン', supplierId: 'S2', unitPrice: 100, leadDays: 3 })) await page.getByTestId('proposal-' + k).fill(String(v))
await page.getByTestId('proposal-model').press('Enter'); await page.waitForTimeout(60)
log('issue publish →', await t.publish())
await t.role('design'); await t.press('1'); await t.goto(A); await t.colKey('model'); await t.press('Control+.'); await page.waitForTimeout(80)
log('Ctrl+. A', JSON.stringify((await t.panel())?.options)); await t.press('Enter'); await page.waitForTimeout(150); if ((await t.mode()) === 'edit') await t.press('Escape')
p = await t.proj(); const nA = p.rows.find((r) => r.replaces === A).id; log('new', nA)
const pubA = await t.publish(); log('publish →', pubA)
if (/重複/.test(pubA)) { await t.goto(nA); await t.colKey('ref'); await t.press('x'); log('publish(after x) →', await t.publish()) }
await t.role('purchasing'); await t.press('5')
async function pick(id, label) { await t.goto(id); await t.press('Control+.'); await page.waitForTimeout(60); const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes(label)); if (i < 0) { log('NO OPTION', label, o); await t.press('Escape'); return } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80) }
await pick(nA, '因幡電機: 据え置き'); await pick(nA, 'ミスミ: 据え置き'); await pick(nA, '立花エレテック: 提案値で確定')
p = await t.proj(); log('(a)', st(p, nA))
check('W4-1 全社の回答がある行の置換で 据え置き・提案値 → 見積済', p.rows.find((r) => r.id === nA).status === 'quoted', st(p, nA))
await t.role('design'); await t.goto(nA); await t.press('a'); await page.waitForTimeout(60); log('design a →', await t.toast())
// (b) B: 置換（r）→ 公開 → 購買 再見積（S1）・据え置き（S2,S3）→ 概算見積を依頼で S1 に頼めるか
log('r', B, await t.replace(B, 'NEW-' + B))
p = await t.proj(); const nB = p.rows.find((r) => r.replaces === B).id
await t.goto(nB); await t.colKey('ref'); await t.press('x')
log('publish →', await t.publish('2'))
await t.role('purchasing'); await t.press('5')
await pick(nB, '因幡電機: 再見積'); await pick(nB, '立花エレテック: 据え置き'); await pick(nB, 'ミスミ: 据え置き')
p = await t.proj(); log('(b)', st(p, nB))
const nDl = t.downloads.length
log('rough →', await t.requestRough())
p = await t.proj(); log('(b) after rough', st(p, nB), 'downloads', t.downloads.length - nDl)
const ExcelJS = (await import('/home/user/BOM/node_modules/exceljs/excel.js')).default
const inReq = []
for (const d of t.downloads.slice(nDl)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(d.name); const sh = wb.worksheets[0]; let sup = ''; sh.eachRow((r) => { const v = r.values.slice(1).join('|'); if (/商社|宛/.test(v) && !sup) sup = v.slice(0, 40); if (r.values[1] === nB) inReq.push(sup) }) }
log('(b) new row in request files:', JSON.stringify(inReq))
check('W4-2 要再確認で「再見積」を選んだ商社に、概算見積の依頼を出せる', inReq.length > 0, JSON.stringify(inReq))
// (c) 一括採用 → C（選定済）の型式を設計が変更 → 公開 → 再見積要 → 購買が 据え置き
await t.role('design'); log('bulk →', await t.bulk())
await t.press('1'); log(await t.setCellKey(C, 'model', 'CHG-' + C))
log('publish →', await t.publish('2'))
p = await t.proj(); log('(c) after publish', st(p, C))
await t.role('purchasing'); await t.press('9'); await t.goto(C); await t.press('Control+.'); await page.waitForTimeout(60); const oc = (await t.panel())?.options ?? []; log('(c) Ctrl+.', JSON.stringify(oc))
const ik = oc.findIndex((x) => x.includes('据え置き（旧見積')); for (let k = 0; k < ik; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(100)
p = await t.proj(); log('(c) after keep', st(p, C))
await t.role('design'); await t.goto(C); await t.press('a'); await page.waitForTimeout(60); log('(c) design a →', await t.toast())
p = await t.proj(); log('(c) after a', st(p, C))
check('W4-3 再見積要を「据え置き（旧見積を有効に戻す）」にすると選定できる状態に戻る', ['quoted', 'selected'].includes(p.rows.find((r) => r.id === C).status), st(p, C))
// (d) D（選定済）に購買が型式あいまい → 設計が型式を直す → 要再確認 → 購買 採用商社を 再見積
await t.role('purchasing'); await t.press('1'); await t.goto(D); await t.press('Shift+I'); await t.press('k'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('型式を正確に'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
log('issue →', await t.publish())
await t.role('design'); await t.press('1'); log(await t.setCellKey(D, 'model', 'FIX-' + D)); log('publish →', await t.publish())
p = await t.proj(); log('(d) after fix publish', st(p, D)); const adoptedD = p.rows.find((r) => r.id === D).adoptedSupplierId
await t.role('purchasing'); await t.press('5'); const name = (await t.ws()).suppliers.find((s) => s.id === adoptedD)?.name
for (const s of (await t.ws()).suppliers.filter((s) => ['S1', 'S2', 'S3'].includes(s.id))) await pick(D, `${s.name}: ${s.id === adoptedD ? '再見積' : '据え置き'}`)
p = await t.proj(); log('(d) after reconfirm (adopted', name, 'requote)', st(p, D))
const rD = p.rows.find((r) => r.id === D)
check('W4-4 採用商社を再見積にしたら、その商社の空の見積のまま選定済・採用が残らない', !(rD.adoptedSupplierId === adoptedD && rD.status === 'selected'), st(p, D))
// (d) 続き: 採用商社が新しい型式で回答
await t.press('6'); log(await t.setCellKey(D, 'q.unitPrice@' + adoptedD, '50000')); await t.press('Escape'); log(await t.setCellKey(D, 'q.leadDays@' + adoptedD, '5')); await t.press('Escape')
p = await t.proj(); log('(d) after answer', st(p, D), 'ball', await t.cellText(D, 'ball'))
await t.role('design'); await t.press('4'); log('(d) in design 4?', (await t.viewRows()).includes(D))
summary(); await t.close()
