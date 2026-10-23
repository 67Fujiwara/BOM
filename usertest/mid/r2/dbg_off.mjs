import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design'); await t.press('1')
await t.showCol('needOffset'); await t.press('1')
log('headers:', (await page.locator('thead th').allTextContents()).join('|'))
await t.goto('R010'); await t.colKey('needOffset'); log('cursor:', await t.cursor(), await t.curCol())
await t.press('Enter'); log('mode:', await page.getByTestId('mode').textContent())
await page.keyboard.type('-5'); log('editor:', await page.getByTestId('cell-editor').inputValue().catch(() => 'none'))
await t.press('Enter'); log('toast:', await t.toast(), 'working:', JSON.stringify((await t.row('R010')).working), 'needDate cell:', await t.cell('R010', 'needDate'))
await t.close()
