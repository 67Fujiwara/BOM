import { launch, fresh, T, store, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const row = async (id) => { const r = (await store(page))?.projects[0].rows.find((r) => r.id === id); return r ? { name: r.name, working: r.working } : null }
await fresh(page)
console.log('R016 before', await T.cell(page, 'R016', 'name'))
await page.locator('[data-row-id="R032"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('VIEWCLICK')
await page.getByTestId('view-4').click()
await page.keyboard.press('Enter')
console.log('R016 after', await T.cell(page, 'R016', 'name'), JSON.stringify(await row('R016')), 'R032', JSON.stringify(await row('R032')), 'toast', await T.toast(page))
await shot(page, 'r2_viewclick_corrupt')
await page.keyboard.press('Control+z')
console.log('undo:', await T.toast(page), await T.cell(page, 'R016', 'name'))
// 別パターン: 数値セル編集中に view click
await fresh(page)
await page.locator('[data-row-id="R040"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('X')
await page.getByTestId('view-7').click()
console.log('view7 during edit: mode', await T.mode(page), 'cursor', await T.cursor(page))
await page.keyboard.press('Enter')
console.log('  Enter toast', await T.toast(page), 'cursor', await T.cursor(page))
// 購買で編集中に 9 → 他
await browser.close(); console.log(errors)
