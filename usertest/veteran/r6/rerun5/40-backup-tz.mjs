// ラウンド5: 退避の一覧（V4-05 の直し）を日本時間のブラウザで見る。一覧の時刻と確認文の時刻、画面のほかの時刻表示と比べる
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = {}
for (const tz of ['Asia/Tokyo', 'UTC']) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: tz, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto('http://localhost:5173/')
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
  for (const id of ['P-A', 'P-B']) {
    const x = structuredClone(w); x.projects[0].id = id; x.currentProjectId = id
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await page.keyboard.press('Enter'); await sleep(50)
    await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(x))
    await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(80); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(150)
  }
  const nowLocal = await page.evaluate(() => new Date().toString().slice(0, 24))
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('読み込み前に戻す'); await page.keyboard.press('Enter'); await sleep(100)
  const list = (await page.locator('[data-testid^="panel-"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 300)
  await page.keyboard.press('1'); await sleep(100)
  const confirm = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
  await page.keyboard.press('Escape')
  // 履歴（Rev・指摘の時刻）の表示形式の参考
  const header = await page.evaluate(() => document.querySelector('[data-testid="rev-info"]')?.textContent ?? '')
  out[tz] = { nowLocal, list, confirm, header }
  console.log(tz, JSON.stringify(out[tz]))
  await browser.close()
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r6/rerun5/40-backup-tz.json', JSON.stringify(out, null, 2))
