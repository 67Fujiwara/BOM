// ラウンド8: 割り当ての無い Alt+英字の案内（打てるセル）
import { launch, fresh, T, makeLog, ui, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t71_alt_unassigned')
await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(60)
await page.keyboard.press('Alt+KeyE'); await sleep(80); log('  Alt+e toast:', await T.toast(page))
await page.keyboard.press('?'); await sleep(60); const u = await ui(page); log('  then ? ->', u.mode, JSON.stringify(u.editValue), 'panel', u.panel)
await page.keyboard.press('Escape')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ほげほげ'); await sleep(80); log('  palette empty:', (await page.getByTestId('palette-list').innerText()).replace(/\s+/g, ' '))
save(errors); await browser.close()
