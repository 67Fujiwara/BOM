import { launch, fresh, goto, toCol, sleep, panel, proj, toastNow, palette, ws } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await goto(page, 'R013'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-013'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await sleep(80)
for (let i = 0; i < 4; i++) {
  const p = await panel(page)
  console.log(i, p, (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).slice(0, 300).replace(/\n/g, ' | '))
  if (!p) break
  await page.keyboard.press('Enter'); await sleep(80)
}
console.log((await toastNow(page)).slice(0, 200), (await proj(page)).submissions.length)
// whole sheet quote import supplier choice
await page.locator('.role button', { hasText: '購買' }).click(); await sleep(50); console.log('after role click panel', await panel(page))
await page.locator('.gridwrap').focus()
await palette(page, '見積回答を取り込む'); await sleep(50)
console.log(await page.locator('[data-testid^="panel-"]').first().innerText())
await browser.close()
