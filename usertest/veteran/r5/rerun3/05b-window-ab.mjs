// 05 の A/B: 並び替え・絞り込み解除・スクロール後の Enter で、カーソル/編集欄が見えるか（現行 5173 と ラウンド2 時点 5194）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const res = {}
for (const [tag, port] of [['current', 5173]]) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const url = `http://localhost:${port}/`
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  const vis = () => page.evaluate(() => { const w = document.querySelector('.gridwrap'); const wr = w.getBoundingClientRect(); const th = w.querySelector('thead').getBoundingClientRect().height; const c = w.querySelector('td.cursor'); if (!c) return 'not rendered'; const r = c.getBoundingClientRect(); return r.top >= wr.top + th - 1 && r.bottom <= wr.bottom + 1 ? 'visible' : 'offscreen' })
  const goto = async (id) => { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(id); await page.keyboard.press('Enter') }
  const r = {}
  await page.keyboard.press('1')
  await goto('R060'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  r.cursor = await page.getByTestId('cursor').textContent()
  await page.keyboard.press('Shift+S'); await page.waitForTimeout(100); r.sortDesc = await vis()
  await page.keyboard.press('s'); await page.waitForTimeout(100); r.sortAsc = await vis()
  await page.keyboard.press('s'); await page.waitForTimeout(100)
  await goto('R070'); await page.keyboard.press('/'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter'); await page.waitForTimeout(100); r.filtered = await vis()
  await goto('R070').catch(() => {}); await page.waitForTimeout(50)
  await page.keyboard.press('/'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(100); r.filterCleared = await vis()
  await goto('R005'); await page.evaluate(() => { document.querySelector('.gridwrap').scrollTop = 2000 }); await page.waitForTimeout(100)
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  r.enterAfterScroll = { editor: await page.getByTestId('cell-editor').count(), vis: await vis(), active: await page.evaluate(() => document.activeElement?.className) }
  res[tag] = r
  console.log(tag, JSON.stringify(r))
  await browser.close()
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r5/rerun3/05b-window-ab.json', JSON.stringify(res, null, 2))
