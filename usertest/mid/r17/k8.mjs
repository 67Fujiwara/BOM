// k8: 全社辞退の相見積の行（M16-07 の修正: Ctrl+.「ほかの商社に依頼する」「設計に代替を相談する」）
//   F: 3 社辞退 → 購買 Ctrl+.「ほかの商社に依頼する」→ 依頼のパネル（RS が無ければ案件設定で足す）→ RS の回答 → a → 正式見積は RS へ
//   G: 3 社辞退 → 購買 Ctrl+.「設計に代替を相談する」→ 設計のボール・指摘
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('purchasing')
let p = await t.proj()
const cands = p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積' && !r.working && r.maker && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const F = cands[0].id, G = cands[1].id
log('F', h.show(p, F)); log('G', h.show(p, G))
for (const id of [F, G]) for (const sid of ['S1', 'S2', 'S3']) await h.decline(id, sid)
p = await t.proj(); log('F', h.show(p, F), '|', await h.status(F))
await t.press('1'); await t.goto(F); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(100); let qf = await t.panel(); log('Ctrl+. F', JSON.stringify(qf?.options ?? []))
const oi = (qf?.options ?? []).findIndex((o) => /ほかの商社に依頼/.test(o))
check('K8-1 全社辞退の行の Ctrl+. に「ほかの商社に依頼する」「設計に代替を相談する」', oi >= 0 && (qf?.options ?? []).some((o) => /代替を相談/.test(o)), JSON.stringify(qf?.options ?? []))
let reqPanel = null
if (oi >= 0) { for (let k = 0; k < oi; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); reqPanel = await t.panel(); log('request panel', reqPanel?.title, JSON.stringify(reqPanel?.options ?? [])); await t.press('Escape'); await t.press('Escape') }
let hasRS = (reqPanel?.options ?? []).some((o) => /RS/.test(o))
log('INFO 依頼のパネルに RS が', hasRS ? 'ある' : '無い（案件設定で足す）')
if (!hasRS) { log('settings +S4 →', await h.setting('supplierIds', 'S1,S2,S3,S4', 'RS を追加')); p = await t.proj(); log('supplierIds', JSON.stringify(p.supplierIds)) }
const r4 = await h.requestTo('S4'); log('request S4 →', r4.msg, JSON.stringify(r4.f.map((f) => [f.sup, f.ids])))
const fileRS = r4.f.find((f) => /RS/.test(f.sup))
check('K8-2 RS への依頼書に全社辞退の行（F・G）が入り、ほかの見積済の行は入らない', !!fileRS && fileRS.ids.includes(F) && fileRS.ids.every((id) => [F, G].includes(id)), JSON.stringify(r4.f.map((f) => [f.sup, f.ids])))
p = await t.proj(); log('F after request', h.show(p, F), '|', await h.status(F), 'targets', JSON.stringify(p.rows.find((r) => r.id === F).quoteTargets))
const s1 = await h.status(F)
check('K8-3 依頼のあとは見積中で RS の回答を待つ（「有効な見積なし」のままにしない・回答数に RS が入る）', /見積中/.test(s1) && !/有効な見積なし/.test(s1), s1)
await t.press('6'); log('S4 answer', await h.q(F, 'S4', 999, 5)); await t.press('Escape')
p = await t.proj(); log('F after RS answer', h.show(p, F), '|', await h.status(F), 'ball', await h.ballOf(F))
await t.role('design'); await t.press('1'); await t.goto(F); await t.press('a'); await page.waitForTimeout(100); log('design a →', await t.toast())
p = await t.proj(); const rF = p.rows.find((r) => r.id === F); log('F adopted', h.show(p, F))
check('K8-4 RS の回答で見積済 → a で RS を採用', rF.adoptedSupplierId === 'S4' && rF.status === 'selected', h.show(p, F))
await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); const f0 = await h.files(n0)
log('formal →', fm, JSON.stringify(f0.filter((f) => f.ids.includes(F)).map((f) => f.sup)))
check('K8-5 正式見積の依頼が RS に出る', f0.some((f) => /RS/.test(f.sup) && f.ids.includes(F)), JSON.stringify(f0.map((f) => [f.sup, f.ids.length])))
// G: 設計に代替を相談
p = await t.proj(); log('G now', h.show(p, G), '|', await h.status(G))
await t.press('1'); await t.goto(G); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(100); qf = await t.panel(); const gi = (qf?.options ?? []).findIndex((o) => /代替を相談/.test(o)); log('Ctrl+. G', JSON.stringify(qf?.options ?? []))
if (gi >= 0) { for (let k = 0; k < gi; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); let pn = await t.panel(); log('after pick', pn?.kind, pn?.title); let g = 0; while (pn && g++ < 3) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); pn = await t.panel() } log('toast', await t.toast()); log('publish →', await t.publish()) } else await t.press('Escape')
p = await t.proj(); log('G after', h.show(p, G), 'issues', JSON.stringify(p.issues.filter((i) => i.rowId === G).map((i) => [i.id, i.kind, i.status, i.text.slice(0, 40)])), 'ball', await h.ballOf(G))
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(G)
check('K8-6 「設計に代替を相談する」で指摘が設計に届く（設計のボール・4）', d4 && (await h.ballOf(G)) === 'design', `d4=${d4} ball=${await h.ballOf(G)}`)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('k8')
summary(); await t.close()
