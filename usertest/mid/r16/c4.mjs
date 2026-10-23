// c4: 採用後の辞退（追加）。(a) 全社で一部未回答の先行採用 → 辞退、(b) PM 承認待ちの例外選定の商社が辞退、(c) PM 承認待ちの先行採用の商社が辞退
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '先行採用リレーA', 'G2R-1 DC24', 'オムロン', '相見積')
const C = await h.addRow(A, '先行採用リレーC', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
log('request all →', (await h.requestTo(null)).msg)
await t.press('6'); await h.q(A, 'S1', 1200, 5); await h.q(A, 'S2', 1300, 6); await h.q(C, 'S1', 800, 5); await t.press('Escape')
let p = await t.proj(); log('A', h.show(p, A), '|', await h.status(A)); log('C', h.show(p, C), '|', await h.status(C))
// (a) A: 設計が見積中のまま因幡で先行採用 → PM 許可 → 因幡が辞退
await t.role('design'); await t.press('1'); log('A early →', (await h.adoptPick(A, 1, '1', '急ぎ')).toast)
// (c) C: 先行採用（PM 承認待ち）のまま因幡が辞退
log('C early →', (await h.adoptPick(C, 1, '1', '急ぎ')).toast)
await t.role('pm'); log('PM y A →', (await t.yes(A, '先行で')).toast)
p = await t.proj(); log('A', h.show(p, A)); log('C', h.show(p, C))
await t.role('purchasing'); await h.decline(A, 'S1'); await h.decline(C, 'S1')
p = await t.proj(); const rA = p.rows.find((r) => r.id === A); log('A after decline', h.show(p, A), '|', await h.status(A), 'ball', await h.ballOf(A))
check('C4-1 (全社) 一部未回答（ミスミ）のまま先行採用した商社が辞退 → 見積中（回答 2/3）。見積済にしない（§4 完了条件）', rA.status === 'quoting', rA.status)
const rC = p.rows.find((r) => r.id === C); log('C after decline', h.show(p, C), '|', await h.status(C), 'ball', await h.ballOf(C), 'case', await h.caseOf(C))
await t.role('pm'); await t.press('7'); const in7C = (await t.viewRows()).includes(C); log('PM 7 has C', in7C)
check('C4-2 PM 承認待ちの先行採用の商社が辞退したら、仮採用を外して PM の 7 から下ろす（辞退した商社の先行発注を許可させない）', !rC.adoptedSupplierId && !rC.flags.pmPending, h.show(p, C))
if (in7C) { await t.goto(C); await t.press('Enter'); await page.waitForTimeout(80); log('PM Enter C', JSON.stringify(await t.panel())); await page.keyboard.press('Escape'); const y = await t.yes(C, '先行で'); log('PM y C →', y.toast); p = await t.proj(); log('C after PM y', h.show(p, C), '|', await h.status(C)) }
// (b) サンプル: 例外選定（3 位）で PM 承認待ち → 選んだ商社が辞退 → PM
await t.role('design'); await t.press('1')
let exc = null
for (const id of ['R011', 'R013', 'R014', 'R015', 'R017', 'R018', 'R019', 'R021']) {
  await h.adoptPick(id, 3, '6', '評価用'); if ((await t.row(id)).flags.pmPending) { exc = id; break }
}
p = await t.proj(); log('exception row', exc, h.show(p, exc))
const sid = p.rows.find((r) => r.id === exc).adoptedSupplierId
await t.role('purchasing'); await h.decline(exc, sid)
p = await t.proj(); const rE = p.rows.find((r) => r.id === exc); log('exc after decline', h.show(p, exc), 'ball', await h.ballOf(exc), 'case', await h.caseOf(exc))
await t.role('pm'); await t.press('7'); const in7E = (await t.viewRows()).includes(exc); log('PM 7 has exc', in7E)
check('C4-3 PM 承認待ちの例外選定の商社が辞退したら、仮採用を外して選定者に戻す（PM に辞退した商社の承認を求めない）', !rE.adoptedSupplierId && !rE.flags.pmPending, h.show(p, exc))
if (in7E) { await t.goto(exc); await t.press('Enter'); await page.waitForTimeout(80); log('PM Enter exc', JSON.stringify(await t.panel())); await page.keyboard.press('Escape'); const y = await t.yes(exc, '承認'); log('PM y exc →', y.toast); p = await t.proj(); log('exc after PM y', h.show(p, exc), '|', await h.status(exc), JSON.stringify(p.decisions.filter((d) => d.rowId === exc).map((d) => [d.kind, d.choice ?? d.result ?? '']))) }
await t.shot('c4')
summary(); await t.close()
