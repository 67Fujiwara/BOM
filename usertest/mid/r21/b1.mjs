// b1: 見積の枠は依頼時に作る（M8-01 の修正）。一部の商社だけに依頼 → 回答 → 後から残りの商社 → 見積完了条件（全社 / 2社以上 / 期限）
// 引数: all | min2 | deadline
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const rule = process.argv[2] ?? 'all'
const label = { all: '全社', min2: '2社以上', deadline: '期限' }[rule]
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '部分依頼リレー', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '手入力リレー', 'G2R-2 DC24', 'オムロン', '相見積')
const C = await h.addRow(B, '取込リレー', 'G2R-1-S DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
let p = await t.proj(); log('after publish', h.show(p, A))
check('B1-0 公開では見積の枠を作らない', p.quotes.filter((q) => [A, B, C].includes(q.rowId)).length === 0)
await t.role('purchasing')
log('rule →', await h.setting('quoteCompleteRule', label, '完了条件')); p = await t.proj(); log('rule', p.settings.quoteCompleteRule)
// 因幡だけに依頼（A だけ。B/C は依頼しない → B/C は submitted のまま…ではなく、提出済の行はすべて因幡に送られる）
const r1 = await h.requestTo('S1'); p = await t.proj(); log('S1 only →', r1.msg, JSON.stringify(r1.f.map((f) => [f.sup, f.ids.length])))
log(h.show(p, A), '| status', await t.cellText(A, 'status')); log(h.show(p, B)); log(h.show(p, C))
check('B1-1 因幡だけの依頼で A は「見積中 0/1」', (await t.cellText(A, 'status')).includes('0/1'), await t.cellText(A, 'status'))
// 因幡が回答
await t.press('6'); log('S1 answer', await h.q(A, 'S1', 1500, 5))
p = await t.proj(); const stA = p.rows.find((r) => r.id === A).status; log('after S1 answer', h.show(p, A), '| status', await t.cellText(A, 'status'))
if (rule === 'min2') check('B1-2 (2社以上) 3 社が候補の行で 1 社の回答だけでは見積済にならない（§4「n社以上」）', stA === 'quoting', stA)
else check(`B1-2 (${label}) 頼んだ 1 社が答えれば、その時点の条件で判定`, stA === 'quoted' || stA === 'quoting', stA)
// 選定者の 4 に出るか（見積済なら）
await t.role('design'); await t.press('4'); const in4 = (await t.viewRows()).includes(A); log('design 4 has A', in4)
await t.role('purchasing')
// 後から立花に依頼
const r2 = await h.requestTo('S2'); p = await t.proj(); log('S2 later →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.includes(A)])))
log(h.show(p, A), '| status', await t.cellText(A, 'status'))
check('B1-3 後から立花に依頼でき、A が依頼書に入り「見積中 1/2」', r2.f.some((f) => f.sup === '立花エレテック' && f.ids.includes(A)) && (await t.cellText(A, 'status')).includes('1/2'), await t.cellText(A, 'status'))
// B: 依頼書なしで立花の回答を手入力（電話で頼んだ） — B は S1 に依頼済み（提出済の行すべて）なので、ここでは S3 列に手入力
await t.press('6'); log('B S3 typed', await h.q(B, 'S3', 900, 7))
p = await t.proj(); log('B after typed S3', h.show(p, B), '| status', await t.cellText(B, 'status'))
// C: ミスミの回答を取り込む（依頼していない商社）
const imp = await h.importAnswers('S3', ['行ID\t型式\t単価\t納期\tMOQ', `${C}\tG2R-1-S DC24\t800\t3\t`].join('\n'))
p = await t.proj(); log('C import S3 →', imp, h.show(p, C), '| status', await t.cellText(C, 'status'))
// 立花の回答
await t.press('6'); log('S2 answer A', await h.q(A, 'S2', 1400, 6))
p = await t.proj(); log('A after S2', h.show(p, A), '| status', await t.cellText(A, 'status'))
// ミスミに後から（相見積先すべて）
const r3 = await h.requestTo(null); p = await t.proj(); log('all later →', r3.msg, JSON.stringify(r3.f.map((f) => [f.sup, f.ids.filter((x) => [A, B, C].includes(x))])))
log(h.show(p, A), '| status', await t.cellText(A, 'status')); log(h.show(p, B), '| status', await t.cellText(B, 'status')); log(h.show(p, C), '| status', await t.cellText(C, 'status'))
summary(); await t.close()
