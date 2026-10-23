// ラウンド2 共通部品（../lib.mjs を流用。fresh で sessionStorage も消す）
import fs from 'node:fs'
import path from 'node:path'
export * from '../lib.mjs'
import { launch as launch0, setRole, URL } from '../lib.mjs'
export const R2 = path.resolve('usertest/veteran/r2')
export const SHOTS2 = path.join(R2, 'shots')
export const DL2 = path.join(R2, 'dl')
export async function launch(opts = {}) {
  const r = await launch0(opts)
  return r
}
export async function fresh(page, role = 'design') {
  page._tag = 'fresh'
  await page.goto(URL)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(URL)
  await page.waitForSelector('[data-testid="grid"]')
  if (role !== 'design') await setRole(page, role)
  await page.locator('.gridwrap').focus()
}
export async function shot2(page, name) { await page.screenshot({ path: path.join(SHOTS2, name + '.png') }).catch(() => {}) }
export function save2(name, data) { fs.writeFileSync(path.join(R2, name), JSON.stringify(data, null, 2)) }
export async function ws(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2') ?? 'null')) }
export async function proj(page) { let w = await ws(page); if (!w) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); w = await ws(page) } return w.projects.find((x) => x.id === w.currentProjectId) }
export async function row(page, id) { return (await proj(page)).rows.find((r) => r.id === id) }
export async function panel(page) { return page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null) }
export async function closeAll(page) {
  for (let i = 0; i < 10; i++) {
    const p = await panel(page)
    const m = (await page.getByTestId('mode').textContent()) ?? ''
    if (!p && m === 'ナビ') break
    await page.keyboard.press('Escape')
  }
  await page.locator('.gridwrap').focus()
}
export async function palette(page, q) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(q)
  await page.keyboard.press('Enter')
}
export async function toastNow(page) {
  const t = page.getByTestId('toast-float'); if (await t.count()) return (await t.first().textContent()) ?? ''
  const t2 = page.getByTestId('toast'); return (await t2.count()) ? ((await t2.textContent()) ?? '') : ''
}
export async function pageErrors(errors, from = 0) { return errors.slice(from).filter((e) => e.type === 'pageerror' || e.type === 'error') }
/** パレットで、ラベルが label で始まる項目を ↓ で選んで実行（先頭が別のコマンドになる不具合の回避） */
export async function paletteExact(page, label, query = label) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(query)
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? ''))
  const i = items.findIndex((t) => t === label)
  const idx = i >= 0 ? i : items.findIndex((t) => t.startsWith(label))
  if (idx < 0) { await page.keyboard.press('Escape'); return false }
  for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  return true
}
