import { launch, fresh, T, ui } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page); await page.keyboard.press('1')
for (const q of ['電16', '電１６', 'r16', '表76', 'センサ', 'S8VK']) { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter'); await page.waitForTimeout(60); console.log(q, '->', (await ui(page)).cursorRow, await T.toast(page)) }
await browser.close()
