import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1'); await t.goto('R060'); await t.press('r'); await page.waitForTimeout(150)
log('focused', await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)))
await t.promptFill('AB150-N'); await t.press('Enter'); await page.waitForTimeout(150)
log('panel', JSON.stringify(await t.panel()), 'toast', await t.toast(), 'mode', await t.mode())
const p = await t.proj(); log(JSON.stringify(p.rows.filter(r => r.replaces === 'R060' || r.id === 'R060').map(r => [r.id, r.status, r.model, r.removal, r.flags])))
await t.close()
