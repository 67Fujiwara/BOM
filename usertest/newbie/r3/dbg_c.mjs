import { launch, fresh, T, sel, row, ui, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
for (const delay of [0, 120]) {
  await fresh(page); await page.keyboard.press('1')
  await sel(page, 'R032'); await page.locator('[data-row-id="R032"] td.name').dblclick()
  await page.keyboard.press('Control+a'); await page.keyboard.type('GROUPCLICK')
  const g = page.getByTestId('group-row').first()
  console.log('groups visible', await page.getByTestId('group-row').allTextContents())
  await g.click({ delay })
  await page.waitForTimeout(200)
  const r = await row(page, 'R032')
  const u = await ui(page)
  console.log('delay', delay, 'groupText', await g.textContent(), 'mode', u.mode, 'cursor', u.cursorRow, 'R032', r.name, JSON.stringify(r.working), 'toast', await T.toast(page))
  await shot(page, `dbg_c_group_${delay}`)
}
await browser.close(); console.log(errors)
