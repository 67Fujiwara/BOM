import { launch, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
await t.press('1'); await t.goto('R020'); await t.cmd('先行発注を申請'); await page.waitForTimeout(80)
await t.promptFill('長納期のため'); await t.extraFill('金額', '12345'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100)
await t.role('pm'); await t.press('7'); await t.goto('R020')
const rowText = await page.locator('[data-row-id="R020"]').textContent(); log('7 row text:', rowText)
await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); log('detail has 長納期?', det.includes('長納期'), 'has 12,345?', det.includes('12,345'), '|', det.slice(det.indexOf('要決定'), det.indexOf('要決定') + 300)); await t.press(' ')
await t.cmd('履歴'); await page.waitForTimeout(100); log('history panel', JSON.stringify(await t.panel())?.slice(0, 600))
await t.close()
