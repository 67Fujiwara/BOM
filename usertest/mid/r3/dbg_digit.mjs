import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.goto('R011'); await t.press('Shift+A'); await page.waitForTimeout(60); await t.press('3'); await page.waitForTimeout(60); await t.press('3'); await page.waitForTimeout(80)
await t.role('pm'); await t.press('7'); await t.goto('R011'); await t.press('Enter'); await page.waitForTimeout(60); log('panel', JSON.stringify(await t.panel()))
await t.press('3'); await page.waitForTimeout(80); log('after pressing 3 in decision panel:', JSON.stringify(await t.panel())?.slice(0, 150), 'view', await t.view())
await t.close()
