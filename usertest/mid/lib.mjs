import { chromium } from '@playwright/test'
import fs from 'node:fs'

export const SHOTS = 'usertest/mid/shots'
fs.mkdirSync(SHOTS, { recursive: true })

export async function launch() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()) })
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))
  const t = {
    browser, context, page, errors,
    async open(role = 'design') {
      await page.goto('http://localhost:5173/')
      await page.evaluate(() => localStorage.clear())
      await page.goto('http://localhost:5173/')
      await page.getByTestId('grid').waitFor()
      await t.role(role)
      await page.locator('.gridwrap').focus()
    },
    async reload() { await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus() },
    async role(role) {
      const label = role === 'purchasing' ? '購買' : role === 'pm' ? 'PM' : '設計'
      await page.locator('.role button', { hasText: label }).click()
      await page.locator('.gridwrap').focus()
    },
    async press(...keys) { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(30) } },
    async type(s) { await page.keyboard.type(s) },
    async goto(id) { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(id); await page.keyboard.press('Enter'); await page.waitForTimeout(50) },
    async col(label) { // move cursor to column by label
      for (let i = 0; i < 60; i++) { const c = await t.cursor(); if (c.endsWith(' ' + label)) return; await page.keyboard.press('ArrowRight') }
      for (let i = 0; i < 60; i++) { const c = await t.cursor(); if (c.endsWith(' ' + label)) return; await page.keyboard.press('ArrowLeft') }
      throw new Error('col not found ' + label + ' cur=' + (await t.cursor()))
    },
    async curCol() { const l = page.locator('td.cursor'); return (await l.count()) ? l.first().getAttribute('data-col') : null },
    async colKey(key) { // move cursor to column by data-col key
      for (let i = 0; i < 80; i++) { const c = await t.curCol(); if (c === key) return; await page.keyboard.press('ArrowRight') }
      for (let i = 0; i < 80; i++) { const c = await t.curCol(); if (c === key) return; await page.keyboard.press('ArrowLeft') }
      throw new Error('colKey not found ' + key)
    },
    async setCellKey(id, colKey, value) { await t.goto(id); await t.colKey(colKey); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(value); await page.keyboard.press('Enter'); await page.waitForTimeout(40) },
    async setCell(id, colLabel, value) { await t.goto(id); await t.col(colLabel); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(value); await page.keyboard.press('Enter'); await page.waitForTimeout(40) },
    async showCol(key) {
      const order = ['id', 'ball', 'ref', 'drawing', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'designated', 'needOffset', 'needDateFixed', 'needDate', 'tags', 'orderQty', 'adopted', 'score', 'unitPrice', 'amount', 'formalPrice', 'formalDiff', 'lead', 'status', 'due', 'waiting', 'ordered', 'received', 'promisedDate', 'receivedLot', 'extraCost', 'extraCostKind', 'note']
      const idx = order.indexOf(key)
      await page.keyboard.press('1'); await page.keyboard.press('c'); await page.getByTestId('columns').waitFor()
      const rows = await page.getByTestId('columns').locator('.opt').allTextContents()
      if (rows[idx].includes('○')) { for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press(' ') }
      await page.keyboard.press('Escape'); await page.waitForTimeout(30)
    },
    cursor: () => page.getByTestId('cursor').textContent(),
    status: () => page.getByTestId('status').textContent(),
    toast: async () => { const l = page.getByTestId('toast'); return (await l.count()) ? l.textContent() : '' },
    header: () => page.getByTestId('header').textContent(),
    lamps: () => page.getByTestId('lamps').textContent(),
    money: () => page.getByTestId('money').textContent(),
    issuesOf: (id) => page.locator(`tr[data-row-id="${id}"] + tr [data-testid="issues"]`),
    rowText: (id) => page.locator(`[data-row-id="${id}"]`).textContent(),
    cell: (id, col) => page.locator(`[data-row-id="${id}"] td[data-col="${col}"]`).textContent(),
    rowCount: () => page.getByTestId('row').count(),
    viewCount: async (n) => (await page.getByTestId('view-' + n).locator('.n').textContent()),
    async ws() { return page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2'))) },
    async proj() { const ws = await t.ws(); return ws.projects.find((p) => p.id === ws.currentProjectId) },
    async row(id) { const p = await t.proj(); return p.rows.find((r) => r.id === id) },
    async shot(name) { await page.screenshot({ path: `${SHOTS}/${name}.png` }) },
    async close() { await browser.close() },
  }
  return t
}

export const log = (...a) => console.log(...a)
export function check(name, cond, detail = '') { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); return cond }
