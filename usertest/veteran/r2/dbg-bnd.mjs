import { launch, fresh, goto, toCol, cursor, mode, sleep, row } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
console.log('a'); await goto(page, 'R030'); console.log('b', await cursor(page)); await toCol(page, '必要数'); console.log('c', await cursor(page)); await page.keyboard.press('Enter'); console.log('d', await mode(page)); await page.keyboard.press('Control+a'); await page.keyboard.insertText('0'); console.log('e'); await page.keyboard.press('Enter'); console.log('f', await mode(page))
const r = await row(page, 'R030'); console.log('g', r.qtyNeeded)
await browser.close()
