import { launch, fresh, sel, gotoCol, typeReal, ui, proj } from './lib.mjs'
const { browser, page } = await launch()
for (const d of [350, 400, 450, 500]) {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, '部品名')
  await page.evaluate(() => { window.__t = []; window.addEventListener('keydown', (e) => window.__t.push([e.key, performance.now()]), true) })
  await typeReal(page, 'sensor', d)
  const t = await page.evaluate(() => window.__t.map(([k, x], i, a) => `${k}+${i ? Math.round(x - a[i - 1][1]) : 0}`).join(' '))
  const u = await ui(page)
  console.log(d, t, 'edit=', u.editValue, 'sort=', JSON.stringify(u.sort))
}
await browser.close()
