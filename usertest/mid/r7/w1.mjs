// w1: 単一の発注・入荷ガード、差分超過 d/q → 対策不成立 → 受入 → 発注、i の迂回、Undo
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing')
log('formal →', await t.requestFormal())
let p = await t.proj()
const qOf = (id) => { const r = p.rows.find((x) => x.id === id); return { r, q: p.quotes.find((q) => q.rowId === id && q.supplierId === r.adoptedSupplierId && !q.stale) } }
const oq = (r) => r.orderQty ?? r.qtyNeeded
const fr = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG).map((x) => ({ id: x.id, ...qOf(x.id) })).sort((a, b) => b.q.unitPrice * oq(b.r) - a.q.unitPrice * oq(a.r))
const [A, B, C, D] = fr.slice(1, 5).map((x) => x.id)
log('rows A(d) B(q) C(ok) D(accept)', A, B, C, D)
await t.press('8')
for (const id of [A, B, D]) { const o = qOf(id); log(id, await t.setCellKey(id, 'q.formalPrice@A', String(Math.round(o.q.unitPrice * 1.3)))) }
{ const o = qOf(C); log(C, await t.setCellKey(C, 'q.formalPrice@A', String(o.q.unitPrice))) }
await t.press('Escape')
p = await t.proj(); log('flags', [A, B, C, D].map((id) => id + ':' + p.rows.find((r) => r.id === id).status + ':' + JSON.stringify(p.rows.find((r) => r.id === id).flags)).join(' | '))
// PM: A=d, B=q, D=受入
await t.role('pm'); await t.press('7')
let res = await t.decide(A, 'd', '安い代替を'); log('d', A, res.toast)
res = await t.decide(B, 'q', ''); log('q', B, res.toast)
res = await t.decide(D, 'y', '受入'); log('y', D, res.toast, JSON.stringify(res.prompt?.extra))
// 購買: o / i
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
log('o A →', await t.order(A)); log('o B →', await t.order(B)); log('o C →', await t.order(C)); log('o D →', await t.order(D))
await t.goto(A); await t.colKey('received'); await t.press('i'); await page.waitForTimeout(60); log('i A →', await t.toast())
p = await t.proj()
check('W1-1 d / q を出した行は o でも i でも発注できない', !p.rows.find((r) => r.id === A).ordered && !p.rows.find((r) => r.id === B).ordered)
check('W1-2 受入した差分超過の行・閾値内の行は発注できる', p.rows.find((r) => r.id === C).ordered && p.rows.find((r) => r.id === D).ordered, [C, D].map((id) => p.rows.find((r) => r.id === id).status).join(','))
// 設計: A に 代替なし, B に 数量変更不可
await t.role('design'); await t.press('1')
for (const id of [A, B]) {
  await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  const pn = await t.panel(); log(id, 'design panel', JSON.stringify(pn?.options))
  await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし／減らせない'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape')
}
p = await t.proj(); log('after 7:', [A, B].map((id) => id + ':' + JSON.stringify(p.rows.find((r) => r.id === id).flags) + ' issues=' + p.issues.filter((i) => i.rowId === id).map((i) => i.id + ':' + i.kind + ':' + i.status).join(',')).join(' | '))
log('ball A', await t.cellText(A, 'ball'), 'B', await t.cellText(B, 'ball'))
// PM: A 受入（対策不成立）、B 受入
await t.role('pm'); await t.press('7')
res = await t.decide(A, 'Shift+Y', '価格を受け入れる'); log('受入 A', res.toast, JSON.stringify(res.prompt?.extra))
res = await t.decide(B, 'Shift+Y', '数量そのまま受入'); log('受入 B', res.toast)
p = await t.proj(); log('after 受入:', [A, B].map((id) => id + ':' + p.rows.find((r) => r.id === id).status + JSON.stringify(p.rows.find((r) => r.id === id).flags) + ' issues=' + p.issues.filter((i) => i.rowId === id).map((i) => i.id + ':' + i.kind + ':' + i.status).join(',') + ' ball=').join(' | '))
log('ball A', await t.cellText(A, 'ball'), 'B', await t.cellText(B, 'ball'))
const pm7 = await t.viewRows(); log('PM 7 has A,B', pm7.includes(A), pm7.includes(B))
// 購買: 発注
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
const oa = await t.order(A); const ob = await t.order(B); log('o A after 受入 →', oa); log('o B after 受入 →', ob)
p = await t.proj()
check('W1-3 対策不成立を PM が受入れたら発注できる（§9.1）', p.rows.find((r) => r.id === A).ordered && p.rows.find((r) => r.id === B).ordered, oa + ' / ' + ob)
await t.press('4'); log('purchasing 4 has A/B?', (await t.viewRows()).filter((x) => [A, B].includes(x)))
await t.shot('w1-order-after-accept')
// PM の 7 で A を開くと？ x で回答を受け入れられるか
await t.role('pm'); await t.press('7'); await t.goto(A); log('PM status bar on A:', (await t.status()).slice(0, 160))
await t.press('Enter'); await page.waitForTimeout(80); log('PM Enter on A:', JSON.stringify(await t.panel())?.slice(0, 200), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.goto(A); await t.press('x'); await page.waitForTimeout(80); log('PM x on A →', await t.toast())
p = await t.proj(); log('A issue after PM x', p.issues.filter((i) => i.rowId === A).map((i) => i.id + ':' + i.status + ':' + (i.resolution ?? '')))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
log('o A after PM x →', await t.order(A))
// Undo（PM の受入を Ctrl+Z）: 購買の発注は残る？
await t.role('pm'); await t.press('Control+z'); await page.waitForTimeout(80); log('PM Ctrl+Z →', await t.toast())
p = await t.proj(); log('A after PM undo', p.rows.find((r) => r.id === A).status, JSON.stringify(p.rows.find((r) => r.id === A).flags), p.issues.filter((i) => i.rowId === A).map((i) => i.status))
summary(); await t.close()
