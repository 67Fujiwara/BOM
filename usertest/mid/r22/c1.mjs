// c1: 頼むつもりの商社（quoteTargets）と表示・購買の 4・選定者の a・期限での締め
// 引数: all | deadline | min2
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const rule = process.argv[2] ?? 'all'
const label = { all: '全社', min2: '2社以上', deadline: '期限' }[rule]
const t = await launch({ time: '2026-10-23T10:00:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '一社依頼リレー', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '電話リレー', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', label, '完了条件'))
// A, B とも因幡だけに依頼（回答期限 10/26）
const r1 = await h.requestTo('S1', '2026-10-26'); log('S1 only →', r1.msg)
let p = await t.proj(); log(h.show(p, A), 'targets', JSON.stringify(p.rows.find((r) => r.id === A).quoteTargets))
log('A status', await h.status(A))
check('C1-1 因幡だけに依頼した行の状態に、相見積先 3 社を分母にした回答数が出る（§4「回答 2/3 を併記」）', (await h.status(A)).includes('0/3'), await h.status(A))
await t.press('6'); await h.q(A, 'S1', 1500, 5); await t.press('Escape')
p = await t.proj(); log('after S1', h.show(p, A), '|', await h.status(A))
check('C1-2 1 社の回答後の表示は 1/3（頼んでいない 2 社を待っていることが分かる）', (await h.status(A)).includes('1/3'), await h.status(A))
// 購買の 4（未回答の行）
await t.press('4'); const pu4 = (await t.viewRows()).includes(A); log('purchasing 4 has A', pu4)
await t.goto(A); await t.press('Home'); log('purch status bar on A', await t.status())
check('C1-3 回答待ちの行（立花・ミスミにまだ頼んでいない）が購買の 4 に出る', pu4)
// 選定者（設計）の a
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('Home'); await t.press('a'); await page.waitForTimeout(80); const am = await t.toast(); log('design a →', am)
check('C1-4 a の案内の回答数も 1/3', am.includes('1/3'), am)
// 期限を過ぎる（10/27）→ 何か 1 つ操作して判定
await t.setTime('2026-10-27T10:00:00'); await t.reload(); await t.role('purchasing'); await t.press('6'); await h.q(B, 'S1', 900, 4); await t.press('Escape')
p = await t.proj(); log('after deadline', h.show(p, A), '|', await h.status(A), 'deadline', p.settings.quoteDeadline)
const stA = p.rows.find((r) => r.id === A).status
if (rule === 'deadline') check('C1-5 (期限) 期限を過ぎたら見積済（頼んでいない商社は辞退扱い）', stA === 'quoted', stA)
else check(`C1-5 (${label}) 期限を過ぎても見積中のまま（完了条件どおり）`, stA === 'quoting', stA)
await t.press('4'); const pu4b = (await t.viewRows()).includes(A); log('purchasing 4 after deadline has A', pu4b)
if (rule !== 'deadline') check('C1-6 期限を過ぎて回答待ちのままの行が購買の 4 に出る（頼んでいない商社に依頼する手がかり）', pu4b)
// 「相見積先すべて」で残りに頼む
const r3 = await h.requestTo(null, '2026-11-02'); p = await t.proj(); log('all →', r3.msg, JSON.stringify(r3.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
log(h.show(p, A), '|', await h.status(A))
await t.shot('c1-' + rule)
summary(); await t.close()
