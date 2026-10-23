import { launch, fresh, T, store, sel, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page); await page.keyboard.press('1')
const id = 'R030'
await sel(page, id); await page.keyboard.press(' ')
for (let i = 1; i <= 4; i++) {
  await page.keyboard.press('ArrowDown')
  const selq = await page.locator(`[data-testid=detail] tr.focus`).first().innerText().catch(() => '-')
  console.log(`↓${i} focus:`, selq.replace(/\s+/g, ' ').slice(0, 80), 'cursor', await T.cursor(page))
  if (/未回答/.test(selq)) {
    await page.keyboard.press('Enter'); console.log('Enter panel', await T.panelText(page))
    await page.keyboard.press('Enter'); await page.waitForTimeout(100)
    console.log('Enter again: toast', await T.toast(page), 'panel', await T.panelText(page))
    if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); console.log('Enter3 toast', await T.toast(page)) }
    const r = (await store(page)).projects[0].rows.find((r) => r.id === id)
    console.log('row after', r.status, r.adoptedSupplierId, JSON.stringify(r.flags), 'rowtext', await T.rowText(page, id))
    await shot(page, 'r2_adopt_unanswered')
    break
  }
}
await browser.close(); console.log(errors)
