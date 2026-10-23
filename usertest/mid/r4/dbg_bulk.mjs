import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(200)
log('panel', JSON.stringify(await t.panel()), 'toast', await t.toast())
await t.press('Escape')
await t.press('1'); await t.goto('R060'); await t.press('r'); await page.waitForTimeout(150)
log('r panel', JSON.stringify(await t.panel()))
await t.press('Escape')
await t.press('Control+Enter'); await page.waitForTimeout(150)
log('publish panel', JSON.stringify(await t.panel()), await t.toast())
await t.close()
