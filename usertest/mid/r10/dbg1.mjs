import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('purchasing'); await t.press('6')
await t.goto('R005'); await t.colKey('q.unitPrice@S1'); log('pos', await t.curRow(), await t.curCol(), await t.mode())
await page.keyboard.press('Enter'); log('after Enter', await t.mode())
await page.keyboard.press('Control+a'); await page.keyboard.type('777'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
log('after commit', await t.curRow(), await t.curCol(), await t.mode(), await t.toast(), await t.status())
await t.shot('dbg1')
await t.close()
