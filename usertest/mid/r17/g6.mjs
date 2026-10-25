// g6: 正式依頼を出したあとで採用が外れる「調達区分の切り替え以外」の経路で、元の商社への正式依頼の取下げが購買に分かるか
//   mode=requote: 正式見積済の行の数量変更 → 購買が「再見積（概算見積を依頼）」を選ぶ
//   mode=model  : 正式依頼中の行の型式変更（指摘対応でない）→ 再見積 → 別の商社で採用 → 正式依頼
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'requote'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[1].id, ad = fr[1].adoptedSupplierId
const fno = () => JSON.stringify(p.quotes.filter((q) => q.rowId === Y).map((q) => [q.supplierId, q.stale ? 'stale' : 'live', q.formalRequestNo ?? null, q.formalPrice ?? null]))
if (mode === 'requote') {
  const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === ad && !q.stale)
  await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
  await t.role('design'); await t.press('1'); const q0 = p.rows.find((r) => r.id === Y).qtyNeeded; await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3)); log('publish →', await t.publish('2'))
  p = await t.proj(); log('after qty', h.show(p, Y), '|', await h.status(Y), 'fno', fno())
  await t.role('purchasing'); await t.press('9'); await t.goto(Y); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
  const o = (await t.panel())?.options ?? []; log('quickfix', JSON.stringify(o))
  const i = o.findIndex((x) => x.includes('再見積（概算見積を依頼）')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150)
  const pr = await t.panel(); log('request panel', pr?.title, JSON.stringify(pr?.options ?? [])); await t.press('Enter'); await page.waitForTimeout(1300); log('requote →', await t.toast())
} else {
  await t.role('design'); await t.press('1'); await t.setCellKey(Y, 'model', 'NEWMODEL-9'); log('publish →', await t.publish('2'))
}
p = await t.proj(); const r1 = p.rows.find((r) => r.id === Y)
await t.role('purchasing'); await t.press('1'); await t.goto(Y); await t.press('Home'); const sb = (await t.status()).slice(0, 160)
log('after', h.show(p, Y), 'withdrawn', r1.flags.formalWithdrawn ?? '-', '|', await h.status(Y), 'fno', fno()); log('statusbar', sb)
check(`G6-1 (${mode}) 正式依頼（${ad} F1）を出した行の採用が外れたら、元の商社への取下げが購買に分かる（調達区分の切り替えと同じ「正式依頼取下げ」）`, !!r1.flags.formalWithdrawn || /取下げ|取り下げ/.test(await h.status(Y)) || /取り下げ/.test(sb), `withdrawn=${r1.flags.formalWithdrawn} status=${await h.status(Y)} fno=${fno()}`)
if (mode === 'requote') {
  check('G6-2 数量を 3 倍にした行で「再見積（概算見積を依頼）」を選んだら、新しい数量の回答が来るまで見積中（旧数量の回答で即「見積済」にしない）', r1.status === 'quoting', `${h.show(p, Y)} | ${await h.status(Y)} qty=${r1.qtyNeeded}`)
  await t.role('design'); await t.press('1'); await t.goto(Y); await t.press('a'); await page.waitForTimeout(80); const ma = await t.toast(); p = await t.proj(); log('design a →', ma, '|', h.show(p, Y))
}
await t.shot('g6-' + mode)
summary(); await t.close()
