// x6b: 発注数要確認が購買の 4 に出るか（ボール購買の行 / ボール PM（納期NG）の行）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const G1 = p.rows.find((r) => r.status === 'selected' && !r.flags.contested && !r.flags.leadNG && r.procurement === '相見積').id
const G2 = p.rows.find((r) => r.status === 'selected' && !r.flags.contested && r.flags.leadNG && r.procurement === '相見積').id
await t.role('purchasing'); await t.press('3')
for (const g of [G1, G2]) { await t.setCellKey(g, 'orderQty', String((p.rows.find((r) => r.id === g).orderQty ?? 1) + 5)); await t.press('Escape') }
await t.role('design'); await t.press('1')
for (const g of [G1, G2]) await t.setCellKey(g, 'qtyNeeded', String(p.rows.find((r) => r.id === g).qtyNeeded + 1))
log('publish →', await t.publish('1'))
p = await t.proj(); for (const g of [G1, G2]) log(g, JSON.stringify(p.rows.find((r) => r.id === g).flags))
await t.role('purchasing'); await t.press('4'); const v4 = await t.viewRows()
for (const g of [G1, G2]) log(g, 'ball', await t.cellText(g, 'ball'), 'in purch 4', v4.includes(g))
check('X6b-1 発注数要確認（ボール購買）が購買の 4 に出る', v4.includes(G1))
check('X6b-2 発注数要確認（ボール PM：納期NG）も購買の 4 に出る', v4.includes(G2))
summary(); await t.close()
