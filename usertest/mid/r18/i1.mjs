// i1: 正式依頼取下げ（M14-07 / U14-01 の修正）を経路ごとに作り、購買の 4・F8・ステータスバー・x で外す
//   経路: (a) 別の商社の指定商社 (b) 支給品 (c) 数量変更 → 9 の Ctrl+. 再見積 (d) PM の差分超過 → b 次点
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const NAMES = { S1: '因幡電機', S2: '立花エレテック', S3: 'ミスミ' }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const nextOk = async (id) => page.evaluate(async (id) => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === id); return !!m.nextBest?.(p, r, s.ws.suppliers) }, id)
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
let D = null
for (const r of fr.slice(4)) { if (await nextOk(r.id)) { D = r.id; break } }
const [XA, XB, XC] = [fr[0].id, fr[1].id, fr[2].id]
const ad = Object.fromEntries([XA, XB, XC, D].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
log('rows', JSON.stringify(ad))
await t.press('8')
for (const id of [XB, XC]) { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === ad[id] && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
{ const r = p.rows.find((x) => x.id === D); const q = p.quotes.find((x) => x.rowId === D && x.supplierId === ad[D] && !x.stale); await t.setCellKey(D, 'q.formalPrice@A', String(q.unitPrice + Math.ceil(40000 / Math.max(1, r.orderQty ?? r.qtyNeeded)))); await t.press('Escape') }
await t.press('Escape')
p = await t.proj(); for (const id of [XA, XB, XC, D]) log('before', h.show(p, id), '|', await h.status(id))
// (a)(b)(c) 設計
const other = (sid) => (sid === 'S2' ? 'S1' : 'S2')
await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
await t.setCellKey(XA, 'procurement', '指定商社'); await t.setCellKey(XA, 'designated', NAMES[other(ad[XA])])
await t.setCellKey(XB, 'procurement', '支給品')
const q0 = p.rows.find((r) => r.id === XC).qtyNeeded; await t.setCellKey(XC, 'qtyNeeded', String(q0 * 3))
log('publish →', await t.publish('1'))
// (c) 購買の再見積
await t.role('purchasing'); await t.press('9'); await t.goto(XC); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
{ const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes('再見積（概算見積を依頼）')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); await t.press('Enter'); await page.waitForTimeout(1300); log('requote →', await t.toast()) }
// (d) PM 次点
await t.role('pm'); await t.press('7'); const dec = await t.decide(D, 'b', '次点へ'); log('PM b →', dec.toast)
p = await t.proj()
const W = {}
for (const id of [XA, XB, XC, D]) { const r = p.rows.find((x) => x.id === id); W[id] = r.flags.formalWithdrawn ?? ''; log('after', h.show(p, id), 'withdrawn=', W[id] || '-', '|', await h.status(id)) }
check('I1-1 4 経路（指定商社・支給品・再見積・PM 次点）すべてで「正式依頼取下げ（元の商社 依頼No）」が付く', [XA, XB, XC, D].every((id) => W[id].includes(NAMES[ad[id]]) && /F\d/.test(W[id])), JSON.stringify(W))
// 購買の 4・F8・ステータスバー
await t.role('purchasing'); await t.press('4'); const v4 = await t.viewRows()
const in4 = [XA, XB, XC, D].map((id) => v4.includes(id)); log('purch 4 has', JSON.stringify(in4), 'count4', v4.length)
check('I1-2 取下げの行は購買の 4 要確認にすべて出る', in4.every(Boolean), JSON.stringify(in4))
// F8 で回る
await t.goto(v4[0]); await t.press('Home')
const seen = new Set(); const sbs = {}
for (let i = 0; i < v4.length + 8; i++) { await page.keyboard.press('F8'); await page.waitForTimeout(60); const r = await t.curRow(); if ([XA, XB, XC, D].includes(r) && !sbs[r]) sbs[r] = (await t.status()).slice(0, 200); seen.add(r) }
log('F8 visited withdrawn', JSON.stringify([XA, XB, XC, D].map((id) => seen.has(id))))
log('statusbars', JSON.stringify(sbs))
check('I1-3 F8 で取下げの行に止まり、ステータスバーに「取り下げ…x」が出る', [XA, XB, XC, D].every((id) => seen.has(id) && /取り下げ|取下げ/.test(sbs[id] ?? '')), JSON.stringify(sbs).slice(0, 500))
// x で外す（ID 列で）
const acks = {}
for (const id of [XA, XB, XC, D]) {
  await t.press('1'); await t.goto(id); await t.press('Home'); const sb = (await t.status()).slice(0, 160)
  await t.press('x'); await page.waitForTimeout(80); acks[id] = await t.toast()
  const r = (await t.proj()).rows.find((x) => x.id === id); log('x', id, '→', acks[id], '| sb before', sb, '| flag after', r.flags.formalWithdrawn ?? '-', '|', await h.status(id))
}
p = await t.proj()
check('I1-4 購買の x で取下げの印が外れる（4 経路とも）', [XA, XB, XC, D].every((id) => !p.rows.find((r) => r.id === id).flags.formalWithdrawn), JSON.stringify(acks))
await t.press('4'); const v4b = await t.viewRows(); log('purch 4 after x', JSON.stringify([XA, XB, XC, D].map((id) => v4b.includes(id))))
check('I1-5 x のあと取下げだけの行は 4 から外れる（再見積で見積中の行など、ほかの用事がある行は残ってよい）', !v4b.includes(XB) && !v4b.includes(D), JSON.stringify([XA, XB, XC, D].map((id) => [id, v4b.includes(id), h.show(p, id)])))
// Ctrl+Z で戻せる
await t.press('1'); await t.goto(D); await page.keyboard.press('Control+z'); await page.waitForTimeout(100); p = await t.proj()
log('undo →', await t.toast(), 'D flag', p.rows.find((r) => r.id === D).flags.formalWithdrawn ?? '-')
check('I1-6 x の取下げ確認は Ctrl+Z で戻る', !!p.rows.find((r) => r.id === D).flags.formalWithdrawn, await t.toast())
// 設計・PM の x では外れない
await t.role('design'); await t.press('1'); await t.goto(D); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); const dx = await t.toast(); p = await t.proj()
log('design x on D →', dx, 'flag', p.rows.find((r) => r.id === D).flags.formalWithdrawn ?? '-')
check('I1-7 設計の x では取下げの印は外れない（購買が元の商社に伝える）', !!p.rows.find((r) => r.id === D).flags.formalWithdrawn, dx)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i1')
summary(); await t.close()
