// 打って ↑ を続けて分類の境目をまたぐ（R026 → R025 → 見出し → R024）
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, sleep, row, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y12_up_header')
const eff = async (id) => { const r = await row(page, id); return r.working?.qtyNeeded ?? r.qtyNeeded }
await fresh(page); await sel(page, 'R026'); await gotoCol(page, '必要数')
const before = { R024: await eff('R024'), R025: await eff('R025'), R026: await eff('R026') }
for (const v of ['7', '8', '9', '6']) { await typeReal(page, v); await sleep(40); await page.keyboard.press('ArrowUp'); await sleep(80); const u = await ui(page); log(`typed ${v} ↑ → cur=${u.cursorRow} mode=${u.mode} toast=${await T.toast(page)}`) }
await shot(page, 'y12_up_header')
log('before', JSON.stringify(before), 'after', JSON.stringify({ R023: await eff('R023'), R024: await eff('R024'), R025: await eff('R025'), R026: await eff('R026') }))
log('== 同じことを ↓ で（R023 → R024 → R025）')
await fresh(page); await sel(page, 'R023'); await gotoCol(page, '必要数')
for (const v of ['7', '8', '9']) { await typeReal(page, v); await sleep(40); await page.keyboard.press('ArrowDown'); await sleep(80); const u = await ui(page); log(`typed ${v} ↓ → cur=${u.cursorRow} mode=${u.mode} toast=${await T.toast(page)}`) }
log('after', JSON.stringify({ R023: await eff('R023'), R024: await eff('R024'), R025: await eff('R025') }))
save(errors); await browser.close()
