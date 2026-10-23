// c2b: 型式変更後の再見積。(b) メーカがパナソニックに変わった行を「相見積先すべて」で再見積、(c) 同じメーカで型式だけ変わった行を一部の商社に再見積
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const rule = process.argv[2] ?? 'all'
const direct = process.argv[3] === 'direct'
const label = { all: '全社', min2: '2社以上', deadline: '期限' }[rule]
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', 'メーカ変更リレー', 'G2R-1 DC24', 'オムロン', '相見積')
const C = await h.addRow(A, '型式変更リレー', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', label, '完了条件'))
log('request all →', (await h.requestTo(null)).msg)
await t.press('6'); for (const id of [A, C]) for (const [sid, pr, ld] of [['S1', 1500, 5], ['S2', 1450, 6], ['S3', 1600, 4]]) await h.q(id, sid, pr, ld); await t.press('Escape')
let p = await t.proj(); log('quoted', h.show(p, A)); log('quoted', h.show(p, C))
await t.role('design'); await t.press('1')
await t.setCellKey(A, 'model', 'APAN1234'); await t.setCellKey(A, 'maker', 'パナソニック'); await t.setCellKey(C, 'model', 'G2R-2-S DC24')
log('publish change →', await t.publish('1'))
p = await t.proj(); log('A after', h.show(p, A), '|', await h.status(A)); log('C after', h.show(p, C), '|', await h.status(C))
check('C2b-0 型式を変えて公開した時点では、まだ依頼していない再見積の枠を作らない（回答待ちに数えない）', !p.quotes.some((q) => [A, C].includes(q.rowId) && !q.stale), JSON.stringify(p.quotes.filter((q) => [A, C].includes(q.rowId) && !q.stale).map((q) => [q.rowId, q.supplierId])))
await t.role('purchasing')
// C を因幡だけに再見積（A も因幡に行くか）
if (!direct) {
const r1 = await h.requestTo('S1'); log('S1 only →', r1.msg, JSON.stringify(r1.f.map((f) => [f.sup, f.ids.filter((x) => [A, C].includes(x))])))
check('C2b-1 パナソニックになった A は、扱わない因幡への依頼書に入らない', !r1.f.some((f) => f.ids.includes(A)))
const r2 = await h.requestTo('S2'); log('S2 later →', r2.msg, JSON.stringify(r2.f.map((f) => [f.sup, f.ids.filter((x) => [A, C].includes(x))])))
check('C2b-2 型式だけ変わった C の再見積を、後から立花にも頼める', r2.f.some((f) => f.ids.includes(C)), r2.msg)
}
const r3 = await h.requestTo(null); log('all →', r3.msg, JSON.stringify(r3.f.map((f) => [f.sup, f.ids.filter((x) => [A, C].includes(x))])))
p = await t.proj(); log('A', h.show(p, A), '|', await h.status(A)); log('C', h.show(p, C), '|', await h.status(C))
// 再見積の回答
await t.press('6'); await h.q(A, 'S2', 2000, 5); await h.q(A, 'S3', 2100, 6); await t.press('Escape')
p = await t.proj(); const stA = p.rows.find((r) => r.id === A).status; log('A after S2,S3', h.show(p, A), '|', await h.status(A))
check(`C2b-3 (${label}) パナソニックを扱う立花・ミスミが答えたら見積済（扱わない因幡の空の枠を待たない）`, stA === 'quoted', stA)
await t.press('4'); log('purch 4 has A', (await t.viewRows()).includes(A))
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('Home'); await t.press('a'); await page.waitForTimeout(80); log('design a on A →', await t.toast())
summary(); await t.close()
