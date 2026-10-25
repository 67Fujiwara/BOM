// c9: 案件の相見積先に入っている商社が、商社マスタで「取引不可」になったとき（JSON の読み込み・マスタ更新と同じ。開く前の保存データで設定）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s))
await t.open('design', ws); await t.press('1')
log('suppliers', JSON.stringify((await t.ws()).suppliers.map((s) => [s.id, s.name, s.tradable])), 'project', JSON.stringify((await t.proj()).supplierIds))
const A = await h.addRow('R080', '相見積リレー', 'G2R-1 DC24', 'オムロン', '相見積')
const K = await h.addRow(A, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
log('publish →', await t.publish('1'))
await t.role('purchasing')
const r1 = await h.requestTo(null); log('all →', r1.msg, 'options', JSON.stringify(r1.options), JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((x) => [A, K].includes(x))])))
check('C9-1 取引不可のミスミには「相見積先すべて」でも依頼書を出さない（または選ぶ前に知らせる）', !r1.f.some((f) => f.sup === 'ミスミ'), JSON.stringify(r1.f.map((f) => f.sup)))
let p = await t.proj(); log('A', h.show(p, A), '|', await h.status(A)); log('K', h.show(p, K))
await h.decline(K, p.quotes.find((q) => q.rowId === K && !q.stale).supplierId)
await t.press('4'); await t.goto(K); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel(); log('K Ctrl+.', JSON.stringify(qf?.options)); if (qf) await t.press('Escape')
check('C9-2 客先指定品の次の依頼先に、取引不可のミスミを案内しない', !(qf?.options ?? []).some((o) => o.includes('ミスミ')), JSON.stringify(qf?.options))
summary(); await t.close()
