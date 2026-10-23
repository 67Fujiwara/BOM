import { launch, fresh, T, palette, paletteTop } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await palette(page, 'JSON を書き出す')
console.log(await paletteTop(page, 5))
const dl = page.waitForEvent('download', { timeout: 5000 }).catch((e) => 'ERR ' + e)
await page.keyboard.press('Enter')
const d = await dl
console.log('dl', typeof d === 'string' ? d : d.suggestedFilename(), await T.toast(page), await T.panel(page), await T.panelText(page))
await palette(page, '三百万'); console.log(await paletteTop(page, 3))
await browser.close()
