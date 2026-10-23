import { launch, fresh, T, sel, gotoCol, row, ui, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
for (const [word, id, delay] of [['heater', 'R058', 150], ['heater', 'R058', 200], ['relay', 'R056', 200], ['relay', 'R056', 300], ['fuse', 'R032', 300], ['cable', 'R035', 300]]) {
  await fresh(page); await page.keyboard.press('1'); await sel(page, id); await gotoCol(page, '部品名')
  await page.evaluate(() => { window.__kd = []; window.addEventListener('keydown', (e) => window.__kd.push(Math.round(e.timeStamp)), true) })
  for (const ch of word) { await page.keyboard.down(ch); await page.keyboard.up(ch); await page.waitForTimeout(delay) }
  const gaps = await page.evaluate(() => window.__kd.slice(1).map((t, i) => t - window.__kd[i]))
  const u = await ui(page); const p = await proj(page)
  console.log(word, delay + 'ms', 'gaps', gaps.join(','), '| mode', u.mode, JSON.stringify(u.editValue), 'cursor', u.cursorRow, '| rows', p.rows.length, 'hidden', (await row(page, id)).hidden, 'status', (await row(page, id)).status, 'sort', JSON.stringify(u.sort), 'filter', JSON.stringify(u.cellFilter), 'panel', u.panel)
  await page.keyboard.press('Escape')
}
await browser.close(); console.log(errors)
