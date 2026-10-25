// ラウンド9: 反応時間の A/B（ページ内で「キーを発生させてから次の描画まで」）。r8 ビルド（484f359）5198 / 現行（HEAD）5197 を交互に。
// MODE: plain（2,500 行）/ epoch（全行 1970-01-01）/ regex（重い正規表現のルール＋型式 26 文字＋!）/ holidays（休日 10 年毎日）
// 確定（部品名・必要数）・Ctrl+Z・↓・ビュー切替（Alt+4 / Alt+1）・Space を測る。読み込み（reload→grid）時間も
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib17.mjs'
const TARGETS = [['r13', 5198], ['current', 5197]]
const ROUNDS = Number(process.env.ROUNDS ?? 3)
const MODES = (process.env.MODES ?? 'plain,epoch,regex,holidays').split(',')
const SIZE = Number(process.env.SIZE ?? 2500)
const N = Number(process.env.N ?? 15)
const allDays = (from, years) => { const a = []; const d = new Date(from); for (let i = 0; i < years * 366; i++) { a.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) } return a }
async function setup(url, n, mode) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  await page.evaluate(([n, mode, hol]) => {
    const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId)
    const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0
    while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ }
    if (mode === 'epoch') for (const r of p.rows) { r.statusChangedAt = '1970-01-01T00:00:00.000Z'; if (r.dueAt) r.dueAt = '1970-01-01' }
    if (mode === 'regex') { w.rules = [...(w.rules ?? []), { id: 'rx', name: '型式の形', field: 'model', type: 'regex', pattern: '^([A-Z0-9]+-?)+$', severity: 'warn', message: '型式の形', owner: 'x', scope: 'all', enabled: true }]; p.rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!' }
    if (mode === 'holidays') p.settings.holidays = hol
    localStorage.setItem(k, JSON.stringify(w))
  }, [n, mode, mode === 'holidays' ? allDays('2026-10-01', 10) : null])
  await page.evaluate(() => { Storage.prototype.setItem = function () {} })
  const t0 = Date.now(); await page.reload({ timeout: 300000 }); await page.waitForSelector('[data-testid="grid"]', { timeout: 300000 }); const loadMs = Date.now() - t0
  await page.locator('.gridwrap').focus()
  return { browser, page, loadMs }
}
async function goCol(page, col) {
  await page.keyboard.press('Alt+1'); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' ' + col); i++) await page.keyboard.press('ArrowRight')
}
async function measure(url, n, mode) {
  const { browser, page, loadMs } = await setup(url, n, mode)
  const res = { loadMs }
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
  res.nav = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const g = () => document.querySelector('.gridwrap')
    const key = (init) => g().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return +b[b.length >> 1].toFixed(1) }
    const m = {}
    for (const [name, inits] of [['down', [{ key: 'ArrowDown', code: 'ArrowDown' }]], ['view', [{ key: '4', code: 'Digit4', altKey: true }, { key: '1', code: 'Digit1', altKey: true }]], ['space', [{ key: ' ', code: 'Space' }]]]) {
      const a = []
      for (let i = 0; i < 8; i++) for (const init of inits) { const t = performance.now(); key(init); await frame(); a.push(performance.now() - t) }
      m[name] = med(a)
    }
    return m
  })
  await browser.close()
  return res
}
const all = {}
for (let r = 0; r < ROUNDS; r++) for (const mode of MODES) for (const [tag, port] of TARGETS) {
  let v
  try { v = await measure(`http://localhost:${port}/`, SIZE, mode) } catch (e) { v = { err: String(e).slice(0, 200) } }
  ;(all[`${tag}@${mode}`] ??= []).push(v)
  console.log(r, tag, mode, JSON.stringify(v))
}
const med = (a) => { const b = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null }
const summary = {}
for (const [k, vs] of Object.entries(all)) summary[k] = { loadMs: med(vs.map((v) => v.loadMs)), name: { commit: med(vs.map((v) => v['部品名']?.commit)), undo: med(vs.map((v) => v['部品名']?.undo)) }, qty: { commit: med(vs.map((v) => v['必要数']?.commit)), undo: med(vs.map((v) => v['必要数']?.undo)) }, down: med(vs.map((v) => v.nav?.down)), view: med(vs.map((v) => v.nav?.view)), space: med(vs.map((v) => v.nav?.space)) }
console.log(JSON.stringify(summary, null, 1))
saveJson(`13-latency-ab${process.env.TAG ?? ''}.json`, { SIZE, N, all, summary })
