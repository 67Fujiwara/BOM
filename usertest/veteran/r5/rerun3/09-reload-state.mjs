// リロードでビュー・カーソル・並び・列・最近のコマンド・Undo 履歴が戻るか（開発 5173 / ビルド 5190）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const res = {}
for (const [tag, port] of [['dev', 5173], ['build', 5195], ['r3-dev', 5197]]) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const url = `http://localhost:${port}/`
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R040'); await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('リロード前'); await page.keyboard.press('Enter')
  await page.keyboard.press('k')
  await page.keyboard.press('5'); await page.waitForTimeout(100); await page.keyboard.press('1')
  await page.keyboard.press('c'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('Escape')
  await page.keyboard.press('s')
  await page.waitForTimeout(800)
  const before = { cursor: await page.getByTestId('cursor').textContent(), ths: (await page.locator('table.grid th').count()), sorted: await page.locator('th.sorted').count() }
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.waitForTimeout(200)
  const after = { cursor: await page.getByTestId('cursor').textContent(), ths: (await page.locator('table.grid th').count()), sorted: await page.locator('th.sorted').count() }
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80)
  const undoToast = await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
  res[tag] = { before, after, undoAfterReload: undoToast.slice(0, 60), ss: await page.evaluate(() => Object.keys(sessionStorage)) }
  console.log(tag, JSON.stringify(res[tag]))
  await browser.close()
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r5/rerun3/09-reload-state.json', JSON.stringify(res, null, 2))
