// ラウンド11: 新しい動きの反応時間（2,500 行）。F8 の見えている並び（1・4・絞り込み）、200 件の履歴のある Ctrl+Z / Ctrl+Y、F2 の切り替え
// r10 ビルド 5198 / 現行 5197 を交互に 3 巡。保存は止めない（実際の使い方と同じく localStorage・sessionStorage に書く）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib11.mjs'
const TARGETS = [['r10', 5198], ['current', 5197]]
const ROUNDS = Number(process.env.ROUNDS ?? 3), SIZE = Number(process.env.SIZE ?? 2500)
async function setup(url) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  await page.evaluate((n) => {
    const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId)
    const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0
    while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ }
    localStorage.setItem(k, JSON.stringify(w))
  }, SIZE)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  return { browser, page }
}
async function measure(url) {
  const { browser, page } = await setup(url)
  const res = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const g = () => document.querySelector('.gridwrap')
    const key = (init, t = g()) => t.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return +b[b.length >> 1].toFixed(1) }
    const timeKey = async (init, n) => { const a = []; for (let i = 0; i < n; i++) { const t = performance.now(); key(init); await frame(); a.push(performance.now() - t) } return med(a) }
    const m = {}
    key({ key: '1', code: 'Digit1', altKey: true }); await frame(); key({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true }); await frame()
    m.f8_view1 = await timeKey({ key: 'F8', code: 'F8' }, 12)
    m.shiftF8_view1 = await timeKey({ key: 'F8', code: 'F8', shiftKey: true }, 12)
    key({ key: '4', code: 'Digit4', altKey: true }); await frame()
    m.f8_view4 = await timeKey({ key: 'F8', code: 'F8' }, 12)
    key({ key: '1', code: 'Digit1', altKey: true }); await frame()
    // 絞り込み「リレー」
    key({ key: 'f', code: 'KeyF', ctrlKey: true }); await frame()
    const fi = document.querySelector('input.filter'); if (fi) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(fi, 'リレー'); fi.dispatchEvent(new Event('input', { bubbles: true })); await frame(); key({ key: 'Enter', code: 'Enter' }, fi); await frame() }
    m.f8_filter = await timeKey({ key: 'F8', code: 'F8' }, 12)
    key({ key: 'Escape', code: 'Escape' }, document.activeElement); await frame(); key({ key: 'Escape', code: 'Escape' }); await frame()
    // 200 件の履歴を作る（部品名の確定 × 200）
    key({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true }); await frame(); key({ key: 'ArrowDown', code: 'ArrowDown' }); await frame()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const commitT = []
    for (let i = 0; i < 205; i++) {
      key({ key: 'Enter', code: 'Enter' }); await frame()
      const inp = document.querySelector('[data-testid="cell-editor"]'); if (!inp) return { err: 'no editor at ' + i, ...m }
      setter.call(inp, 'H' + i); inp.dispatchEvent(new Event('input', { bubbles: true })); await frame()
      const t = performance.now(); key({ key: 'Enter', code: 'Enter' }, inp); await frame(); commitT.push(performance.now() - t)
      key({ key: 'ArrowUp', code: 'ArrowUp' }); await frame()
    }
    m.commit_first10 = med(commitT.slice(0, 10)); m.commit_last10 = med(commitT.slice(-10))
    await new Promise((r) => setTimeout(r, 600))
    m.histChars = (sessionStorage.getItem('bom-pro.history') ?? '').length
    m.undo_200hist = await timeKey({ key: 'z', code: 'KeyZ', ctrlKey: true }, 12)
    m.redo_200hist = await timeKey({ key: 'y', code: 'KeyY', ctrlKey: true }, 12)
    // F2 の切り替え（打って始めた入力）
    key({ key: 'a', code: 'KeyA' }); await frame()
    const inp = document.querySelector('[data-testid="cell-editor"]')
    m.f2_toggle = await timeKey({ key: 'F2', code: 'F2' }, 10)
    key({ key: 'Escape', code: 'Escape' }, inp ?? g()); await frame()
    return m
  })
  await browser.close()
  return res
}
const all = {}
for (let r = 0; r < ROUNDS; r++) for (const [tag, port] of TARGETS) {
  let v; try { v = await measure(`http://localhost:${port}/`) } catch (e) { v = { err: String(e).slice(0, 200) } }
  ;(all[tag] ??= []).push(v); console.log(r, tag, JSON.stringify(v))
}
const med = (a) => { const b = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null }
const summary = {}
for (const [k, vs] of Object.entries(all)) { summary[k] = {}; for (const f of Object.keys(vs.find((v) => !v.err) ?? {})) summary[k][f] = med(vs.map((v) => v[f])) }
console.log(JSON.stringify(summary, null, 1))
saveJson(`28-latency-new${process.env.TAG ?? ''}.json`, { SIZE, all, summary })
