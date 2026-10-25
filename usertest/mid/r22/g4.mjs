// g4: メーカで依頼先を絞る（M13-06 の修正 makerTargets）。メーカ別の直販（S5 オムロン直販）を相見積先に足したとき
//   新しい行の依頼・指定商社から相見積に戻した行・メーカを変えた行（再見積）で、扱わない商社に依頼しないか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('purchasing'); log('supplierIds →', await h.setting('supplierIds', 'S1,S2,S3,S5', '直販を追加'))
log('project supplierIds', JSON.stringify((await t.proj()).supplierIds))
await t.role('design'); await t.press('1')
const A = await h.addRow('R080', '三菱リレーG', 'RXM-TEST-1', '三菱電機', '相見積')
const B = await h.addRow(A, 'オムロンリレーG', 'G2R-TEST-2', 'オムロン', '相見積')
const C = await h.addRow(B, '住友端子G', 'SMT-TEST-3', '住友電装', '指定商社', '因幡電機')
log('publish →', await t.publish('1'))
await t.role('purchasing')
const r1 = await h.requestTo(null); log('request all →', r1.msg); log('files', JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((x) => [A, B, C].includes(x))])))
let p = await t.proj(); for (const id of [A, B, C]) log(id, 'targets', JSON.stringify(p.rows.find((r) => r.id === id).quoteTargets), 'quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId)))
const sentTo = (id) => r1.f.filter((f) => f.ids.includes(id)).map((f) => f.sup).sort()
check('G4-1 三菱電機の行はオムロン直販（オムロンだけ扱う）に依頼しない。オムロンの行は直販にも依頼する', !sentTo(A).includes('オムロン直販') && sentTo(B).includes('オムロン直販'), `A→${sentTo(A)} B→${sentTo(B)}`)
// C: 指定先 因幡 が回答 → 選定済 → 相見積に戻す
await t.press('6'); log('C quote', await h.q(C, 'S1', 1100, 5))
p = await t.proj(); log('C', h.show(p, C), '|', await h.status(C))
await t.role('design'); await t.press('1'); await t.setCellKey(C, 'procurement', '相見積'); log('publish C back →', await t.publish('1'))
p = await t.proj(); const tc = p.rows.find((r) => r.id === C).quoteTargets; log('C after back', h.show(p, C), 'targets', JSON.stringify(tc), '|', await h.status(C))
check('G4-2 住友電装（因幡だけが扱う）の指定商社の行を相見積に戻すと、依頼先は因幡・ミスミ（取扱メーカ未登録）だけ。立花・オムロン直販は入れない', JSON.stringify([...(tc ?? [])].sort()) === JSON.stringify(['S1', 'S3']), JSON.stringify(tc))
// A: メーカを オムロン に変える（再見積）→ 相見積先すべて
await t.setCellKey(A, 'maker', 'オムロン'); log('publish A maker →', await t.publish('1'))
p = await t.proj(); log('A after maker change', h.show(p, A), '|', await h.status(A))
await t.role('purchasing'); const r2 = await h.requestTo(null); log('request all 2 →', r2.msg); log('files 2', JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, B, C].includes(x))])))
const sentA = r2.f.filter((f) => f.ids.includes(A)).map((f) => f.sup).sort(), sentC = r2.f.filter((f) => f.ids.includes(C)).map((f) => f.sup).sort()
p = await t.proj(); log('A targets', JSON.stringify(p.rows.find((r) => r.id === A).quoteTargets), 'C targets', JSON.stringify(p.rows.find((r) => r.id === C).quoteTargets))
check('G4-3 メーカをオムロンに変えて再見積した行は、オムロン直販にも依頼する', sentA.includes('オムロン直販'), JSON.stringify(sentA))
check('G4-4 相見積に戻した住友電装の行の残りの依頼はミスミだけ（立花・直販に出さない）', !sentC.includes('立花エレテック') && !sentC.includes('オムロン直販'), JSON.stringify(sentC))
await t.shot('g4')
summary(); await t.close()
