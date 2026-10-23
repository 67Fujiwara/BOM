// 購買: 役割を切り替えた直後に、ビューを変えるつもりで数字（4）→ ↑ / Enter
import { launch, fresh, T, makeLog, ui, sleep, shot, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('z12_purch_digit')
for (const after of ['ArrowUp', 'Enter', 'Alt+4']) {
  await fresh(page, 'purchasing'); await sleep(100)
  let p = await proj(page); const b = p.quotes.find((q) => q.rowId === 'R004' && q.supplierId === 'S1').unitPrice
  log('side', (await page.locator('.side').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120))
  await page.keyboard.press('4'); await sleep(80); await page.keyboard.press(after); await sleep(150)
  const u = await ui(page); p = await proj(page)
  log(`4 → ${after}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} | R004 S1 単価 ${b} → ${p.quotes.find((q) => q.rowId === 'R004' && q.supplierId === 'S1').unitPrice} | toast ${await T.toast(page)}`)
}
await shot(page, 'z12_after')
save(errors); await browser.close()
