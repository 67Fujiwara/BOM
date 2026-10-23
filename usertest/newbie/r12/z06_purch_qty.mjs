// 購買: 発注数のけた違い・単価のけた違い（9・6・3）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, proj, sleep, shot, row, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z06_purch_qty')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} | toast: ${await T.toast(page)}`) }
log('== 9: R004 発注数に 1500 Enter')
await fresh(page, 'purchasing'); await sleep(100); await st('start')
await gotoCol(page, '発注数'); await st('col')
let r = await row(page, 'R004'); log('  R004 need', r.qtyNeeded, 'oq', r.orderQty)
await typeReal(page, '1500'); await page.keyboard.press('Enter'); await sleep(150); await st('1500 Enter')
r = await row(page, 'R004'); log('  R004 oq', r.orderQty, JSON.stringify(r.flags))
await typeReal(page, '1480'); await page.keyboard.press('ArrowDown'); await sleep(150); await st('1480 ↓')
log('== 9: 単価 2621 → 86（ビューを変えるつもり）')
await fresh(page, 'purchasing'); await sleep(100)
r = await proj(page); const q0 = r.quotes.find((q) => q.rowId === 'R004' && q.supplierId === 'S1'); log('  before', q0.unitPrice)
await typeReal(page, '86'); await page.keyboard.press('Enter'); await sleep(150); await st('86 Enter')
r = await proj(page); log('  after', r.quotes.find((q) => q.rowId === 'R004' && q.supplierId === 'S1').unitPrice)
log('== 6: 単価 12000（1 桁多い）')
await fresh(page, 'purchasing'); await page.keyboard.press('Alt+6'); await sleep(150); await st('Alt+6')
const u = await ui(page); r = await proj(page); const id = u.cursorRow; const sup = u.cursorCol.split('@')[1]
log('  before', id, sup, r.quotes.find((q) => q.rowId === id && q.supplierId === sup)?.unitPrice)
await typeReal(page, '120000'); await page.keyboard.press('Enter'); await sleep(150); await st('120000 Enter')
r = await proj(page); log('  after', r.quotes.find((q) => q.rowId === id && q.supplierId === sup)?.unitPrice)
save(errors); await browser.close()
