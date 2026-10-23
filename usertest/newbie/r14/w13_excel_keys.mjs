// Excel のキー: Ctrl+End / Ctrl+Home / Ctrl+↓ / 必要日に日付を打つ
import { launch, fresh, T, makeLog, sel, gotoCol, ui, typeReal, sleep, row } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w13_excel_keys')
await fresh(page); await sel(page, 'R030'); await gotoCol(page, '型式')
for (const k of ['Control+End', 'Control+Home', 'Control+ArrowDown', 'Control+ArrowUp']) { await page.keyboard.press(k); await sleep(120); log(`${k}: cursor=${await T.cursor(page)} toast=${await T.toast(page)}`) }
await sel(page, 'R030'); await gotoCol(page, '必要日'); log('cursor', await T.cursor(page))
await typeReal(page, '11/5'); await sleep(100); log(`必要日 11/5: mode=${(await ui(page)).mode} toast=${await T.toast(page)} view=${(await ui(page)).view} cursor=${await T.cursor(page)}`)
await page.keyboard.press('Enter'); await sleep(100); log(`Enter: mode=${(await ui(page)).mode} toast=${await T.toast(page)} R030=${JSON.stringify((await row(page, 'R030')).working ?? null)}`)
save(errors); await browser.close()
