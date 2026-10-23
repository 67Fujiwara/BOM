import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design')
// R047 を Shift+A 2 位で PM 承認待ちに
await t.goto('R047'); await t.press('Shift+A'); await t.press('2'); await page.waitForTimeout(50); await t.press('Enter'); await page.waitForTimeout(50)
log('toast', await t.toast())
await t.role('pm'); await t.press('7'); await t.goto('R047'); await t.press('y'); await page.waitForTimeout(80)
await page.getByTestId('extra-承認者').fill('部長 田中')
log('after fill approver value:', await page.getByTestId('extra-承認者').inputValue())
await page.getByTestId('extra-決裁書No').fill('K-1')
log('after fill ref: approver=', await page.getByTestId('extra-承認者').inputValue(), 'ref=', await page.getByTestId('extra-決裁書No').inputValue())
await page.getByTestId('prompt-text').fill('承認')
log('after text: approver=', await page.getByTestId('extra-承認者').inputValue(), 'ref=', await page.getByTestId('extra-決裁書No').inputValue(), 'date=', await page.getByTestId('extra-日付').inputValue())
log('focused:', await page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
await page.getByTestId('prompt-text').focus()
await t.press('Enter'); await page.waitForTimeout(80)
log('toast:', await t.toast(), 'status', (await t.row('R047')).status, JSON.stringify((await t.proj()).decisions.at(-1)))
// typing via keyboard into approver field
await t.close()
