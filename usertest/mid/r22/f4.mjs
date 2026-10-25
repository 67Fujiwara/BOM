// f4: 納期NG の対策（e 特急・分納＋追加費用 / p 委譲 / Shift+Y 受入）のあとで採用商社が辞退 → 対策・追加費用・PM の判断が残らないか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const ng = p.rows.filter((r) => r.flags.leadNG && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3).map((r) => r.id)
log('leadNG rows', ng.join(','))
const [E, P, A] = ng
await t.role('pm'); await t.press('7')
log('PM e', E, (await t.decide(E, 'e', '特急で', { 上限金額: '30000' })).toast)
log('PM p', P, (await t.decide(P, 'p', '購買で再選定')).toast)
await t.goto(A); await t.press('Shift+Y'); await page.waitForTimeout(80); { const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('遅延許容'); if (pr.extra && '承認者' in pr.extra) { await t.extraFill('承認者', '部長 田中'); if ('決裁書No' in pr.extra) await t.extraFill('決裁書No', 'K-77') } await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) } if (await t.panel()) await page.keyboard.press('Escape') }
log('PM Shift+Y', A, await t.toast())
await t.role('purchasing'); await t.press('3'); log('E extra', await t.setCellKey(E, 'extraCost', '20000')); await t.press('Escape')
p = await t.proj(); for (const id of [E, P, A]) log('before decline', h.show(p, id), 'cm', p.rows.find((r) => r.id === id).flags.countermeasure, 'extra', p.rows.find((r) => r.id === id).extraCost)
const money0 = await t.money()
const ad = Object.fromEntries([E, P, A].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
for (const id of [E, P, A]) log('decline', id, ad[id], await h.decline(id, ad[id]))
p = await t.proj(); const res = {}
for (const id of [E, P, A]) { const r = p.rows.find((x) => x.id === id); res[id] = r; log('after decline', h.show(p, id), 'cm', r.flags.countermeasure, 'extra', r.extraCost, 'ball', await h.ballOf(id), 'case', await h.caseOf(id), '|', await h.status(id)) }
log('money', money0, '→', await t.money())
check('F4-1 (e) 採用商社が辞退したら特急費・対策区分を残さない', res[E].extraCost == null && !res[E].flags.countermeasure, `extra=${res[E].extraCost} cm=${res[E].flags.countermeasure}`)
check('F4-2 (受入) 採用商社が辞退したら「受入（遅延許容）」を残さない（選び直した商社で判定し直す）', !res[A].flags.countermeasure, `cm=${res[A].flags.countermeasure}`)
check('F4-3 (p 委譲) 辞退後も購買が選び直せる（委譲中のボールは購買、または選定者）', ['purchasing', 'design'].includes(await h.ballOf(P)), JSON.stringify(res[P].flags))
// 選び直し: 受入 の行 A を設計が a → 間に合わない商社なら納期NG で PM に出るか
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('a'); await page.waitForTimeout(80); log('design a A →', await t.toast())
await t.goto(E); await t.press('a'); await page.waitForTimeout(80); log('design a E →', await t.toast())
await t.role('purchasing'); await t.press('1'); await t.goto(P); await t.press('a'); await page.waitForTimeout(80); log('purch a P →', await t.toast())
p = await t.proj(); for (const id of [E, P, A]) log('after reselect', h.show(p, id), 'cm', p.rows.find((r) => r.id === id).flags.countermeasure, '|', await h.status(id), 'case', await h.caseOf(id))
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has E/P/A', v7.includes(E), v7.includes(P), v7.includes(A))
await t.shot('f4')
summary(); await t.close()
