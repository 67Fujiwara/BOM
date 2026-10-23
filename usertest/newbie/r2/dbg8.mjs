import { launch, fresh, T, store, runPalette } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page, 'pm')
const row = async () => (await page.getByTestId('settings').innerText()).replace(/\s+/g, ' ').match(/選定者[^P]*PM/)?.[0]
await runPalette(page, '案件設定'); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown')
await page.keyboard.press('Enter'); console.log('editing value', await page.getByTestId('settings-input').inputValue())
await page.getByTestId('settings-input').fill('purchasing'); await page.keyboard.press('Enter')
console.log('after purchasing Enter: toast', await T.toast(page), 'row', await row(), 'editing', await page.getByTestId('settings-input').count())
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
console.log('Ctrl+Enter:', await T.panel(page), (await T.panelText(page)).slice(0, 120))
for (let i = 0; i < 4 && (await T.panel(page)) && (await T.panel(page)) !== 'panel-settings'; i++) { if (await page.getByTestId('prompt-text').count()) await page.getByTestId('prompt-text').fill('購買に任せる'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); console.log(' ->', await T.panel(page), await T.toast(page)) }
console.log('selector stored', (await store(page))?.projects[0].settings.selector, 'toast', await T.toast(page))
await browser.close(); console.log(errors)
