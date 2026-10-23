// ラウンド8: 値の確定（Enter）と Ctrl+Z の反応時間をページの中で測る（キーを発生させてから次の描画まで）。
// 現行ビルド 5197 / r7 ビルド（8a7cb84）5198 を交互に。80 / 300 / 2,500 行。部品名（文字）と必要数（数値）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib9.mjs'
const TARGETS = [['r8', 5196], ['current', 5195]]
const ROUNDS = Number(process.env.ROUNDS ?? 3)
const SIZES = (process.env.SIZES ?? '80,300,2500').split(',').map(Number)
const N = Number(process.env.N ?? 25)
async function setup(url, n, epoch) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  await page.evaluate(([n, epoch]) => {
    const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId)
    const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0
    while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ }
    if (epoch) for (const r of p.rows) { r.statusChangedAt = epoch; if (r.dueAt) r.dueAt = epoch.slice(0, 10) }
    localStorage.setItem(k, JSON.stringify(w))
  }, [n, epoch])
  await page.evaluate(() => { Storage.prototype.setItem = function () {} }); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  return { browser, page }
}
async function goCol(page, col) {
  await page.keyboard.press('Alt+1'); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' ' + col); i++) await page.keyboard.press('ArrowRight')
}
async function measure(url, n, epoch) {
  const { browser, page } = await setup(url, n, epoch)
  const res = {}
  for (const [col, val] of [['部品名', 'abc'], ['必要数', '7']]) {
    await goCol(page, col)
    res[col] = await page.evaluate(async ([N, val]) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
      const key = (t, init) => t.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
      const commit = [], undo = []
      for (let i = 0; i < N; i++) {
        key(document.querySelector('.gridwrap'), { key: 'Enter', code: 'Enter' }); await frame()
        const inp = document.querySelector('[data-testid="cell-editor"]')
        if (!inp) return { err: 'no editor' }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(inp, val + (i % 7)); inp.dispatchEvent(new Event('input', { bubbles: true })); await frame()
        let t = performance.now(); key(inp, { key: 'Enter', code: 'Enter' }); await frame(); commit.push(performance.now() - t)
        key(document.querySelector('.gridwrap'), { key: 'ArrowUp', code: 'ArrowUp' }); await frame()
      }
      for (let i = 0; i < Math.min(N, 10); i++) { const t = performance.now(); key(document.querySelector('.gridwrap'), { key: 'z', code: 'KeyZ', ctrlKey: true }); await frame(); undo.push(performance.now() - t) }
      const med = (a) => { const b = [...a].sort((x, y) => x - y); return +b[b.length >> 1].toFixed(1) }
      return { commit: med(commit), undo: med(undo) }
    }, [N, val])
  }
  await browser.close()
  return res
}
const all = {}
const EPOCH = process.env.EPOCH || ''
for (let r = 0; r < ROUNDS; r++) for (const n of SIZES) for (const [tag, port] of TARGETS) {
  const v = await measure(`http://localhost:${port}/`, n, EPOCH)
  ;(all[`${tag}@${n}`] ??= []).push(v)
  console.log(r, tag, n, JSON.stringify(v))
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] }
const summary = {}
for (const [k, vs] of Object.entries(all)) summary[k] = Object.fromEntries(['部品名', '必要数'].map((c) => [c, { commit: med(vs.map((v) => v[c].commit)), undo: med(vs.map((v) => v[c].undo)) }]))
console.log(JSON.stringify(summary, null, 1))
saveJson(`r8-13-commit-ab${EPOCH ? '-epoch' : ''}.json`, { all, summary })
