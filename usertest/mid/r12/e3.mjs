// e3: 納期NG の対策（e 特急・分納 / d 代替品検討 / 対策不成立）のあとで、設計が調達区分を指定商社（別の商社）に切り替える
// 期待: 採用を外すときに、その採用に対する PM の判断（対策区分・特急費・PM の指摘・対策不成立）も取り下げ、新しい指定先で判定し直す
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const lateOther = await page.evaluate(async () => { const d = await import(window.__m('/src/model/derive.ts')); const dt = await import(window.__m('/src/model/dates.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const o = {}; for (const r of p.rows) { const need = d.rowNeedDate(p, r); const late = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.supplierId !== r.adoptedSupplierId && q.unitPrice != null && q.leadDays > 0 && q.stock !== '在庫' && need && dt.addDays(dt.todayStr(), q.leadDays) > need); if (late.length) o[r.id] = late[0].supplierId } return o })
const ng = p.rows.filter((r) => r.flags.leadNG && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && lateOther[r.id]).map((r) => r.id)
log('leadNG rows with a late other supplier', ng.join(','))
const [E, D, F] = ng
await t.role('pm'); await t.press('7')
log('PM e', E, (await t.decide(E, 'e', '特急で', { 上限金額: '30000' })).toast)
log('PM d', D, (await t.decide(D, 'd', '代替を検討')).toast)
log('PM d', F, (await t.decide(F, 'd', '代替を検討')).toast)
await t.role('purchasing'); await t.press('3'); log('E extra', await t.setCellKey(E, 'extraCost', '20000')); await t.press('Escape')
// F: 設計が「代替なし」→ 対策不成立
await t.role('design'); await t.press('1'); await t.goto(F); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
let pn = await t.panel(); if (pn?.options?.some((o) => o.startsWith('7'))) { await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
await t.press('Escape'); await t.press('Escape')
p = await t.proj()
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, i.by.role]))
for (const id of [E, D, F]) log('before switch', h.show(p, id), 'cm', p.rows.find((r) => r.id === id).flags.countermeasure, 'extra', p.rows.find((r) => r.id === id).extraCost, iss(p, id), 'case', await h.caseOf(id))
const money0 = await t.money()
// 設計: 3 行を指定商社（間に合わない別の商社）に切り替えて公開
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
for (const id of [E, D, F]) { await t.setCellKey(id, 'procurement', '指定商社'); await t.setCellKey(id, 'designated', NAMES[lateOther[id]]) }
log('publish →', await t.publish('1'))
p = await t.proj()
const res = {}
for (const id of [E, D, F]) { const r = p.rows.find((x) => x.id === id); res[id] = r; log('after switch', h.show(p, id), 'cm', r.flags.countermeasure, 'extra', r.extraCost, iss(p, id), 'ball', await h.ballOf(id), 'case', await h.caseOf(id), '|', await h.status(id)) }
log('money', money0, '→', await t.money())
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has E/D/F', v7.includes(E), v7.includes(D), v7.includes(F))
check('E3-1 (e) 指定商社（別の商社）に切り替えたら、前の商社への特急費・対策区分「分納・特急」を残さない', res[E].extraCost == null && res[E].flags.countermeasure == null, `extra=${res[E].extraCost} cm=${res[E].flags.countermeasure}`)
check('E3-2 (e) 新しい指定先が必要日に間に合わないなら納期NG で PM の 7 に載る（前の対策で隠れない）', res[E].flags.leadNG && v7.includes(E), `leadNG=${res[E].flags.leadNG} in7=${v7.includes(E)}`)
const dOpen = p.issues.filter((i) => i.rowId === D && i.by.role === 'pm' && ['open', 'inProgress'].includes(i.status))
check('E3-3 (d) 前の商社の納期に対する PM の「納期NG」指摘・対策区分「代替品検討」を残さない（設計の 4 に残らない）', dOpen.length === 0 && res[D].flags.countermeasure == null, `open=${JSON.stringify(dOpen.map((i) => [i.id, i.kind]))} cm=${res[D].flags.countermeasure}`)
check('E3-4 (d) 新しい指定先が間に合わないなら納期NG で PM の 7 に載る', res[D].flags.leadNG && v7.includes(D), `leadNG=${res[D].flags.leadNG} in7=${v7.includes(D)}`)
check('E3-5 (対策不成立) 前の採用の対策不成立を残さず、新しい指定先で判定し直す（間に合わなければ納期NG）', !(res[F].flags.pmPending && res[F].flags.pmReason === '対策不成立') && res[F].flags.leadNG, JSON.stringify(res[F].flags))
await t.shot('e3')
summary(); await t.close()
