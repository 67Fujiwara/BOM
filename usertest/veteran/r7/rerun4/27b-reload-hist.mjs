// ラウンド4: 操作のあと何 ms でリロードすると Undo 履歴が残るか（移動 / セル編集）
import { launch, fresh, goto, toColKey, sleep, save, toastNow, storeState } from './lib.mjs'
const { browser, page } = await launch()
const out = []
const order = () => storeState(page, (s) => s.project().rows.map((r) => r.id).join())
for (const op of ['move', 'edit']) for (const wait of [0, 100, 250, 400, 800]) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R045'); await toColKey(page, 'note')
  const o0 = await order()
  if (op === 'move') await page.keyboard.press('Alt+ArrowDown')
  else { await page.keyboard.press('Enter'); await page.keyboard.type('x'); await page.keyboard.press('Enter') }
  await sleep(wait)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(150); await page.locator('.gridwrap').focus()
  const changedKept = op === 'move' ? (await order()) !== o0 : true
  await page.keyboard.press('Control+z'); await sleep(60)
  const t = await toastNow(page)
  out.push({ op, wait, changedKept, undoToast: t.slice(0, 50), undone: op === 'move' ? (await order()) === o0 : t.startsWith('元に戻す') })
  console.log(JSON.stringify(out.at(-1)))
}
save('27b-reload-hist.json', out)
await browser.close()
