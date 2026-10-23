// ラウンド10: 打って始めた入力を矢印（↓ →）で確定する時間と Enter の確定の時間（2,500 行・現行ビルド 5197、ページ内）。3 巡の中央値
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib16.mjs'
const URL = `http://localhost:${process.env.PORT ?? 5197}/`
const out = []
for (let round = 0; round < 3; round++) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(URL)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  await page.evaluate(() => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < 2500) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) })
  await page.evaluate(() => { Storage.prototype.setItem = function () {} })
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Alt+1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' 必要数'); i++) await page.keyboard.press('ArrowRight')
  const r = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const g = () => document.querySelector('.gridwrap')
    const key = (t, init) => t.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return +b[b.length >> 1].toFixed(1) }
    const m = { enter: [], down: [], right: [] }
    for (let i = 0; i < 12; i++) for (const [j, [name, k]] of [['enter', 'Enter'], ['down', 'ArrowDown'], ['right', 'ArrowRight']].entries()) {
      const d = ((i * 3 + j) % 9) + 1
      key(g(), { key: String(d), code: 'Digit' + d }); await frame()
      const inp = document.querySelector('[data-testid="cell-editor"]') ?? g()
      const t = performance.now(); key(inp, { key: k, code: k }); await frame(); m[name].push(performance.now() - t)
      if (name === 'right') { key(g(), { key: 'ArrowLeft', code: 'ArrowLeft' }); await frame() }
      if (name !== 'right') { key(g(), { key: 'ArrowUp', code: 'ArrowUp' }); await frame() }
    }
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, med(v)]))
  })
  out.push(r); console.log(round, JSON.stringify(r))
  await browser.close()
}
saveJson(`14-typed-arrow-latency-${process.env.PORT ?? 5197}.json`, out)
