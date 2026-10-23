// ラウンド8: 新しい形の壊れた・極端な JSON（保存データとして読み込ませる）。読み込み時間・全キーの反応・console error・画面が壊れないか
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib15.mjs'
const URL = `http://localhost:${process.env.PORT ?? 5197}/`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const allDays = (from, years) => { const a = []; const d = new Date(from); for (let i = 0; i < years * 366; i++) { a.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) } return a }
const P = (w) => w.projects.find((x) => x.id === w.currentProjectId)
const SHAPES = {
  'holidays 毎日 10 年（今日から）': (w) => { P(w).settings.holidays = allDays('2026-10-01', 10) },
  'holidays 毎日 10 年 + 300 行': (w) => { P(w).settings.holidays = allDays('2026-10-01', 10); grow(P(w), 300) },
  'holidays 変な文字': (w) => { P(w).settings.holidays = ['', 'abc', '2026/12/31', '9999-99-99', '2026-02-30', '+275760-09-13', 123, null] },
  'settings 数字が文字（"1e8"・"-5"）': (w) => { Object.assign(P(w).settings, { formalDays: '1e8', processDays: '-5', quoteDays: 'NaN' }) },
  'settings 負の巨大値': (w) => { Object.assign(P(w).settings, { formalDays: -1e8, processDays: -1e308, budget: -1e308, exceptionPct: 1e308 }) },
  'statusChangedAt が文字でない・日付でない': (w) => { P(w).rows.forEach((r, i) => { r.statusChangedAt = ['not-a-date', '', '9999-99-99', '+275760-09-13T00:00:00Z', '0001-01-01'][i % 5] }) },
  'dueAt 9999-99-99 / dueDate 0000-00-00': (w) => { P(w).dueDate = '0000-00-00'; P(w).rows.forEach((r) => { r.dueAt = '9999-99-99' }) },
  'needDateFixed 2026-02-30・+275760': (w) => { P(w).rows.forEach((r, i) => { r.needDateFixed = i % 2 ? '2026-02-30' : '+275760-09-13' }) },
  '同じ ID の行・空の ID・__proto__': (w) => { const p = P(w); p.rows[1].id = p.rows[0].id; p.rows[2].id = ''; p.rows[3].id = '__proto__'; p.rows[4].id = 'constructor' },
  '文字の列に物・配列・数': (w) => { const p = P(w); p.rows[0].note = { x: 1 }; p.rows[1].name = ['a', 'b']; p.rows[2].model = 12345; p.rows[3].maker = true; p.rows[4].qtyNeeded = 'abc'; p.rows[5].working = { name: { y: 2 } } },
  'packQty 1e-300・0・-1、qtyNeeded 1e300': (w) => { const p = P(w); p.rows[0].packQty = 1e-300; p.rows[1].packQty = 0; p.rows[2].packQty = -1; p.rows[3].qtyNeeded = 1e300; p.rows[4].qtyNeeded = -5 },
  '見積 leadDays 1e15・unitPrice -1・moq 0・商社不明': (w) => { const p = P(w); p.quotes.slice(0, 6).forEach((q, i) => { if (i === 0) q.leadDays = 1e15; if (i === 1) q.unitPrice = -1; if (i === 2) q.moq = 0; if (i === 3) q.supplierId = 'S999'; if (i === 4) q.validUntil = 'never' }) },
  '指摘 field=__proto__・rowId 無し・status 不明': (w) => { const p = P(w); p.issues[0].field = '__proto__'; p.issues[1].rowId = 'R999'; p.issues[2].status = 'weird' },
  'ルールの正規表現が重い ^([A-Z0-9]+-?)+$（型式 22 文字＋!）': (w) => { w.rules = [...(w.rules ?? []), { id: 'rx', name: '型式の形', field: 'model', type: 'regex', pattern: '^([A-Z0-9]+-?)+$', severity: 'warn', message: '型式の形', owner: 'x', scope: 'all', enabled: true }]; P(w).rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUV!' },
  'ルールの正規表現が重い（型式 26 文字＋!）': (w) => { w.rules = [...(w.rules ?? []), { id: 'rx', name: '型式の形', field: 'model', type: 'regex', pattern: '^([A-Z0-9]+-?)+$', severity: 'warn', message: '型式の形', owner: 'x', scope: 'all', enabled: true }]; P(w).rows[0].model = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!' },
  'user.role=admin・currentProjectId 無し': (w) => { w.user = { ...(w.user ?? {}), role: 'admin' }; w.currentProjectId = 'P-NONE' },
  'projects 空': (w) => { w.projects = [] },
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
    await page.reload({ timeout: 60000 }); await page.waitForSelector('[data-testid="grid"]', { timeout: 60000 })
    rec.loadMs = Date.now() - t0
    rec.toast = await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 160) ?? '')
    await page.locator('.gridwrap').focus()
    const keys = ['ArrowDown', 'ArrowDown', 'Alt+4', 'F8', 'Alt+1', 'ArrowDown', 'Enter', 'x', 'Enter', 'Control+z', 'Alt+7', 'Alt+9', 'Alt+3', 'Space', 'Alt+1', 'Control+k', 'Escape', 'F1', 'Escape']
    const t1 = Date.now(); const slow = []
    for (const k of keys) { const t = Date.now(); await page.keyboard.press(k, { timeout: 60000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())), null); const d = Date.now() - t; if (d > 300) slow.push(`${k}:${d}`) }
    rec.keysMs = Date.now() - t1; rec.slow = slow
    rec.alive = await page.evaluate(() => !!document.querySelector('[data-testid="grid"]') && !document.body.innerText.includes('問題が起きました'))
    rec.cursor = await page.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent ?? '')
  } catch (e) { rec.error = String(e).slice(0, 200) }
  rec.errs = [...new Set(errs)].slice(0, 5)
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 900))
  await browser.close().catch(() => {})
}
saveJson(`r8-20-malformed5${only ? '-' + only : ''}.json`, out)
