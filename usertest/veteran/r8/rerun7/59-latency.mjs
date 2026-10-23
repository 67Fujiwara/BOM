// ラウンド7: 反応時間 A/B（現行ビルド 5197 / ラウンド6 時点 8a7cb84 のビルド 5198。ビュー切替は ID 列から）。交互に ROUNDS 巡。
// 1) 英字コマンド 1 打（押してから保存データに反映まで）: 文字を打てる列で現行は Alt+h・Alt+Shift+D、r5 は h・Shift+D。ID 列では両方とも h
// 2) 80 / 300 / 2,500 行: j・ビュー切替・Space・PageDown（ディスパッチ〜次の描画）、Enter→文字→Enter（実打鍵 20 回の平均）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib7.mjs'
const TARGETS = [['build-r7', 5198], ['build-current', 5197]]
const ROUNDS = Number(process.env.ROUNDS ?? 3)
const SIZES = (process.env.SIZES ?? '80,300,2500').split(',').map(Number)
const res = {}
async function setup(url, n) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
  if (n > 80) {
    await page.evaluate((n) => {
      const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId)
      const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0
      while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ }
      localStorage.setItem(k, JSON.stringify(w))
    }, n)
    await page.evaluate(() => { Storage.prototype.setItem = function () {} }); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  }
  return { browser, page }
}
async function goCell(page, id, col) {
  await page.keyboard.press('Alt+1'); await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(id); await page.keyboard.press('Enter')
  await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' ' + col); i++) await page.keyboard.press('ArrowRight')
}
async function letterLatency(url, tag) {
  const out = {}
  const cases = true
    ? [['隠す（部品名・Alt+h）', { key: 'h', code: 'KeyH', altKey: true }, '部品名', 'hidden'], ['複製（型式・Alt+Shift+D）', { key: 'D', code: 'KeyD', altKey: true, shiftKey: true }, '型式', 'rows'], ['隠す（ID・h）', { key: 'h', code: 'KeyH' }, 'ID', 'hidden']]
    : [['隠す（部品名・Alt+h）', { key: 'h', code: 'KeyH' }, '部品名', 'hidden'], ['複製（型式・Alt+Shift+D）', { key: 'D', code: 'KeyD', shiftKey: true }, '型式', 'rows'], ['隠す（ID・h）', { key: 'h', code: 'KeyH' }, 'ID', 'hidden']]
  for (const [name, init, col, check] of cases) {
    const s = []
    for (let i = 0; i < 5; i++) {
      const { browser, page } = await setup(url, 80)
      await goCell(page, 'R040', col)
      s.push(await page.evaluate(async ([init, check]) => {
        const k = 'bom-pro.workspace.v2'
        const state = () => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return check === 'hidden' ? p.rows.find((r) => r.id === 'R040').hidden : p.rows.length }
        const s0 = state(); const t0 = performance.now()
        document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
        for (;;) { if (state() !== s0) return Math.round(performance.now() - t0); if (performance.now() - t0 > 3000) return -1; await new Promise((r) => setTimeout(r, 5)) }
      }, [init, check]))
      await browser.close()
    }
    s.sort((a, b) => a - b); out[name] = { median: s[2], samples: s }
  }
  return out
}
async function measure(url, n) {
  const { browser, page } = await setup(url, n)
  await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home')
  const m = await page.evaluate(async () => {
    const one = async (keys, n) => { const out = []; for (let i = 0; i < n; i++) { const k = keys[i % keys.length]; const t = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: k[0], code: k[1], bubbles: true, cancelable: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); out.push(performance.now() - t) } out.sort((a, b) => a - b); return +out[n >> 1].toFixed(1) }
    return { j: await one([['ArrowDown', 'ArrowDown'], ['ArrowUp', 'ArrowUp']], 30), view: await one([['1', 'Digit1'], ['4', 'Digit4'], ['2', 'Digit2'], ['9', 'Digit9'], ['5', 'Digit5']], 30), space: await one([[' ', 'Space']], 16), pageDown: await one([['PageDown', 'PageDown'], ['PageUp', 'PageUp']], 16) }
  })
  await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Home'); for (let i = 0; i < 40 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' 部品名'); i++) await page.keyboard.press('ArrowRight')
  const t1 = Date.now(); for (let i = 0; i < 20; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('品' + i); await page.keyboard.press('Enter') } const e20 = Date.now() - t1
  // Ctrl+Z 1 回（セル編集の取り消し）
  const tz = Date.now(); for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z'); const z5 = Date.now() - tz
  await browser.close()
  return { ...m, perEnter: +(e20 / 20).toFixed(1), perUndo: +(z5 / 5).toFixed(1) }
}
const lat = {}
for (let r = 0; r < ROUNDS; r++) {
  for (const n of SIZES) for (const [tag, port] of TARGETS) {
    const k = `${tag}@${n}`
    const v = await measure(`http://localhost:${port}/`, n)
    ;(res[k] ??= []).push(v)
    console.log(r, k, JSON.stringify(v))
  }
  if (r === 0 && !process.env.SKIP_LETTER) for (const [tag, port] of TARGETS) { lat[tag] = await letterLatency(`http://localhost:${port}/`, tag); console.log('letter', tag, JSON.stringify(lat[tag])) }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const summary = {}
for (const [k, arr] of Object.entries(res)) { summary[k] = {}; for (const f of Object.keys(arr[0])) summary[k][f] = med(arr.map((x) => x[f])) }
console.log(JSON.stringify(summary, null, 1))
saveJson(process.env.OUT ?? '59-latency.json', { summary, lat, raw: res })
