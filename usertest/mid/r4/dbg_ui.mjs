import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('6'); await t.goto('R040'); await page.waitForTimeout(600)
log('before', await t.view(), await t.curRow(), await page.evaluate(() => sessionStorage.getItem('bom-pro.ui')?.slice(0, 120)))
await t.reload(); await page.waitForTimeout(500)
log('after', await t.view(), await t.curRow())
await t.close()
