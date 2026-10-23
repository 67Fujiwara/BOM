import { launch, fresh, T, sel, gotoCol, row, ui, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
const word = process.argv[2] ?? 'Analog Devices', id = process.argv[3] ?? 'R049', col = process.argv[4] ?? 'メーカ', delay = Number(process.argv[5] ?? 30)
await fresh(page); await page.keyboard.press('1')
await sel(page, id); await gotoCol(page, col)
const r0 = await row(page, id)
console.log('start', id, r0.status, r0.adoptedSupplierId)
for (const ch of word) {
  await page.keyboard.type(ch); await page.waitForTimeout(delay)
  const u = await ui(page)
  console.log(JSON.stringify(ch), u.mode, u.cursorRow, u.cursorCol, JSON.stringify(u.editValue), u.panel, '|', await T.toast(page))
}
await page.keyboard.press('Enter'); await page.waitForTimeout(100)
const p = await proj(page)
for (const r of p.rows) { if (['R016', 'R017', id].includes(r.id)) console.log(r.id, r.status, r.adoptedSupplierId, r.adoptReason, JSON.stringify(r.working), r.model, r.maker, r.name) }
console.log('events tail', JSON.stringify(p.events.slice(-4).map(e => [e.rowId, e.kind ?? e.type, e.text ?? e.label ?? ''])))
await browser.close(); console.log(errors)
