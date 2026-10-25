// d5: 型式変更の再見積要を「据え置き（旧見積を有効に戻す）」にする（§4・§16。ラウンド10 の修正で型式変更の公開時に空の枠を作らなくなった後）
// A: 選定済の行 / B: 見積済（未選定）の行
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '据え置きA', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '据え置きB', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('request →', (await h.requestTo(null)).msg)
await t.press('6'); for (const id of [A, B]) for (const [sid, pr, ld] of [['S1', 1000, 5], ['S2', 1100, 6], ['S3', 1200, 7]]) await h.q(id, sid, pr, ld); await t.press('Escape')
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('a'); await page.waitForTimeout(80); log('A a →', await t.toast())
let p = await t.proj(); for (const id of [A, B]) log('before', h.show(p, id), '|', await h.status(id))
// 型式の変更（表記修正ではない）→ 公開
await t.setCellKey(A, 'model', 'G2R-1-S DC24'); await t.setCellKey(B, 'model', 'G2R-2-S DC24')
log('publish change →', await t.publish('2'))
p = await t.proj(); for (const id of [A, B]) log('after change', h.show(p, id), '|', await h.status(id))
// 購買: 9 で Ctrl+. → 据え置き
await t.role('purchasing'); await t.press('9')
for (const id of [A, B]) {
  await t.goto(id); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const o = (await t.panel())?.options ?? []; log(id, 'Ctrl+.', JSON.stringify(o))
  const i = o.findIndex((x) => x.includes('据え置き（旧見積')); if (i < 0) { await t.press('Escape'); continue }
  for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); log(id, 'keep →', await t.toast())
}
p = await t.proj(); for (const id of [A, B]) log('after keep', h.show(p, id), '|', await h.status(id), 'ball', await h.ballOf(id))
const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
check('D5-1 選定済だった A を据え置きにすると旧見積（3 社）が有効に戻り、見積済（選び直し）か選定済になる', ['quoted', 'selected'].includes(rA.status) && p.quotes.filter((q) => q.rowId === A && !q.stale && q.unitPrice != null).length === 3, h.show(p, A))
check('D5-2 見積済だった B を据え置きにすると旧見積が有効に戻り、選定者が選べる', rB.status === 'quoted' && p.quotes.filter((q) => q.rowId === B && !q.stale && q.unitPrice != null).length === 3, h.show(p, B))
await t.role('design'); await t.press('1'); for (const id of [A, B]) { await t.goto(id); await t.press('a'); await page.waitForTimeout(80); log(id, 'design a →', await t.toast()) }
await t.role('purchasing'); await t.press('4'); const p4 = await t.viewRows(); log('purch 4 has A/B', p4.includes(A), p4.includes(B))
const rq = await h.requestTo(null); log('request all →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
p = await t.proj(); for (const id of [A, B]) log('final', h.show(p, id), '|', await h.status(id))
check('D5-3 据え置きのあとに行き止まりにならない（選定できるか、再見積を依頼できる）', ['quoted', 'selected'].includes(p.rows.find((r) => r.id === A).status) || rq.f.some((f) => f.ids.includes(A)), rq.msg)
await t.shot('d5')
summary(); await t.close()
