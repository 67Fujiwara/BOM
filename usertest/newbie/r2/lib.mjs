import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/user/BOM/usertest/newbie/r2'
export const SHOTS = path.join(ROOT, 'shots')
export const URL = 'http://localhost:5173/'

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, colorScheme: opts.colorScheme ?? 'light', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
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
  await page.goto(URL)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(URL)
  await page.getByTestId('grid').waitFor()
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
export async function store(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
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
