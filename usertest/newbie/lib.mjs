import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/user/BOM/usertest/newbie'
export const SHOTS = path.join(ROOT, 'shots')

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, colorScheme: opts.colorScheme ?? 'light', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text().slice(0, 500), url: m.location()?.url }) })
  page.on('pageerror', (e) => errors.push({ type: 'pageerror', text: String(e.message ?? e).slice(0, 500) }))
  return { browser, context, page, errors }
}

export async function fresh(page, role) {
  await page.goto('http://localhost:5173/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://localhost:5173/')
  await page.getByTestId('grid').waitFor()
  if (role && role !== 'design') {
    const label = role === 'purchasing' ? '購買' : 'PM'
    await page.locator('.role button', { hasText: label }).click()
  }
  await page.locator('.gridwrap').focus()
}

export const T = {
  status: (page) => page.getByTestId('status').textContent(),
  toast: async (page) => { const t = page.getByTestId('toast'); return (await t.count()) ? t.textContent() : null },
  mode: (page) => page.getByTestId('mode').textContent(),
  cursor: (page) => page.getByTestId('cursor').textContent(),
  panel: async (page) => { const o = page.locator('.overlay'); return (await o.count()) ? (await o.getAttribute('data-testid')) : null },
  view: async (page) => { for (let i = 1; i <= 9; i++) if ((await page.getByTestId(`view-${i}`).getAttribute('aria-current')) === 'true') return i; return null },
  rows: (page) => page.getByTestId('row').count(),
  header: (page) => page.getByTestId('header').textContent(),
}

export function makeLog(name) {
  const lines = []
  const findings = []
  const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); lines.push(s); console.log(s) }
  const finding = (f) => { findings.push(f); log('FINDING:', f) }
  const save = (errors) => {
    fs.writeFileSync(path.join(ROOT, 'results', `${name}.json`), JSON.stringify({ name, findings, errors, lines }, null, 2))
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
    if ((await T.cursor(page)).includes(label)) return true
    await page.keyboard.press('ArrowRight')
  }
  return false
}

/** トーストが消えるまで待つ（古いトーストの読み違いを防ぐ） */
export async function clearToast(page) {
  const t = page.getByTestId('toast')
  if (await t.count()) await t.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}
export async function store(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
}
