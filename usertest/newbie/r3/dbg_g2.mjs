import { launch, fresh, T, palette, ui } from './lib.mjs'
const { browser, page, errors } = await launch()
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
await fresh(page); await openWizard()
await page.getByTestId('wizard-id').fill('RELOAD-1'); await page.keyboard.press('Enter'); await page.keyboard.type('リロード案件'); await page.waitForTimeout(1000)
console.log('before', await page.evaluate(() => JSON.parse(sessionStorage.getItem('bom-pro.ui')).wizardDraft))
await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(500)
console.log('after reload ss', await page.evaluate(() => JSON.parse(sessionStorage.getItem('bom-pro.ui')).wizardDraft))
console.log('state', await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); return (await import(u)).useStore.getState().wizardDraft }))
await browser.close(); console.log(errors)
