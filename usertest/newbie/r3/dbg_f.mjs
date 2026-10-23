import { launch, fresh, T, sel, gotoCol, row, ui, proj, runPalette, setRole, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.waitForTimeout(100)
await setRole(page, 'purchasing')
for (const v of ['来週', '2026-10-01', 'あした', '10/30']) {
  await runPalette(page, '概算見積を依頼')
  await page.getByTestId('prompt-text').fill(v)
  await page.keyboard.press('Enter'); await page.waitForTimeout(50)
  const t1 = await T.toast(page); const pn = await T.panelText(page)
  console.log(JSON.stringify(v), '-> panel', pn?.slice(0, 80), '| toast', t1, '| R076', (await row(page, 'R076')).status)
  if (pn) await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
}
await shot(page, 'dbg_f_deadline')
// view 8 typing
await browser.close(); console.log(errors)
