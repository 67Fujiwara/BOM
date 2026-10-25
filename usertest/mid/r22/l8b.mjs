// l8b: 概算で「在庫」と答えた商社が、正式見積で正式納期 60 日と答えた → 納期NG（§4 フラグ 納期NG「採用商社の納期が必要日を超える」）・PM の 7
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale)?.stock === '在庫')?.id
const Y = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && r.id !== X && (p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale)?.stock ?? '') !== '在庫')?.id
log('X (在庫)', h.show(p, X), 'need', await t.cellText(X, 'needDate').catch(() => '?')); log('Y (在庫でない)', h.show(p, Y))
for (const id of [X, Y]) { const r = p.rows.find((x) => x.id === id); const q = p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', '60'); await t.press('Escape') }
p = await t.proj()
for (const id of [X, Y]) { const r = p.rows.find((x) => x.id === id); const q = p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale); log(id, r.status, 'stock', q.stock, 'formalLead', q.formalLeadDays, 'leadNG', r.flags.leadNG ?? false, 'case', await h.caseOf(id), '|', await h.status(id)) }
const rY = p.rows.find((x) => x.id === Y), rX = p.rows.find((x) => x.id === X)
check('L8B-0 （対照）在庫でない商社の正式納期 60 日は納期NG になる', !!rY.flags.leadNG, h.show(p, Y))
check('L8B-1 概算で「在庫」でも、正式納期 60 日（必要日 11-13 を超える）なら納期NG になり PM の 7 に載る', !!rX.flags.leadNG, `${h.show(p, X)} case=${await h.caseOf(X)}`)
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
