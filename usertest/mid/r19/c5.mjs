// c5: 納期NG の対策のあとで採用商社が辞退（e 特急・分納 / d 代替品検討 / p 委譲）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj(); const ng = p.rows.filter((r) => r.flags.leadNG && r.status === 'selected' && r.procurement === '相見積').map((r) => r.id); log('leadNG rows', ng.join(','))
const [E, D, P] = ng
await t.role('pm'); await t.press('7')
log('e', E, JSON.stringify((await t.decide(E, 'e', '特急で', { 上限金額: '30000' })).toast))
log('d', D, JSON.stringify((await t.decide(D, 'd', '代替を検討')).toast))
log('p', P, JSON.stringify((await t.decide(P, 'p', '購買で再選定')).toast))
p = await t.proj(); for (const id of [E, D, P]) log('after PM', h.show(p, id), 'ball', await h.ballOf(id))
log('E decisions', JSON.stringify(p.decisions.filter((d) => d.rowId === E).map((d) => [d.kind, d.payload])))
await t.role('purchasing'); await t.press('3'); log('E extra', await t.setCellKey(E, 'extraCost', '20000')); await t.press('Escape')
const money0 = await t.money(); log('money before decline', money0)
p = await t.proj(); const adopted = Object.fromEntries([E, D, P].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
for (const id of [E, D, P]) await h.decline(id, adopted[id])
p = await t.proj()
for (const id of [E, D, P]) log('after decline', h.show(p, id), 'extra', p.rows.find((r) => r.id === id).extraCost, 'ball', await h.ballOf(id), 'case', await h.caseOf(id), 'issues', JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status])))
log('money after decline', await t.money())
const rE = p.rows.find((r) => r.id === E), rD = p.rows.find((r) => r.id === D), rP = p.rows.find((r) => r.id === P)
check('C5-1 (e) 辞退した商社のための特急費（追加費用）を、採用を外した行の金額に黙って残さない（外すか、購買の 4 で確かめさせる）', rE.extraCost == null || (await (async () => { await t.press('4'); return (await t.viewRows()).includes(E) })()), `extra=${rE.extraCost}`)
const dIss = p.issues.filter((i) => i.rowId === D && i.kind === '納期NG' && ['open', 'inProgress'].includes(i.status))
check('C5-2 (d) 採用商社が辞退した行に、その商社の納期に対する「納期NG」の指摘を設計の未対応として残さない（または選び直し待ちと分かる）', dIss.length === 0, JSON.stringify(dIss.map((i) => [i.id, i.status])))
log('D ball', await h.ballOf(D))
check('C5-3 (p) 委譲された行は、採用商社の辞退後も購買が選び直せる（ボール購買）', (await h.ballOf(P)) === 'purchasing', await h.ballOf(P))
// 設計が D の納期NG 指摘に「代替なし」と回答したら？
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(D); log('design 4 has D', d4)

// 設計が D の納期NG 指摘に「代替なし」と回答 → PM の 7
await t.goto(D); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
let pn = await t.panel(); log('D issue panel', JSON.stringify(pn?.options))
if (pn?.options?.some((o) => o.startsWith('7'))) { await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('D after 代替なし', h.show(p, D), 'ball', await h.ballOf(D), 'case', await h.caseOf(D))
await t.role('pm'); await t.press('7'); const in7D = (await t.viewRows()).includes(D); log('PM 7 has D', in7D)
if (in7D) { await t.goto(D); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel D', JSON.stringify(await t.panel())); await page.keyboard.press('Escape') }
check('C5-4 採用のない（選び直し待ちの）行が、辞退した商社の納期NG の「対策不成立」で PM の 7 に載らない', !in7D)
await t.shot('c5')
summary(); await t.close()
