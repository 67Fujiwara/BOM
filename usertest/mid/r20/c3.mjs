// c3: 相見積先を案件設定で外す・足す（頼むつもりの商社との関係）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '電話で頼んだリレー', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '一部依頼リレー', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
// A: 依頼書なしで因幡の回答を手入力（頼むつもり: 因幡・立花・ミスミ）
await t.press('6'); await h.q(A, 'S1', 1500, 5); await t.press('Escape')
let p = await t.proj(); log('A', h.show(p, A), 'targets', JSON.stringify(p.rows.find((r) => r.id === A).quoteTargets))
// ミスミを相見積先から外す
log('supplierIds →', await h.setting('supplierIds', 'S1,S2', '相見積先の見直し')); p = await t.proj(); log('project suppliers', JSON.stringify(p.supplierIds))
const r1 = await h.requestTo(null); log('all →', r1.msg, 'options[0]', r1.options[0], JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
check('C3-1 相見積先から外したミスミには依頼書を出さない', !r1.f.some((f) => f.sup === 'ミスミ'), JSON.stringify(r1.f.map((f) => f.sup)))
await t.press('6'); await h.q(A, 'S2', 1400, 6); await h.q(B, 'S1', 900, 5); await h.q(B, 'S2', 950, 6); await t.press('Escape')
p = await t.proj(); const stA = p.rows.find((r) => r.id === A).status; log('A after S2', h.show(p, A), '|', await h.status(A)); log('B', h.show(p, B), '|', await h.status(B))
check('C3-2 (全社) 相見積先（因幡・立花）が答えた A は見積済（外したミスミを待たない）', stA === 'quoted', stA)
// 案件にオムロン直販を足す
log('supplierIds add →', await h.setting('supplierIds', 'S1,S2,S5', '相見積先の追加')); p = await t.proj(); log('project suppliers', JSON.stringify(p.supplierIds))
await t.role('design'); await t.press('1'); const C = await h.addRow(B, '追加後の行', 'G2R-1-S DC24', 'オムロン', '相見積'); log('publish C →', await t.publish('1'))
await t.role('purchasing'); const r2 = await h.requestTo(null); log('all after add →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B, C].includes(x))])))
p = await t.proj(); for (const id of [A, B, C]) log(h.show(p, id), '|', await h.status(id))
check('C3-3 足したあとに提出された行はオムロン直販にも頼む', r2.f.some((f) => f.sup === 'オムロン直販' && f.ids.includes(C)))
check('C3-4 見積済の A・B は足した商社のために見積中に戻らない（ラウンド9 の修正）', ['quoted'].includes(p.rows.find((r) => r.id === B).status) || p.rows.find((r) => r.id === B).status === 'quoting', p.rows.find((r) => r.id === B).status)
summary(); await t.close()
