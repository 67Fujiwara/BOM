// e1: 案件設定の変更（相見積先から外す・見積完了条件を変える）のあとで、見積中の行が見積済に進むか（M11-04 の残り）
// mode=remove: 全社 → 3 社に依頼 → 因幡・立花が回答 → 相見積先からミスミを外す
// mode=rule:   全社 → 3 社に依頼 → 因幡・立花が回答 → 見積完了条件を 2社以上に
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'remove'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '設定変更A', 'G2R-1 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
const r1 = await h.requestTo(null); log('all →', r1.msg)
await t.press('6'); await h.q(A, 'S1', 1500, 5); await h.q(A, 'S2', 1400, 6); await t.press('Escape')
let p = await t.proj(); log('A before', h.show(p, A), '|', await h.status(A))
if (mode === 'remove') log('supplierIds →', await h.setting('supplierIds', 'S1,S2', 'ミスミは今回外す'))
else log('rule2 →', await h.setting('quoteCompleteRule', '2社以上', '2社で締める'))
p = await t.proj(); const st1 = p.rows.find((r) => r.id === A).status
log('A after setting', h.show(p, A), '|', await h.status(A), 'ball', await h.ballOf(A))
await t.press('4'); log('purch 4 has A', (await t.viewRows()).includes(A))
await t.role('design'); await t.press('4'); log('design 4 has A', (await t.viewRows()).includes(A))
await t.press('1'); await t.goto(A); await t.press('a'); await page.waitForTimeout(80); const ta = await t.toast(); log('design a →', ta)
p = await t.proj(); const st2 = p.rows.find((r) => r.id === A).status
check(`E1-1 (${mode}) 設定を変えた直後に、回答の揃った行が見積済になり、選定者が a で選べる`, st1 === 'quoted' && st2 === 'selected', `${st1} → a: ${ta}`)
// 別の操作（購買が別の行の見積を 1 つ入れる）をすると進むか
await t.role('purchasing'); await t.press('6'); await h.q('R001', 'S1', 999, null); await t.press('Escape')
p = await t.proj(); log('A after unrelated edit', h.show(p, A), '|', await h.status(A))
log('note: unrelated edit promotes →', p.rows.find((r) => r.id === A).status)
await t.shot('e1-' + mode)
summary(); await t.close()
