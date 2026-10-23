// ラウンド8: 絞り込み欄の「/ でここへ」を見て / を押す新人（打てるセル）
import { launch, fresh, T, makeLog, shot, ui, proj, sleep, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t69_slash')
await fresh(page); await page.keyboard.press('ArrowDown'); await sleep(80)
log('  placeholder:', await page.getByTestId('filter').getAttribute('placeholder'))
await page.keyboard.press('/'); await sleep(60); log('  after / mode', (await ui(page)).mode, JSON.stringify((await ui(page)).editValue), '| focused filter?', await page.evaluate(() => document.activeElement?.className))
await typeReal(page, 'relay', 40); await page.keyboard.press('Enter'); await sleep(100)
const u = await ui(page); log('  after Enter', u.mode, u.cursorRow, u.cursorCol, 'filter=', JSON.stringify(u.filter))
const p = await proj(page); log('  R001 working', JSON.stringify(p.rows.find((r) => r.id === 'R001').working))
await shot(page, 't69_slash_relay')
save(errors); await browser.close()
