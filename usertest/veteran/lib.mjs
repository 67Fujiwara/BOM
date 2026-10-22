import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const SHOTS = path.resolve('usertest/veteran/shots')
export const DL = path.resolve('usertest/veteran/dl')
export const URL = 'http://localhost:5173/'

export const findings = []
export function note(id, sev, title, detail = {}) {
  findings.push({ id, sev, title, ...detail })
  console.log(`[${sev}] ${id} ${title}`, detail.actual ? '→ ' + detail.actual : '')
}

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', ...(opts.launch ?? {}) })
  const context = await browser.newContext({ locale: 'ja-JP', viewport: opts.viewport ?? { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: opts.colorScheme, deviceScaleFactor: opts.dsf, permissions: ['clipboard-read', 'clipboard-write'] })
  const errors = []
  const attach = (page) => {
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text().slice(0, 500), where: page._tag }) })
    page.on('pageerror', (e) => errors.push({ type: 'pageerror', text: String(e.message ?? e).slice(0, 500), stack: String(e.stack ?? '').slice(0, 800), where: page._tag }))
    page.on('dialog', async (d) => { errors.push({ type: 'dialog', text: d.type() + ': ' + d.message(), where: page._tag }); await d.dismiss().catch(() => {}) })
  }
  context.on('page', attach)
  const page = await context.newPage()
  return { browser, context, page, errors, attach }
}

export async function fresh(page, role = 'design') {
  page._tag = 'fresh'
  await page.goto(URL)
  await page.evaluate(() => localStorage.clear())
  await page.goto(URL)
  await page.waitForSelector('[data-testid="grid"]')
  if (role !== 'design') await setRole(page, role)
  await page.locator('.gridwrap').focus()
}
export async function setRole(page, role) {
  const label = role === 'purchasing' ? '購買' : role === 'pm' ? 'PM' : '設計'
  await page.locator('.role button', { hasText: label }).click()
  await page.locator('.gridwrap').focus()
}
export async function goto(page, id) {
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill(id)
  await page.keyboard.press('Enter')
}
export async function cursor(page) { return (await page.getByTestId('cursor').textContent()) ?? '' }
export async function mode(page) { return (await page.getByTestId('mode').textContent()) ?? '' }
export async function toast(page) { const t = page.getByTestId('toast'); return (await t.count()) ? (await t.textContent()) : '' }
export async function status(page) { return (await page.getByTestId('status').textContent()) ?? '' }
export async function toCol(page, label) {
  await page.keyboard.press('Home')
  for (let i = 0; i < 60; i++) {
    if ((await cursor(page)).includes(label)) return true
    await page.keyboard.press('ArrowRight')
  }
  return false
}
export async function state(page) {
  return page.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null')
    return ws
  })
}
export async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => {}) }
export function dumpErrors(errors, tag) {
  const uniq = [...new Map(errors.map((e) => [e.type + e.text, e])).values()]
  console.log(`--- console/page errors (${tag}): ${errors.length} (uniq ${uniq.length})`)
  for (const e of uniq) console.log('  ', e.type, '|', e.where ?? '', '|', e.text.replace(/\n/g, ' ').slice(0, 300))
  return uniq
}
export function save(name, data) {
  fs.writeFileSync(path.join('usertest/veteran', name), JSON.stringify(data, null, 2))
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
