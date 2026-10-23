// e5: 指定系の進み具合（いまの指定先 1 社の回答で数える。M11-08 / U10-03 の修正）
// K: 客先指定品（オムロン）→ 最初の商社が辞退 → 次の商社へ → 回答
// D: 指定商社（ミスミ）でミスミを取引不可に（JSON 読み込み）→ 依頼
// E: 指定商社（立花）に、購買が因幡の単価を先に入れてしまう → 立花が回答
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const K = await h.addRow('R080', '客先指定K', 'G2R-1 DC24', 'オムロン', '客先指定品', '客先承認 KS-1')
const D = await h.addRow(K, '指定ミスミD', 'G2R-2 DC24', 'オムロン', '指定商社', 'ミスミ')
const E = await h.addRow(D, '指定立花E', 'G2R-3 DC24', 'オムロン', '指定商社', '立花エレテック')
log('publish →', await t.publish('1'))
// ミスミを取引不可に
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)); await t.open('purchasing', ws)
let p = await t.proj(); log('D before request', h.show(p, D), '|', await h.status(D))
await t.press('1'); await t.goto(D); await t.press('Home'); log('D status bar', (await t.status()).slice(-120))
const rq = await h.requestTo(null); log('all →', rq.msg, JSON.stringify(rq.f.map((f) => [f.sup, f.ids.filter((x) => [K, D, E].includes(x))])))
p = await t.proj(); for (const id of [K, D, E]) log('after request', h.show(p, id), '|', await h.status(id))
check('E5-1 取引不可の商社（ミスミ）を指定先にした指定商社の行は、ミスミに依頼書を出さない（取引不可と知らせる）', !rq.f.some((f) => f.sup === 'ミスミ'), JSON.stringify(rq.f.map((f) => f.sup)) + ' ' + rq.msg)
await t.press('4'); const v4 = await t.viewRows(); log('purch 4 has K/D/E', v4.includes(K), v4.includes(D), v4.includes(E))
// E: 因幡の単価を先に入れる
await t.press('6'); await h.q(E, 'S1', 900, 4); await t.press('Escape')
log('E after S1 typed', await h.status(E))
const sE1 = await h.status(E)
await t.press('6'); await h.q(E, 'S2', 1000, 5); await t.press('Escape')
p = await t.proj(); log('E after S2', h.show(p, E), '|', await h.status(E))
check('E5-2 指定商社（立花）の行の進み具合に、指定先でない因幡の回答を数えない', /0\/1/.test(sE1) && p.rows.find((r) => r.id === E).status === 'selected' && p.rows.find((r) => r.id === E).adoptedSupplierId === 'S2', sE1)
// K: 最初の依頼先が辞退
p = await t.proj(); const k0 = p.quotes.filter((q) => q.rowId === K && !q.stale).map((q) => q.supplierId); log('K first', JSON.stringify(k0), await h.status(K))
await t.press('6'); await t.setCellKey(K, `q.leadDays@${k0[0]}`, '取扱なし'); await t.press('Escape')
p = await t.proj(); const sK = await h.status(K); log('K after decline', h.show(p, K), '|', sK, 'ball', await h.ballOf(K))
await t.press('4'); const k4 = (await t.viewRows()).includes(K); log('purch 4 has K', k4)
const rq2 = await h.requestTo(null); log('all →', rq2.msg, JSON.stringify(rq2.f.map((f) => [f.sup, f.ids.filter((x) => x === K)])))
p = await t.proj(); const k1 = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1).map((q) => q.supplierId); log('K next', JSON.stringify(k1), await h.status(K))
check('E5-3 客先指定品で最初の商社が辞退したら、次の商社の回答待ち（0/1）として購買の 4 に出て、次の商社に依頼書を出せる', /0\/1/.test(sK) && k4 && k1.length === 1 && k1[0] !== 'S3', `${sK} in4=${k4} next=${k1}`)
if (k1[0]) { await t.press('6'); await h.q(K, k1[0], 1200, 6); await t.press('Escape') }
p = await t.proj(); log('K final', h.show(p, K), '|', await h.status(K))
await t.shot('e5')
summary(); await t.close()
