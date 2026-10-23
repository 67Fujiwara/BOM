import { launch, fresh, T, sel, gotoCol, row, ui, proj, setRole, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page, 'pm'); await page.waitForTimeout(100)
console.log('pm start', JSON.stringify(await ui(page)).slice(0, 120), 'decisions', (await proj(page)).decisions.length, 'pmConfirmed', (await proj(page)).settings.pmConfirmed)
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(80); const u = await ui(page); console.log('Enter', i + 1, u.mode, u.cursorRow, u.panel, '|', (await T.panelText(page))?.slice(0, 100), '|', await T.toast(page), '| dec', JSON.stringify((await proj(page)).decisions.map((d) => [d.rowId, d.kind, d.reason]))) }
await page.keyboard.press('Escape')
// 順番に直すモード: 1 編集する
await fresh(page); await page.keyboard.press('Control+Shift+F'); await page.waitForTimeout(100)
console.log('seq', (await T.panelText(page)).slice(0, 80))
await page.keyboard.press('1'); await page.waitForTimeout(150)
let u = await ui(page); console.log('after 1 編集する: mode', u.mode, u.cursorRow, u.cursorCol, 'panel', u.panel, (await T.panelText(page))?.slice(0, 80))
await page.keyboard.type('10A'); await page.waitForTimeout(100)
u = await ui(page); console.log('typed 10A: mode', u.mode, u.cursorRow, u.cursorCol, JSON.stringify(u.editValue), 'panel', u.panel, '| R016', JSON.stringify((await row(page, 'R016')).working), (await row(page, 'R016')).model, '| R009', JSON.stringify((await row(page, 'R009')).working))
await shot(page, 'dbg_i_sequence')
await browser.close(); console.log(errors)
