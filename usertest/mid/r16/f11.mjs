// f11: メーカで依頼先を絞る行（住友電装＝因幡だけが扱う）を 指定商社（因幡・回答済み・選定済）→ 相見積 に戻す
// 期待（§7）: 行のメーカから依頼可能な商社に絞る → 立花（住友電装を扱わない）には頼まず、待たない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '絞り込みF11', 'TS-0001', '住友電装', '指定商社', '因幡電機')
const B = await h.addRow(A, '絞り込みF11B', 'TS-0002', '住友電装', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
const r1 = await h.requestTo(null); log('all →', JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
await t.press('6'); log(await h.q(A, 'S1', 1100, 6))
let p = await t.proj(); log('A', h.show(p, A), '|', await h.status(A), '| B targets', JSON.stringify(p.rows.find((r) => r.id === B).quoteTargets))
await t.role('design'); await t.press('1'); await t.setCellKey(A, 'procurement', '相見積'); log('publish →', await t.publish('1'))
p = await t.proj(); const a = p.rows.find((r) => r.id === A); log('A back', h.show(p, A), '|', await h.status(A), 'targets', JSON.stringify(a.quoteTargets))
await t.role('purchasing'); const r2 = await h.requestTo(null); log('all →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B].includes(x))])))
await t.press('6'); await h.q(A, 'S3', 1200, 7)
p = await t.proj(); log('A after S3', h.show(p, A), '|', await h.status(A))
const sentS2 = r2.f.some((f) => f.sup === '立花エレテック' && f.ids.includes(A))
check('F11-1 相見積に戻した住友電装の行は、扱わない立花に依頼せず・待たない（新しく足した相見積の行 B と同じ絞り込み）', !sentS2 && p.rows.find((r) => r.id === A).status === 'quoted', `sentS2=${sentS2} targets=${JSON.stringify(a.quoteTargets)} B=${JSON.stringify(p.rows.find((r) => r.id === B).quoteTargets)} status=${await h.status(A)}`)
summary(); await t.close()
