import { launch, log } from './lib.mjs'
const t = await launch(); await t.open('design')
const p = await t.proj()
const c = {}; for (const r of p.rows) { const k = r.procurement + ':' + r.status + (r.adoptedSupplierId ? ':adopted' : ''); c[k] = (c[k] ?? 0) + 1 }
log(JSON.stringify(c))
for (const r of p.rows.filter((r) => r.procurement !== '相見積' || r.status !== 'quoted' || ['R003','R004','R020','R044','R011'].includes(r.id))) log(r.id, r.procurement, r.status, r.maker, r.designated, r.adoptedSupplierId ?? '-', r.qtyNeeded, JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([,v])=>v))), JSON.stringify(p.quotes.filter((q) => q.rowId === r.id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays, q.stock])))
log('settings', JSON.stringify(p.settings), 'due', p.dueDate)
await t.close()
