// 商社集約の試算の検算（localStorage のデータから）
import { launch, log, check } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const p = await t.proj()
const today = new Date().toISOString().slice(0, 10)
const rows = p.rows.filter((r) => r.status === 'quoted' || r.status === 'selected')
const valid = (r) => p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.unitPrice > 0 && q.leadDays !== -1 && (!q.validUntil || q.validUntil >= today))
const eff = (q, r) => { const qty = r.orderQty ?? r.qtyNeeded; const moq = q.moq ?? 0; return moq > qty ? (q.unitPrice * moq) / qty : q.unitPrice }
let cur = 0
for (const r of rows) { const vs = valid(r); if (!vs.length) continue; const a = r.adoptedSupplierId ? vs.find((q) => q.supplierId === r.adoptedSupplierId) : null; const q = a ?? vs.sort((x, y) => eff(x, r) - eff(y, r))[0]; cur += eff(q, r) * r.qtyNeeded }
log('rows:', rows.length, 'current(≈ 最安基準):', Math.round(cur))
const noS2 = rows.filter((r) => !valid(r).some((q) => q.supplierId === 'S2'))
log('rows without S2 valid quote:', noS2.map((r) => `${r.id} ${r.name} qty${r.qtyNeeded} ${valid(r).map((q) => q.supplierId + ':' + q.unitPrice + '/moq' + q.moq).join(' ')}`))
log('their cost (best eff × qty):', Math.round(noS2.reduce((s, r) => { const vs = valid(r); if (!vs.length) return s; const q = vs.sort((x, y) => eff(x, r) - eff(y, r))[0]; return s + eff(q, r) * r.qtyNeeded }, 0)))
await t.press('Control+k'); await page.getByTestId('palette-input').fill('集約'); await t.press('Enter'); await page.waitForTimeout(200)
log('panel:', (await page.locator('[role=dialog]').textContent()).slice(0, 400))
await t.press('Escape')
await t.close()
