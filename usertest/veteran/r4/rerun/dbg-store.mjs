import { launch, fresh, appStore, storeState, goto, toColKey, cursor } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
console.log(await appStore(page))
await goto(page, 'R040'); console.log(await toColKey(page, 'model'), await cursor(page), await storeState(page, (s) => s.cursorRow + ' ' + s.cursorCol))
await browser.close()
