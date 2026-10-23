import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); await t.goto('R045'); await t.press('Shift+A'); await page.waitForTimeout(120)
log('panel text:', (await page.locator('[data-testid^=panel]').first().textContent()).slice(0, 300), '| toast', await t.toast())
await t.shot('r045-shiftA')
await t.close()
