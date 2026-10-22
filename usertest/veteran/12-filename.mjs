import { launch } from './lib.mjs'
const { browser, page } = await launch()
await page.setContent('<a id=a download="案件_第3ライン.xlsx">x</a>')
const dlp = page.waitForEvent('download')
await page.evaluate(() => { const a = document.getElementById('a'); a.href = URL.createObjectURL(new Blob(['x'])); a.click() })
const dl = await dlp
console.log('suggested filename for 案件_第3ライン.xlsx →', dl.suggestedFilename())
await browser.close()
