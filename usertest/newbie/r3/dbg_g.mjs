import { launch, fresh, T, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
for (const wait of [100, 1500]) {
  await fresh(page); await openWizard()
  await page.getByTestId('wizard-id').fill('RELOAD-1'); await page.keyboard.press('Enter'); await page.keyboard.type('リロード案件'); await page.waitForTimeout(wait)
  console.log('ss', await page.evaluate(() => sessionStorage.getItem('bom-pro.ui')?.slice(0, 300)))
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(300)
  await openWizard()
  console.log('wait', wait, 'step', await page.getByTestId('wizard').locator('h3').textContent(), 'name', await page.getByTestId('wizard-name').inputValue().catch(() => '-'), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
}
await browser.close(); console.log(errors)
