import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design'); await t.press('1')
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(200)
const p = await t.proj()
for (const r of p.rows.filter((r) => r.orderQty != null && r.orderQty > r.qtyNeeded)) { const q = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale); log(r.id, r.name, 'qty', r.qtyNeeded, r.unit, 'packQty', r.packQty, 'moq', q?.moq, '→ orderQty', r.orderQty, 'amount', q.unitPrice * r.orderQty) }
await t.press('1'); await t.goto('R060'); await t.press(' '); log('R060 detail:', (await page.getByTestId('detail').textContent()).slice(0, 300))
log('R060 amount cell:', await t.cell('R060', 'amount'), 'money', await t.money())
await t.close()
