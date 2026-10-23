// 反応時間 A/B: 現行（開発 5173 / ビルド 5190）とラウンド2 時点 942e310（開発 5194 / ビルド 5191）。交互に 3 巡。80 行（サンプル）と 300 行
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const TARGETS = [['dev-current', 5173], ['dev-r3', 5197], ['build-current', 5195], ['build-r3', 5196]]
const ROUNDS = Number(process.env.ROUNDS ?? 3)
const res = {}
async function measure(url, n300) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(url)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+s')
  if (n300) {
    // サンプルの行を複製して 300 行にする（ID だけ変える）
    await page.evaluate(() => {
      const k = 'bom-pro.workspace.v2'
      const w = JSON.parse(localStorage.getItem(k))
      const p = w.projects.find((x) => x.id === w.currentProjectId)
      const base = p.rows.filter((r) => r.status === 'draft' || r.status === 'submitted' || r.status === 'quoting' || r.status === 'quoted')
      let i = 0
      while (p.rows.length < 300) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(3, '0'); r.refDes = ''; p.rows.push(r); i++ }
      localStorage.setItem(k, JSON.stringify(w))
    })
    await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  }
  await page.keyboard.press('1'); await page.keyboard.press('ArrowDown')
  const m = await page.evaluate(async () => {
    const one = async (keys, n) => { const out = []; for (let i = 0; i < n; i++) { const k = keys[i % keys.length]; const t = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: k[0], code: k[1], bubbles: true, cancelable: true })); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); out.push(performance.now() - t) } out.sort((a, b) => a - b); return { median: +out[n >> 1].toFixed(1), p90: +out[Math.floor(n * 0.9)].toFixed(1) } }
    return {
      j: await one([['j', 'KeyJ'], ['k', 'KeyK']], 40),
      right: await one([['ArrowRight', 'ArrowRight'], ['ArrowLeft', 'ArrowLeft']], 40),
      view: await one([['1', 'Digit1'], ['4', 'Digit4'], ['2', 'Digit2'], ['9', 'Digit9'], ['5', 'Digit5']], 40),
      space: await one([[' ', 'Space']], 20),
      pageDown: await one([['PageDown', 'PageDown'], ['PageUp', 'PageUp']], 20),
    }
  })
  await page.keyboard.press('1')
  const t0 = Date.now(); for (let i = 0; i < 10; i++) for (const k of '123456789') await page.keyboard.press(k); const v90 = Date.now() - t0
  // Enter → 文字 → Enter（確定して次の行）×20
  await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('j')
  const t1 = Date.now(); for (let i = 0; i < 20; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('品' + i); await page.keyboard.press('Enter') } const e20 = Date.now() - t1
  const rowsRendered = await page.evaluate(() => document.querySelectorAll('tr.row, [data-testid="row"]').length)
  await browser.close()
  return { ...m, views90ms: v90, perViewPress: +(v90 / 90).toFixed(1), enter20ms: e20, perEnter: +(e20 / 20).toFixed(1), rowsRendered, errs: errs.slice(0, 3) }
}
for (let r = 0; r < ROUNDS; r++) {
  for (const n300 of [false, true]) {
    for (const [tag, port] of TARGETS) {
      const k = `${tag}${n300 ? '@300' : '@80'}`
      const v = await measure(`http://localhost:${port}/`, n300)
      ;(res[k] ??= []).push(v)
      console.log(r, k, JSON.stringify(v))
    }
  }
}
// 中央値でまとめる
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const summary = {}
for (const [k, arr] of Object.entries(res)) {
  summary[k] = {}
  for (const f of ['j', 'right', 'view', 'space', 'pageDown']) summary[k][f] = med(arr.map((x) => x[f].median))
  for (const f of ['perViewPress', 'perEnter', 'rowsRendered']) summary[k][f] = med(arr.map((x) => x[f]))
}
console.log(JSON.stringify(summary, null, 1))
fs.writeFileSync('/home/user/BOM/usertest/veteran/r4/rerun/02-perf.json', JSON.stringify({ summary, raw: res }, null, 2))
