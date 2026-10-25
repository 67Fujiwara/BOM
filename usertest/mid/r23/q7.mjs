// q7: 納期NG に PM が手を打った（受入／特急・分納／代替品検討）あと、設計が採用を別の商社に選び直す（Shift+A）。前の商社への対策（対策区分・特急・追加費用）が新しい採用に持ち越されないか
//   usage: node q7.mjs accept|express|alt
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck } from './plib.mjs'
const mode = process.argv[2] ?? 'accept'; const tag = 'Q7-' + mode
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('2'); log('bulk →', (await t.bulk()).slice(0, 40))
await t.setTime(mode === 'next' ? '2026-11-05T09:00:00+09:00' : '2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300)
let p = await t.proj()
const needOf = (id) => page.evaluate(async (id) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); return d.rowNeedDate(pp, pp.rows.find((r) => r.id === id)) }, id)
const cands = p.rows.filter((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.pmPending && !r.working)
let X = null, alt = null
for (const r of cands) {
  const need = await needOf(r.id); const qs = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0 && q.supplierId !== r.adoptedSupplierId)
  // 別の商社（遅くても速くてもよい）。まず「別の商社も間に合わない」行、無ければ速い商社
  const aq = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale)
  const slow = qs.filter((q) => q.leadDays >= aq.leadDays)
  const pickq = mode === 'accept' ? slow[0] : qs[0]
  if (pickq) { X = r.id; alt = pickq.supplierId; log('need', need, 'adopted lead', aq.leadDays, 'alt', alt, pickq.leadDays); break }
}
if (!X) { check(tag + '-0 前提', false, 'no row'); summary(); await t.close(); process.exit(0) }
log('X', h.show(p, X).slice(0, 240))
await t.role('pm'); await t.press('7')
if (mode === 'accept') log('PM Y 受入 →', (await t.decide(X, 'Shift+Y', '受入')).toast.slice(0, 60))
if (mode === 'express' || mode === 'consol') { log('PM e →', (await t.decide(X, 'e', '特急で', { 上限金額: '30000' })).toast.slice(0, 60)); await t.role('purchasing'); await t.press('3'); log('extraCost →', (await t.setCellKey(X, 'extraCost', '20000')).slice(0, 40)); await t.press('Escape') }
if (mode === 'next') { // 特急・分納 → 正式依頼 → 差分超過 → PM が次点へ（b）
  log('PM e →', (await t.decide(X, 'e', '特急で', { 上限金額: '30000' })).toast.slice(0, 60)); await t.role('purchasing'); await t.press('3'); log('extraCost →', (await t.setCellKey(X, 'extraCost', '20000')).slice(0, 30)); await t.press('Escape')
  log('formal →', (await t.requestFormal()).slice(-40)); p = await t.proj(); const q = p.quotes.find((q) => q.rowId === X && q.supplierId === p.rows.find((r) => r.id === X).adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(Math.round(q.unitPrice * 1.6) + 30000)); await t.press('Escape'); await t.press('Escape'); p = await t.proj(); log('X diff', h.show(p, X).slice(0, 200), 'case', await h.caseOf(X))
  await t.role('pm'); await t.press('7'); log('PM b →', (await t.decide(X, 'b', '次点へ')).toast.slice(0, 100)); p = await t.proj(); const rn = p.rows.find((r) => r.id === X)
  log('X after b', h.show(p, X).slice(0, 260), 'extra', rn.extraCost, rn.extraCostKind, 'cm', rn.flags.countermeasure)
  check(tag + '-1 次点へで商社が変わったら、前の商社への追加費用（特急・分納）が外れる', rn.extraCost == null, `adopt=${rn.adoptedSupplierId} extra=${rn.extraCost}`)
  check(tag + '-2 次点へで商社が変わったら、前の商社への特急・分納の対策区分が外れる（商社変更に付け替わる）', rn.flags.countermeasure !== '分納・特急', `cm=${rn.flags.countermeasure}`)
  const sk0 = await stuck(t); check(tag + '-4 固まる行がない', sk0.length === 0, sk0.slice(0, 3)); errs(t, tag + '-99'); summary(); await t.close(); process.exit(0)
}
if (mode === 'alt') log('PM d →', (await t.decide(X, 'd', '代替を検討')).toast.slice(0, 60))
p = await t.proj(); let r1 = p.rows.find((r) => r.id === X); log('X after PM', h.show(p, X).slice(0, 260), 'extra', r1.extraCost, r1.extraCostKind, 'cm', r1.flags.countermeasure)
const money0 = await t.money()
// 設計が別の商社に選び直す
await t.role('design'); await t.press('1')
if (mode === 'consol') {
  await t.role('design'); await t.press('2'); await t.cmd('商社を集約'); await page.waitForTimeout(200); const cp = await t.panel(); log('consolidate panel', JSON.stringify(cp?.options)?.slice(0, 300))
  const nm = (await t.ws()).suppliers.find((s) => s.id === alt).name; const ci = (cp?.options ?? []).findIndex((o) => o.startsWith(nm + ' ') || o.startsWith(nm + ' ::') || o === nm || (o.includes(nm) && !o.includes('+ ')))
  log('consolidate idx', ci); for (let k = 0; k < Math.max(ci, 0); k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); const p2n = await t.panel(); log('confirm panel', JSON.stringify(p2n)?.slice(0, 200)); if (p2n?.kind === 'prompt') { const j = (p2n.options ?? []).findIndex((o) => /集約する|採用する/.test(o)); for (let k = 0; k < Math.max(j, 0); k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  log('consolidate →', (await t.toast()).slice(0, 100))
}
const order = mode === 'consol' ? [alt] : await page.evaluate(async (id) => { const sc = await import(window.__m('/src/core/score.ts').replace('/core/', '/model/')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); return sc.scoreRow(pp, pp.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => x.supplierId) }, X)
const idx = order.indexOf(alt); log('score order', JSON.stringify(order), 'alt idx', idx)
if (mode !== 'consol') { const ap2 = await h.adoptPick(X, idx + 1, '6', '選び直し'); log('re-adopt →', ap2.toast.slice(0, 100)) }
p = await t.proj(); const r2 = p.rows.find((r) => r.id === X); log('X after re-adopt', h.show(p, X).slice(0, 280), 'extra', r2.extraCost, r2.extraCostKind, 'cm', r2.flags.countermeasure, 'early', r2.flags.early)
log('money', money0, '→', await t.money(), 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
if (r2.adoptedSupplierId !== alt) { check(tag + '-0 再採用できた', false, h.show(p, X).slice(0, 200)) } else {
  const need = await needOf(X); const aq = p.quotes.find((q) => q.rowId === X && q.supplierId === alt && !q.stale)
  const late = aq.leadDays > 0 && (await page.evaluate(async ([ld]) => { const dt = await import(window.__m('/src/model/dates.ts')); return dt.addDays('2026-11-20', ld) }, [aq.leadDays])) > need
  log('new supplier lead', aq.leadDays, 'late?', late)
  check(tag + '-1 前の商社への追加費用（特急・分納）が新しい採用に持ち越されない', r2.extraCost == null || r2.extraCost === 0, `extra=${r2.extraCost} ${r2.extraCostKind}`)
  check(tag + '-2 前の商社への対策区分（受入／特急・分納／代替品検討）が新しい採用に持ち越されない（新しい商社が間に合わなければ納期NG としてPM に出る）', !(late && !r2.flags.leadNG && ['受入', '分納・特急', '代替品検討'].includes(r2.flags.countermeasure ?? '')), `late=${late} leadNG=${r2.flags.leadNG} cm=${r2.flags.countermeasure} early=${r2.flags.early}`)
  check(tag + '-3 前の商社への「特急」の印（early）が持ち越されない', !r2.flags.early, String(r2.flags.early))
}
const sk = await stuck(t); check(tag + '-4 固まる行がない', sk.length === 0, sk.slice(0, 3))
errs(t, tag + '-99'); summary(); await t.close()
