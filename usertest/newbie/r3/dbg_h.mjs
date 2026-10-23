import { launch, fresh, T, sel, gotoCol, row, ui, proj, runPalette, setRole, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page, 'purchasing'); await page.keyboard.press('8'); await page.waitForTimeout(100)
console.log('view8 header', (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' '))
console.log('rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((tr) => tr.dataset.rowId).join(',')))
await sel(page, 'R001')
const cols = []
for (let i = 0; i < 20; i++) { cols.push((await T.cursor(page)).replace('R001 ', '') + ((await ui(page)).cursorCol.includes('@') ? '[' + (await ui(page)).cursorCol + ']' : '')); await page.keyboard.press('ArrowRight') }
console.log('cols', cols.join(' | '))
await page.keyboard.press('Home'); for (let i = 0; i < 20; i++) { if ((await T.cursor(page)).endsWith('正式単価')) break; await page.keyboard.press('ArrowRight') }
console.log('first 正式単価 col', (await ui(page)).cursorCol)
for (const ch of '25000') { await page.keyboard.press(ch); await page.waitForTimeout(50); const u = await ui(page); console.log(ch, 'view', u.view, 'mode', u.mode, 'cursor', u.cursorRow, u.cursorCol, JSON.stringify(u.editValue), '|', await T.toast(page)) }
await page.keyboard.press('Escape')
await shot(page, 'dbg_h_view8')
await browser.close(); console.log(errors)
