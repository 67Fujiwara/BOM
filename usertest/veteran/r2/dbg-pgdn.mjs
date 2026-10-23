import { launch, fresh, cursor, sleep } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp')
const t = [await cursor(page)]
for (let i = 0; i < 6; i++) { await page.keyboard.press('PageDown'); t.push(await cursor(page)) }
for (let i = 0; i < 3; i++) { await page.keyboard.press('PageUp'); t.push(await cursor(page)) }
await page.keyboard.press('Control+ArrowDown'); t.push('ctrlDown:' + await cursor(page))
await page.keyboard.press('PageUp'); t.push(await cursor(page))
console.log(t.join(' | '))
const vis = await page.evaluate(() => { const c = document.querySelector('td.cursor') ?? document.querySelector('tr.group.sel'); const w = document.querySelector('.gridwrap'); const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); const th = document.querySelector('thead')?.getBoundingClientRect(); return { top: a.top, bottom: a.bottom, wrapTop: b.top, wrapBottom: b.bottom, theadBottom: th?.bottom } })
console.log(vis)
await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('Control+ArrowDown'); for (let i = 0; i < 90; i++) await page.keyboard.press('k')
console.log(await cursor(page), await page.evaluate(() => { const c = document.querySelector('td.cursor') ?? document.querySelector('tr.group.sel'); const w = document.querySelector('.gridwrap'); const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); const th = document.querySelector('thead')?.getBoundingClientRect(); return { top: a.top, wrapTop: b.top, theadBottom: th?.bottom, scrollTop: w.scrollTop } }))
await page.screenshot({ path: 'usertest/veteran/r2/shots/group-header-cursor.png' })
await browser.close()
