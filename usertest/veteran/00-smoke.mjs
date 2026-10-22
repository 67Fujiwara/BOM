import { launch, fresh, cursor, dumpErrors, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await page.keyboard.press('ArrowDown')
console.log('cursor:', await cursor(page))
console.log('rows:', await page.getByTestId('row').count())
await shot(page, '00-smoke')
dumpErrors(errors, 'smoke')
await browser.close()
