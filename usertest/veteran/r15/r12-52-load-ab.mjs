// ラウンド12: 2,500 行の読み込み（reload → 表の描画）を r11 / 現行で交互に 7 回（同じブラウザ・同じデータ）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib15.mjs'
const out = { r13: [], current: [] }
const pages = {}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, port] of [['r13', 5198], ['current', 5197]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const url = `http://localhost:${port}/`
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  await page.evaluate((n) => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) }, 2500)
  pages[name] = page
}
for (let i = 0; i < 7; i++) for (const name of (i % 2 ? ['current', 'r13'] : ['r13', 'current'])) {
  const page = pages[name]; await page.bringToFront()
  const t0 = Date.now(); await page.reload(); await page.waitForSelector('[data-testid="grid"] [data-row-id]'); out[name].push(Date.now() - t0)
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
console.log(JSON.stringify({ ...out, median: { r13: med(out.r13), current: med(out.current) } }))
saveJson('52-load-ab.json', { ...out, median: { r13: med(out.r13), current: med(out.current) } })
await browser.close()
