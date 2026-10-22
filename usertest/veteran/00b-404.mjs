import { launch, fresh } from './lib.mjs'
const { browser, page } = await launch()
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()) })
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText))
await fresh(page)
await browser.close()
