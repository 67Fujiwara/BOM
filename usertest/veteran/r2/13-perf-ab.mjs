// 反応時間の比較: 現行(5173) と ラウンド1 修正前(ceefc66, 5174)。同じ手順・同じ計測
import { chromium } from '@playwright/test'
const res = {}
for (const [tag, url] of [['current', 'http://localhost:5173/'], ['before-fix', 'http://localhost:5174/'], ['current#2', 'http://localhost:5173/']]) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('ArrowDown')
  const m = await page.evaluate(async () => {
    const one = async (keys, n) => { const out = []; for (let i = 0; i < n; i++) { const k = keys[i % keys.length]; const t = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: k[0], code: k[1], bubbles: true, cancelable: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); out.push(performance.now() - t) } out.sort((a, b) => a - b); return { median: +out[n >> 1].toFixed(1), p90: +out[Math.floor(n * 0.9)].toFixed(1) } }
    return { j: await one([['j', 'KeyJ'], ['k', 'KeyK']], 40), right: await one([['ArrowRight', 'ArrowRight'], ['ArrowLeft', 'ArrowLeft']], 40), view: await one([['1', 'Digit1'], ['4', 'Digit4'], ['2', 'Digit2'], ['9', 'Digit9'], ['5', 'Digit5']], 40), space: await one([[' ', 'Space']], 20) }
  })
  await page.keyboard.press('1')
  const t0 = Date.now(); for (let i = 0; i < 20; i++) for (const k of '123456789') await page.keyboard.press(k); const v180 = Date.now() - t0
  res[tag] = { ...m, views180ms: v180, perPress: +(v180 / 180).toFixed(1) }
  console.log(tag, JSON.stringify(res[tag]))
  await browser.close()
}
import fs from 'node:fs'
fs.writeFileSync('usertest/veteran/r2/13-perf-ab.json', JSON.stringify(res, null, 2))
