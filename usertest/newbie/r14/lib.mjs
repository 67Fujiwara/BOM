import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/user/BOM/usertest/newbie/r14'
export const SHOTS = path.join(ROOT, 'shots')
export const URL = 'http://localhost:5174/'

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, colorScheme: opts.colorScheme ?? 'light', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  // テスト用: ?fresh=… で開いたときだけ、アプリより先に保存データを消す（pagehide で書き戻されるのを避ける）
  await context.addInitScript(() => { if (location.search.includes('fresh=')) { try { localStorage.clear(); sessionStorage.clear() } catch {} ; history.replaceState(null, '', location.pathname) } })
  const page = await context.newPage()
  const errors = []
  attachErrors(page, errors)
  return { browser, context, page, errors }
}
export function attachErrors(page, errors, tag = '') {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ tag, type: m.type(), text: m.text().slice(0, 500), url: m.location()?.url }) })
  page.on('pageerror', (e) => errors.push({ tag, type: 'pageerror', text: String(e.message ?? e).slice(0, 500) }))
}

export async function fresh(page, role) {
  await page.goto(URL + '?fresh=' + Date.now())
  await page.getByTestId('grid').waitFor()
  const leftover = await page.evaluate(() => sessionStorage.length + ':' + Object.keys(localStorage).join(','))
  if (!/^0:/.test(leftover)) { /* 初期化で書かれるものは許す */ }
  if (role && role !== 'design') await page.getByTestId(`role-${role}`).click()
  await page.locator('.gridwrap').focus()
}
export async function setRole(page, role) {
  await page.getByTestId(`role-${role}`).click()
  await page.locator('.gridwrap').focus().catch(() => {})
}

export const T = {
  status: (page) => page.getByTestId('status').textContent(),
  toast: async (page) => { const t = page.getByTestId('toast-float'); if (await t.count()) return t.textContent(); const t2 = page.getByTestId('toast'); return (await t2.count()) ? t2.textContent() : null },
  mode: (page) => page.getByTestId('mode').textContent(),
  cursor: (page) => page.getByTestId('cursor').textContent(),
  panel: async (page) => { const o = page.locator('.overlay'); return (await o.count()) ? (await o.getAttribute('data-testid')) : null },
  panelText: async (page) => { const o = page.locator('.overlay'); return (await o.count()) ? (await o.innerText()).replace(/\s+/g, ' ').slice(0, 400) : null },
  view: async (page) => { for (let i = 1; i <= 9; i++) if ((await page.getByTestId(`view-${i}`).getAttribute('aria-current')) === 'true') return i; return null },
  rows: (page) => page.getByTestId('row').count(),
  header: (page) => page.getByTestId('header').textContent(),
  role: async (page) => { for (const r of ['design', 'purchasing', 'pm']) if ((await page.getByTestId(`role-${r}`).getAttribute('aria-pressed')) === 'true') return r; return null },
  hints: async (page) => (await page.locator('.status .hints').innerText()).replace(/\s+/g, ' '),
  crash: async (page) => page.getByTestId('crash').count(),
  cell: (page, id, cls) => page.locator(`[data-row-id="${id}"] td.${cls}`).first().textContent(),
  rowText: async (page, id) => { const l = page.locator(`[data-row-id="${id}"]`); return (await l.count()) ? (await l.first().innerText()).replace(/\s+/g, ' ') : null },
}

export function makeLog(name) {
  if (process.env.REPRO) name = name + '_r2'
  const lines = []
  const findings = []
  const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); lines.push(s); console.log(s) }
  const finding = (f) => { findings.push(f); log('FINDING:', f) }
  const save = (errors) => {
    const filtered = errors
    fs.writeFileSync(path.join(ROOT, 'results', `${name}.json`), JSON.stringify({ name, findings, errors: filtered, lines }, null, 2))
    fs.writeFileSync(path.join(ROOT, 'results', `${name}.out`), lines.join('\n') + '\n\nERRORS:\n' + filtered.map((e) => JSON.stringify(e)).join('\n'))
    console.log('ERRORS', filtered.length, JSON.stringify(filtered.slice(0, 10)))
  }
  return { log, finding, save }
}

export async function shot(page, name) {
  const p = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: p })
  return p
}

export async function sel(page, id) {
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill(id)
  await page.keyboard.press('Enter')
}
export async function gotoCol(page, label) {
  await page.keyboard.press('Home')
  for (let i = 0; i < 40; i++) {
    const c = await T.cursor(page)
    if (c.split(' ').slice(1).join(' ') === label || c.endsWith(' ' + label)) return true
    await page.keyboard.press('ArrowRight')
  }
  return false
}
export async function clearToast(page) {
  const t = page.getByTestId('toast-float')
  if (await t.count()) await t.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
}
/** 保存済み（localStorage）のワークスペース */
export async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
}
/** 画面が持っている現在のワークスペース（開発サーバーのモジュールを読むだけ） */
export async function store(page) {
  return page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')) ?? '/src/model/store.ts'; const m = await import(u); return JSON.parse(JSON.stringify(m.useStore.getState().ws)) })
}
export async function ui(page) {
  return page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')) ?? '/src/model/store.ts'; const m = await import(u); const s = m.useStore.getState(); return { mode: s.mode, view: s.view, cursorRow: s.cursorRow, cursorCol: s.cursorCol, editValue: s.editValue, panel: s.panel?.kind ?? null, sort: s.sort, filter: s.filter, cellFilter: s.cellFilter, hiddenCols: s.hiddenCols, role: s.ws.user.role, user: s.ws.user.name } })
}
export async function palette(page, q) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(q)
  await page.waitForTimeout(50)
}
export async function paletteTop(page, n = 5) {
  return page.getByTestId('palette-list').locator('.item').evaluateAll((els, n) => els.slice(0, n).map((e) => e.textContent.replace(/\s+/g, ' ').trim()), n)
}
/** パレットで label を含む項目を ↓ で選んで Enter（新人が目で探して選ぶ動き） */
export async function runPalette(page, q, label = q) {
  await palette(page, q)
  const items = await page.getByTestId('palette-list').locator('.item').allTextContents()
  const i = items.findIndex((t) => t.includes(label))
  if (i < 0) { await page.keyboard.press('Escape'); return false }
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  return true
}

/** 現在の案件の行 */
export async function row(page, id) {
  const ws = await store(page)
  if (!ws) return null
  const p = ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
  return p.rows.find((r) => r.id === id) ?? null
}
export async function proj(page) {
  const ws = await store(page)
  if (!ws) return null
  return ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
}
export function diff(a, b) { if (!b) return 'n/a'; a = a ?? {}; const out = []; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]); if (x !== y) out.push(`${k}: ${(x ?? '').slice(0, 80)} -> ${(y ?? '').slice(0, 80)}`) } return out.join('; ') }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 実際のキーボードのように打つ（大文字は Shift を押しながら） */
export async function typeReal(page, text, delay = 30) {
  for (const ch of text) {
    if (/^[A-Z]$/.test(ch)) await page.keyboard.press(`Shift+Key${ch}`)
    else await page.keyboard.press(ch === ' ' ? 'Space' : ch)
    if (delay) await page.waitForTimeout(delay)
  }
}
