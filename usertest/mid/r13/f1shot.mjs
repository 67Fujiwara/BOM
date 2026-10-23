// f1shot: 購買のパレットに設計の作業中の値が出る画面
import { launch, log } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
await t.setCellKey('R010', 'model', 'WIP-ZZZ-999'); await t.setCellKey('R010', 'name', 'ナイショ部品')
await t.role('purchasing'); await t.press('1'); await t.goto('R010')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('R010'); await page.waitForTimeout(200)
await t.shot('f1-palette-wip'); log('grid R010', await t.cellText('R010', 'model'), await t.cellText('R010', 'name'))
await t.close()
