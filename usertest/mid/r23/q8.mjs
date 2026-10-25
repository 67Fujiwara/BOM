// q8: 承認 ON。再見積要になる変更（必要数 ×3+5／置換）を公開 → PM が却下 → 再見積要の印・見積・採用・納期NG が公開値のまま残る（却下で公開を取り消して作業中に戻す）。承認 → 概算の取り直しまで通す
//   usage: node q8.mjs qty|repl reject|approve
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { checkInv } from './nlib.mjs'
import { errs, stuck } from './plib.mjs'
const kind = process.argv[2] ?? 'qty'; const dec = process.argv[3] ?? 'reject'; const tag = `Q8-${kind}-${dec}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup(); let p = await t.proj()
await t.setTime('2026-11-20T09:00:00+09:00'); await page.waitForTimeout(300); p = await t.proj()
const X = (p.rows.find((r) => r.flags.leadNG && r.adoptedSupplierId && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.pmPending && !r.working) ?? sel[0]).id
const r0 = p.rows.find((r) => r.id === X); log('X', h.show(p, X).slice(0, 220))
const snapQ = (pp) => JSON.stringify(pp.quotes.filter((q) => q.rowId === X).map((q) => [q.supplierId, q.stale ? 'stale' : 'live', q.unitPrice]))
const q0 = snapQ(p)
await t.role('design'); await t.press('1')
if (kind === 'qty') log('qty →', (await t.setCellKey(X, 'qtyNeeded', String(r0.qtyNeeded * 3 + 5))).slice(0, 30))
else log('replace →', await t.replace(X, 'Q8-NEW-1'))
log('publish →', (await t.publish('1')).slice(-50)); p = await t.proj(); log('X pending', h.show(p, X).slice(0, 260), 'requote', p.rows.find((r) => r.id === X).flags.requote)
await t.role('pm'); await t.press('7')
const r = dec === 'reject' ? await t.decide(X, 'Shift+Y', '却下する') : await t.yes(X, '承認'); log('PM', dec, '→', r.toast.slice(0, 80))
p = await t.proj(); const r1 = p.rows.find((x) => x.id === X); log('X after PM', h.show(p, X).slice(0, 300), 'requote', r1.flags.requote, 'ball', await h.ballOf(X), 'case', await h.caseOf(X))
if (dec === 'reject') {
  check(`${tag}-1 却下で再見積要の印が残らない（公開値のまま・見積は有効）`, !r1.flags.requote && snapQ(p) === q0, `requote=${r1.flags.requote} ${snapQ(p)}`)
  check(`${tag}-2 却下で採用・状態が公開値のまま`, r1.adoptedSupplierId === r0.adoptedSupplierId && r1.status === r0.status, h.show(p, X).slice(0, 200))
  // 購買が概算を依頼しても、却下された行は取り直さない
  await t.role('purchasing'); const rq = await h.requestTo(null); log('rough →', rq.msg.slice(0, 70), JSON.stringify(rq.f.map((f) => f.ids.includes(X))))
  p = await t.proj(); const r2 = p.rows.find((x) => x.id === X); check(`${tag}-3 却下された行は概算の取り直しで採用を外されない`, r2.adoptedSupplierId === r0.adoptedSupplierId && snapQ(p) === q0, h.show(p, X).slice(0, 200))
} else {
  await t.role('purchasing'); const rq = await h.requestTo(null); log('rough →', rq.msg.slice(0, 70), JSON.stringify(rq.f.map((f) => f.ids.includes(X))))
  p = await t.proj(); const r2 = p.rows.find((x) => x.id === X); log('X after rough', h.show(p, X).slice(0, 300))
  if (kind === 'qty') check(`${tag}-1 承認した行を概算で取り直すと、採用・納期NG・対策が外れ、PM の 7 に載らない`, !r2.adoptedSupplierId && !r2.flags.leadNG && r2.status === 'quoting' && (await h.ballOf(X)) === 'purchasing', h.show(p, X).slice(0, 200))
}
checkInv(`${tag}-8`, await t.proj()); const sk = await stuck(t); check(`${tag}-9 固まる行がない`, sk.length === 0, sk.slice(0, 3))
errs(t, tag + '-99'); summary(); await t.close()
