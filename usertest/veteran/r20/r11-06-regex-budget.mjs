// ラウンド10: V8-08 の残り（重い正規表現）。r9 の形（全行が重い・1 行だけ重い）と、平均の予算（20 回以上で平均 1ms 超なら飛ばす）をすり抜ける形
// （重い行がまばら: 1/12・1/25・1/100）。読み込み時間・F8 / 確定 / Ctrl+Z / ↓ の時間（ms）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib20.mjs'
const PORTS = (process.env.PORTS ?? '5197,5198').split(',').map(Number)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const P = (w) => w.projects.find((x) => x.id === w.currentProjectId)
const RX = (pattern, extra = {}) => ({ id: 'rx' + Math.random().toString(36).slice(2, 7), name: '型式の形', field: 'model', type: 'regex', pattern, severity: 'warn', message: '型式の形', owner: 'x', scope: 'all', enabled: true, ...extra })
function grow(p, n) { const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); p.rows.push(r); i++ } }
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH'
const sparse = (n, every, len) => (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; grow(P(w), n); P(w).rows.forEach((r, i) => { if (r.status === 'cancelled' || r.status === 'replaced') return; r.model = i % every === 0 ? L.slice(0, len) + '1' : 'AB-' + i }) }
const SHAPES = {
  'r9 形: 300 行すべて英大文字 19＋1': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; grow(P(w), 300); P(w).rows.forEach((r, i) => { if (r.status !== 'cancelled' && r.status !== 'replaced') r.model = L.slice(0, 19) + (i % 10) }) },
  'r9 形: カタカナ 300 行 20 字＋（': (w) => { w.rules = [...(w.rules ?? []), RX('^([ァ-ヶー]+・?)+$', { field: 'name' })]; grow(P(w), 300); P(w).rows.forEach((r) => { r.name = 'リレーソケットユニットターミナルブロ（' }) },
  'r9 形: 1 行だけ 28＋1': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; P(w).rows[0].model = L.slice(0, 28) + '1' },
  'r8 形: ^([A-Z0-9]+-?)+$ 26＋!': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z0-9]+-?)+$')]; P(w).rows[0].model = L.slice(0, 26) + '!' },
  'まばら 300 行・1/12 が 20＋1': sparse(300, 12, 20),
  'まばら 300 行・1/25 が 21＋1': sparse(300, 25, 21),
  'まばら 300 行・1/25 が 22＋1': sparse(300, 25, 22),
  'まばら 2,500 行・1/100 が 21＋1': sparse(2500, 100, 21),
  'まばら 2,500 行・1/100 が 22＋1': sparse(2500, 100, 22),
}
const out = []
const only = process.env.ONLY
for (const [name, mut] of Object.entries(SHAPES)) for (const port of PORTS) {
  if (only && !name.includes(only)) continue
  const URL = `http://localhost:${port}/`
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const rec = { name, port }
  try {
    await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(URL)
    await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); await sleep(50)
    const w = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2'))); mut(w)
    await page.evaluate((s) => { localStorage.setItem('bom-pro.workspace.v2', s) }, JSON.stringify(w))
    const t0 = Date.now(); await page.reload({ timeout: 600000 }); await page.waitForSelector('[data-testid="grid"]', { timeout: 600000 }); rec.loadMs = Date.now() - t0
    await page.locator('.gridwrap').focus()
    // ページ内で「キー → 次の描画」を測る（F8・必要数の確定・Ctrl+Z・↓）。各 5 回の中央値
    rec.ms = await page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
      const key = (init) => document.querySelector('.gridwrap').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
      const med = (a) => { const b = [...a].sort((x, y) => x - y); return Math.round(b[b.length >> 1]) }
      const time = async (init) => { const t = performance.now(); key(init); await frame(); return performance.now() - t }
      const m = { f8: [], down: [], commit: [], undo: [] }
      for (let i = 0; i < 5; i++) m.f8.push(await time({ key: 'F8', code: 'F8' }))
      key({ key: '1', code: 'Digit1', altKey: true }); await frame()
      for (let i = 0; i < 5; i++) m.down.push(await time({ key: 'ArrowDown', code: 'ArrowDown' }))
      // 必要数の列へ
      key({ key: 'Home', code: 'Home' }); await frame()
      for (let i = 0; i < 30 && !(document.querySelector('[data-testid="cursor"]')?.textContent ?? '').endsWith('必要数'); i++) { key({ key: 'ArrowRight', code: 'ArrowRight' }); await frame() }
      for (let i = 0; i < 5; i++) { key({ key: String(i + 2), code: 'Digit' + (i + 2) }); await frame(); m.commit.push(await time({ key: 'Enter', code: 'Enter' })) }
      for (let i = 0; i < 5; i++) m.undo.push(await time({ key: 'z', code: 'KeyZ', ctrlKey: true }))
      return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, med(v)]))
    })
    rec.alive = await page.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
  } catch (e) { rec.error = String(e).slice(0, 200) }
  rec.errs = [...new Set(errs)].slice(0, 3)
  out.push(rec); console.log(JSON.stringify(rec))
  await browser.close().catch(() => {})
}
saveJson(`06-regex-budget${process.env.TAG ?? ''}.json`, out)
