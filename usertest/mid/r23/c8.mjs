// c8: 指定商社の行を相見積に切り替える（指定先の回答で選定済になっていた行・まだ見積中の行）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '指定→相見積A', 'G2R-1 DC24', 'オムロン', '指定商社', '立花エレテック')
const B = await h.addRow(A, '指定→相見積B', 'G2R-2 DC24', 'オムロン', '指定商社', '立花エレテック')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('request all →', (await h.requestTo(null)).msg)
await t.press('6'); await h.q(A, 'S2', 1500, 5); await t.press('Escape')
let p = await t.proj(); log('A', h.show(p, A)); log('B', h.show(p, B))
await t.role('design'); await t.press('1')
for (const id of [A, B]) { await t.setCellKey(id, 'procurement', '相見積') }
log('publish switch →', await t.publish('1'))
p = await t.proj(); for (const id of [A, B]) log('after switch', h.show(p, id), '|', await h.status(id), 'ball', await h.ballOf(id), 'targets', JSON.stringify(p.rows.find((r) => r.id === id).quoteTargets))
const rA = p.rows.find((r) => r.id === A)
check('C8-1 相見積に変えた A は「指定先（固定）」の採用のまま選定済に残らない（相見積先の見積で選び直す）', rA.adoptReason !== '指定先（固定）', h.show(p, A))
await t.role('purchasing'); const r2 = await h.requestTo(null); log('all →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
p = await t.proj(); for (const id of [A, B]) log('after all', h.show(p, id), '|', await h.status(id))
check('C8-2 相見積に変えた B（見積中）の残りの相見積先（因幡・ミスミ）に依頼書を出せる', r2.f.some((f) => f.ids.includes(B)), r2.msg)
check('C8-3 相見積に変えた A の残りの相見積先に依頼書を出せる', r2.f.some((f) => f.ids.includes(A)), r2.msg)
summary(); await t.close()
