// e7: 正式依頼中・正式見積済の行で型式を変えた → 再見積要・再発行対象 → 購買が「据え置き（旧見積を有効に戻す）」
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG)
const X = fr[0].id, Y = fr[1].id
const qY = p.quotes.find((q) => q.rowId === Y && q.supplierId === fr[1].adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(Y, 'q.formalPrice@A', String(qY.unitPrice)); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); for (const id of [X, Y]) log('before', h.show(p, id), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null])))
const adoptedBefore = Object.fromEntries([X, Y].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
await t.role('design'); await t.press('1')
for (const id of [X, Y]) { const m = p.rows.find((r) => r.id === id).model; await t.setCellKey(id, 'model', m + '-Z9') }
log('publish →', await t.publish('2'))
p = await t.proj(); for (const id of [X, Y]) log('after change', h.show(p, id), '|', await h.status(id))
await t.role('purchasing'); await t.press('9')
for (const id of [X, Y]) {
  await t.goto(id); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const o = (await t.panel())?.options ?? []; log(id, 'Ctrl+.', JSON.stringify(o))
  const i = o.findIndex((x) => x.includes('据え置き（旧見積')); if (i < 0) { await t.press('Escape'); continue }
  for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); log(id, 'keep →', await t.toast())
}
p = await t.proj()
for (const id of [X, Y]) log('after keep', h.show(p, id), '|', await h.status(id), 'ball', await h.ballOf(id), 'fno', JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.formalRequestNo ?? null, q.formalPrice ?? null])))
await t.press('8'); const v8 = await t.viewRows(); log('purch 8 has X/Y', v8.includes(X), v8.includes(Y))
const rY = p.rows.find((r) => r.id === Y)
const liveFormal = p.quotes.filter((q) => q.rowId === Y && !q.stale && q.formalPrice != null && q.supplierId !== rY.adoptedSupplierId)
check('E7-1 据え置き後、採用の無い見積済の行に旧型式の正式単価・正式依頼番号を有効な見積として残さない（または採用・正式の状態ごと戻す）', !(rY.status === 'quoted' && !rY.adoptedSupplierId && p.quotes.some((q) => q.rowId === Y && !q.stale && (q.formalPrice != null || q.formalRequestNo))), h.show(p, Y))
// 設計がもう一度選ぶ → 正式見積を依頼
await t.role('design'); await t.press('1'); for (const id of [X, Y]) { await t.goto(id); await t.press('a'); await page.waitForTimeout(80); log(id, 'a →', await t.toast()) }
p = await t.proj(); for (const id of [X, Y]) log('after a', h.show(p, id), '|', await h.status(id))
await t.role('purchasing'); log('formal again →', await t.requestFormal())
p = await t.proj(); for (const id of [X, Y]) log('after formal', h.show(p, id), '|', await h.status(id), 'reissue', p.rows.find((r) => r.id === id).flags.reissue)
await t.shot('e7')
summary(); await t.close()
