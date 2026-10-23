import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5195/'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto('http://localhost:5195/')
await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.keyboard.press('Alt+1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' 必要数'); i++) await page.keyboard.press('ArrowRight')
const r = await page.evaluate(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
  const g = () => document.querySelector('.gridwrap')
  const key = (t, init) => t.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  const log = []
  for (const k of ['Enter', 'ArrowDown']) {
    key(g(), { key: '9', code: 'Digit9' }); await frame()
    const inp = document.querySelector('[data-testid="cell-editor"]')
    log.push(['before', k, document.querySelector('[data-testid="mode"]').textContent, inp?.value, document.activeElement?.className])
    key(inp ?? g(), { key: k, code: k }); await frame()
    log.push(['after', k, document.querySelector('[data-testid="mode"]').textContent, document.querySelector('[data-testid="cursor"]').textContent])
  }
  const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId)
  log.push(p.rows.slice(0, 4).map((r) => r.id + ':' + (r.working?.qtyNeeded ?? r.qtyNeeded)))
  return log
})
console.log(JSON.stringify(r)); await browser.close()
