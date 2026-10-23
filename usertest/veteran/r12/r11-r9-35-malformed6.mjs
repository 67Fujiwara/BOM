// ラウンド9: 新しい形の壊れた・極端な JSON（正規表現の試しをすり抜ける形、休日の上限・重複）。元はラウンド8（保存データとして読み込ませる）。読み込み時間・全キーの反応・console error・画面が壊れないか
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib12.mjs'
const URL = `http://localhost:${process.env.PORT ?? 5197}/`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const allDays = (from, years) => { const a = []; const d = new Date(from); for (let i = 0; i < years * 366; i++) { a.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) } return a }
const P = (w) => w.projects.find((x) => x.id === w.currentProjectId)
const RX = (pattern, extra = {}) => ({ id: 'rx' + Math.random().toString(36).slice(2, 7), name: '型式の形', field: 'model', type: 'regex', pattern, severity: 'warn', message: '型式の形', owner: 'x', scope: 'all', enabled: true, ...extra })
const SHAPES = {
  'regex 試しをすり抜ける ^([A-Z]+-?)+$・型式 英大文字 24＋1': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; P(w).rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUVWX1' },
  'regex 試しをすり抜ける ^([A-Z]+-?)+$・型式 英大文字 28＋1': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; P(w).rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUVWXYZAB1' },
  'regex 試しをすり抜ける・300 行すべて英大文字 19＋1（1 回は 30ms 未満）': (w) => { w.rules = [...(w.rules ?? []), RX('^([A-Z]+-?)+$')]; grow(P(w), 300); P(w).rows.forEach((r, i) => { if (r.status !== 'cancelled' && r.status !== 'replaced') r.model = 'ABCDEFGHIJKLMNOPQRS'.slice(0, 19) + (i % 10) }) },
  'regex 部品名 カタカナ ^([ァ-ヶー]+・?)+$・300 行 20 字＋（': (w) => { w.rules = [...(w.rules ?? []), RX('^([ァ-ヶー]+・?)+$', { field: 'name' })]; grow(P(w), 300); P(w).rows.forEach((r) => { r.name = 'リレーソケットユニットターミナルブロ（' }) },
  'regex when が重い（^([A-Z0-9]+-?)+$）': (w) => { w.rules = [...(w.rules ?? []), RX('.', { when: '^([A-Z0-9]+-?)+$' })]; P(w).rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!' },
  'regex 1,000 本（別々の正規表現）': (w) => { w.rules = [...(w.rules ?? []), ...Array.from({ length: 1000 }, (_, i) => RX(`^[A-Z0-9-]{1,${i + 5}}$`))] },
  'regex 1MB の正規表現': (w) => { w.rules = [...(w.rules ?? []), RX('^(' + 'ABC|'.repeat(250000) + 'X)$')] },
  'regex 書き方の誤り・数値・null': (w) => { w.rules = [...(w.rules ?? []), RX('('), RX(123), RX(null), { ...RX('^A'), field: '__proto__' }] },
  'holidays 5,000 件（今日から毎日）＋300 行': (w) => { P(w).settings.holidays = allDays('2026-10-01', 14).slice(0, 5000); grow(P(w), 300) },
  'holidays 同じ日 10 万件＋300 行': (w) => { P(w).settings.holidays = Array(100000).fill('2026-10-26'); grow(P(w), 300) },
  'holidays 2,500 行・毎日 10 年': (w) => { P(w).settings.holidays = allDays('2026-10-01', 10); grow(P(w), 2500) },
  'holidays が文字列（配列でない）': (w) => { P(w).settings.holidays = '2026-10-26,2026-10-27' },
  'rules が物（配列でない）・rule が null': (w) => { w.rules = { a: 1 } },
}
function grow(p, n) { const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); p.rows.push(r); i++ } }
const only = process.env.ONLY
for (const [name, mut] of Object.entries(SHAPES)) {
  if (only && !name.includes(only)) continue
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  const rec = { name }
  try {
    await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.goto(URL)
    await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); await sleep(50)
    const w = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
    mut(w)
    await page.evaluate((s) => { localStorage.setItem('bom-pro.workspace.v2', s) }, JSON.stringify(w))
    const t0 = Date.now()
    await page.reload({ timeout: 600000 }); await page.waitForSelector('[data-testid="grid"]', { timeout: 600000 })
    rec.loadMs = Date.now() - t0
    rec.toast = await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 160) ?? '')
    await page.locator('.gridwrap').focus()
    const keys = ['ArrowDown', 'ArrowDown', 'Alt+4', 'F8', 'Alt+1', 'ArrowDown', 'Enter', 'x', 'Enter', 'Control+z', 'Alt+7', 'Alt+9', 'Alt+3', 'Space', 'Alt+1', 'Control+k', 'Escape', 'F1', 'Escape']
    const t1 = Date.now(); const slow = []
    for (const k of keys) { const t = Date.now(); await page.keyboard.press(k, { timeout: 600000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())), null); const d = Date.now() - t; if (d > 300) slow.push(`${k}:${d}`) }
    rec.keysMs = Date.now() - t1; rec.slow = slow
    rec.alive = await page.evaluate(() => !!document.querySelector('[data-testid="grid"]') && !document.body.innerText.includes('問題が起きました'))
    rec.cursor = await page.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent ?? '')
  } catch (e) { rec.error = String(e).slice(0, 200) }
  rec.errs = [...new Set(errs)].slice(0, 5)
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 900))
  await browser.close().catch(() => {})
}
saveJson(`35-malformed6${only ? '-' + only : ''}${process.env.PORT ? '-' + process.env.PORT : ''}.json`, out)
