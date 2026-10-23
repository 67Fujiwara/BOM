import { launch, fresh, makeLog, sel, gotoCol, typeReal, sleep, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w02b_shot')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '代替可否'); await typeReal(page, 'fuka'); await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press('ArrowUp'); await sleep(100)
await page.keyboard.press('Enter'); await sleep(150); await shot(page, 'w02b_alt_fuka_enter')
await page.keyboard.press('ArrowDown'); await sleep(150); await shot(page, 'w02b_alt_fuka_enter_down')
log('ok'); save(errors); await browser.close()
