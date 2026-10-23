// ラウンド6: 2,500 行で「値 → Enter」1 回の CPU プロファイル（開発サーバー＝関数名と行が読める）。上位の関数（自己時間）と、呼び出し元を含む時間
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib6.mjs'
const N = Number(process.env.N ?? 2500)
const url = `http://localhost:${process.env.PORT ?? 5173}/`
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(url)
await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
await page.evaluate((n) => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) }, N)
await page.evaluate(() => { Storage.prototype.setItem = function () {} }); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); for (let i = 0; i < 30 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith(' 部品名'); i++) await page.keyboard.press('ArrowRight')
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('warm'); await page.keyboard.press('Enter')
const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start')
const t0 = Date.now()
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('prof'); await page.keyboard.press('Enter')
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
const ms = Date.now() - t0
const { profile } = await cdp.send('Profiler.stop')
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const dt = new Map(); profile.samples.forEach((s, i) => dt.set(s, (dt.get(s) ?? 0) + (profile.timeDeltas[i] ?? 0)))
const self = new Map(); const total = new Map()
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const keyOf = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${n.callFrame.lineNumber + 1}`
for (const [id, t] of dt) {
  const n = byId.get(id); const k = keyOf(n); self.set(k, (self.get(k) ?? 0) + t)
  const seen = new Set(); let cur = id
  while (cur != null) { const kk = keyOf(byId.get(cur)); if (!seen.has(kk)) { total.set(kk, (total.get(kk) ?? 0) + t); seen.add(kk) } cur = parent.get(cur) }
}
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`)
const res = { N, ms, self: top(self), total: top(new Map([...total].filter(([k]) => k.includes('src/')))) }
console.log(JSON.stringify(res, null, 1))
saveJson('64-profile.json', res)
await browser.close()
