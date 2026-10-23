import { launch, fresh } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
console.log(await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /store|main|App/.test(n))))
await browser.close()
