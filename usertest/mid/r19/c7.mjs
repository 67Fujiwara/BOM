// c7: 承認 ON の変更セットで型式を変えた既存の行（PM 承認待ち）と見積の取り込み・手入力。承認後に旧型式の回答が新型式の見積として残らないか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認ON'))
await t.role('design'); await t.press('1')
// R081 を足して見積を取ってから型式を変える
const A = await h.addRow('R080', '型式変更する行', 'G2R-1 DC24', 'オムロン', '相見積')
log('publish A →', await t.publish('1'))
await t.role('pm'); log('PM y →', (await t.yes(A, '承認')).toast)
await t.role('purchasing'); log('request →', (await h.requestTo(null)).msg)
let p = await t.proj(); log('A', h.show(p, A))
await t.role('design'); await t.press('1'); await t.setCellKey(A, 'model', 'G2RL-1 DC24'); log('publish change →', await t.publish('1'))
p = await t.proj(); const rA = p.rows.find((r) => r.id === A); log('A pending', h.show(p, A), 'pendingApproval', JSON.stringify(rA.pendingApproval), '|', await h.status(A))
await t.role('purchasing'); await t.press('1'); log('purch sees model', await t.cellText(A, 'model'), '| status', await h.status(A))
// 購買: 依頼済みの旧型式の回答を取り込む（因幡）と、立花の欄に手入力
const imp = await h.importAnswers('S1', ['行ID\t型式\t単価\t納期\tMOQ', `${A}\tG2R-1 DC24\t1500\t5\t`].join('\n')); log('import S1 →', imp)
await t.press('6'); log('typed S2', await h.q(A, 'S2', 1400, 6)); await t.press('Escape')
p = await t.proj(); log('A after answers', h.show(p, A), '|', await h.status(A))
await t.role('pm'); log('PM y change →', (await t.yes(A, '承認')).toast)
p = await t.proj(); log('A after approve', h.show(p, A), 'model', p.rows.find((r) => r.id === A).model, '|', await h.status(A), 'stale', JSON.stringify(p.quotes.filter((q) => q.rowId === A && q.stale).map((q) => [q.supplierId, q.unitPrice, q.staleModel])))
const live = p.quotes.filter((q) => q.rowId === A && !q.stale && q.unitPrice != null)
check('C7-1 承認後、旧型式（G2R-1）への回答が新型式（G2RL-1）の有効な見積として残らない（再見積要）', live.length === 0 || p.rows.find((r) => r.id === A).flags.requote, JSON.stringify(live.map((q) => [q.supplierId, q.unitPrice])))
summary(); await t.close()
