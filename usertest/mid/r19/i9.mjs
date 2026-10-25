// i9: 再見積と調達区分の組み合わせ
//   mode=supplyreq: 正式見積済の行の必要数を変えて（再見積要・再発行）、そのあと支給品にする → 購買に用事が残らないか
//   mode=partial  : 必要数を 3 倍にした正式見積済の行で、再見積を 1 社（立花）にだけ頼む → 残りの 2 社の旧数量の回答の扱い
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'supplyreq'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const Y = fr[1].id, ad = fr[1].adoptedSupplierId, q0 = fr[1].qtyNeeded
{ const q = p.quotes.find((x) => x.rowId === Y && x.supplierId === ad && !x.stale); await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await t.role('design'); await t.press('1'); log('Y qty →', await t.setCellKey(Y, 'qtyNeeded', String(q0 * 3))); log('publish →', await t.publish('2'))
p = await t.proj(); log('Y', h.show(p, Y), '|', await h.status(Y))
if (mode === 'supplyreq') {
  await t.showCol('procurement'); log('Y → 支給品', await t.setCellKey(Y, 'procurement', '支給品')); log('publish →', await t.publish('1'))
  p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y after 支給品', h.show(p, Y), '|', await h.status(Y), 'ball', await h.ballOf(Y))
  await t.role('purchasing'); await t.press('1'); await t.goto(Y); await t.press('Home'); await t.press('x'); await page.waitForTimeout(80); log('purch x →', await t.toast())
  p = await t.proj(); const r2 = p.rows.find((r) => r.id === Y)
  await t.press('9'); const in9 = (await t.viewRows()).includes(Y); await t.press('4'); const in4 = (await t.viewRows()).includes(Y)
  log('after x', h.show(p, Y), '|', await h.status(Y), 'ball', await h.ballOf(Y), 'in 9', in9, 'in 4', in4)
  check('I9-1 支給品にした行に「再見積要」「再発行」が残らない（購買の 9・4 に用事として残らない）', !r2.flags.requote && !r2.flags.reissue && !in9, `${h.show(p, Y)} | ${await h.status(Y)} | in9=${in9}`)
} else {
  await t.role('purchasing'); const r = await h.requestTo('S2'); log('requote S2 only →', r.msg, JSON.stringify(r.f.map((f) => [f.sup, f.ids.includes(Y)])))
  p = await t.proj(); log('Y after', h.show(p, Y), '|', await h.status(Y), 'all quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === Y).map((q) => [q.supplierId, q.stale ? 'stale' : 'live', q.unitPrice, q.quoteQty ?? null])))
  await t.press('6'); log('S2 answer', await h.q(Y, 'S2', 380, 3)); await t.press('Escape')
  p = await t.proj(); log('Y after S2 answer', h.show(p, Y), '|', await h.status(Y))
  const live = p.quotes.filter((q) => q.rowId === Y && !q.stale && q.unitPrice != null).map((q) => q.supplierId)
  log('INFO 1 社だけに再見積を頼んだあとの行', p.rows.find((x) => x.id === Y).status, '有効な回答', live.join(','), '（旧数量の回答の商社を含む）')
  check('I9-2 1 社だけに再見積を頼んだ行で、頼んでいない商社の旧数量（' + q0 + '）の回答が新しい数量（' + q0 * 3 + '）の見積として何の印もなくスコアに入らない', !live.some((s) => s !== 'S2') || /旧数量|数量が違|再見積/.test(await h.status(Y)), `live=${live} status=${await h.status(Y)}`)
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('i9-' + mode)
summary(); await t.close()
