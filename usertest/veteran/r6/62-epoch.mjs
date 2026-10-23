// ラウンド6: 行の statusChangedAt が古い日付（1970-01-01・2000-01-01）の保存データで、キー 1 打の時間（ビルド 5195 現行 / 5196 r5）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib6.mjs'
const out = {}
for (const [tag, port] of [['build-current', 5195], ['build-r5', 5196]]) {
  for (const when of [null, '2025-10-23T00:00:00.000Z', '2000-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z']) {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const url = `http://localhost:${port}/`
    await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(url)
    await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
    if (when) {
      await page.evaluate((when) => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); for (const p of w.projects) for (const r of p.rows) r.statusChangedAt = when; localStorage.setItem(k, JSON.stringify(w)) }, when)
      await page.evaluate(() => { Storage.prototype.setItem = function () {} })
      const t0 = Date.now(); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); var load = Date.now() - t0
      await page.locator('.gridwrap').focus()
    }
    const m = await page.evaluate(async () => {
      const one = async (keys, n) => { const o = []; for (let i = 0; i < n; i++) { const k = keys[i % keys.length]; const t = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: k[0], code: k[1], bubbles: true, cancelable: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); o.push(performance.now() - t) } o.sort((a, b) => a - b); return +o[n >> 1].toFixed(0) }
      return { down: await one([['ArrowDown', 'ArrowDown'], ['ArrowUp', 'ArrowUp']], 6), view: await one([['1', 'Digit1'], ['4', 'Digit4'], ['9', 'Digit9']], 6), space: await one([[' ', 'Space']], 4) }
    })
    const t1 = Date.now(); await page.keyboard.press('1'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.keyboard.type('E' + i); await page.keyboard.press('Enter') } const enter = Math.round((Date.now() - t1) / 3)
    const k = `${tag} ${when ?? 'sample'}`
    out[k] = { ...m, enter, load: when ? load : null }
    console.log(k, JSON.stringify(out[k]))
    await browser.close()
  }
}
saveJson('62-epoch.json', out)
