// ラウンド5 共通部品（r4/lib.mjs の写し）（ベテラン）。/home/user/BOM で `node usertest/veteran/r3/xxx.mjs`
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'

export const R3 = path.resolve('/home/user/BOM/usertest/veteran/r8/rerun7/rerun6')
export const SHOTS = path.join(R3, 'shots')
export const DL = path.join(R3, 'dl')
export let URL = process.env.BOM_URL ?? 'http://localhost:5176/'
export const LS_KEY = 'bom-pro.workspace.v2'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', ...(opts.launch ?? {}) })
  const context = await browser.newContext({ locale: 'ja-JP', viewport: opts.viewport ?? { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: opts.colorScheme, deviceScaleFactor: opts.dsf, permissions: ['clipboard-read', 'clipboard-write'] })
  const errors = []
  const attach = (page) => {
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text().slice(0, 500), where: page._tag }) })
    page.on('pageerror', (e) => errors.push({ type: 'pageerror', text: String(e.message ?? e).slice(0, 500), stack: String(e.stack ?? '').slice(0, 800), where: page._tag }))
    page.on('dialog', async (d) => { errors.push({ type: 'dialog', text: d.type() + ': ' + d.message(), where: page._tag }); if (opts.acceptDialogs) await d.accept().catch(() => {}); else await d.dismiss().catch(() => {}) })
  }
  context.on('page', attach)
  const page = await context.newPage()
  return { browser, context, page, errors, attach }
}
export async function fresh(page, role = 'design') {
  page._tag = 'fresh'
  await page.goto(URL)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} })
  await page.goto(URL)
  await page.waitForSelector('[data-testid="grid"]')
  if (role !== 'design') await setRole(page, role)
  await page.locator('.gridwrap').focus()
}
export async function setRole(page, role) {
  const label = role === 'purchasing' ? '購買' : role === 'pm' ? 'PM' : '設計'
  await closeAll(page)
  await page.locator('.role button', { hasText: label }).click()
  // 役割切替のプロンプト（氏名）が出る場合は Enter
  for (let i = 0; i < 3; i++) {
    const p = await panel(page)
    if (!p) break
    await page.keyboard.press('Enter'); await sleep(30)
  }
  await page.locator('.gridwrap').focus()
}
export async function goto(page, id) {
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill(id)
  await page.keyboard.press('Enter')
}
export async function cursor(page) { return (await page.getByTestId('cursor').textContent()) ?? '' }
export async function mode(page) { return (await page.getByTestId('mode').textContent()) ?? '' }
export async function toCol(page, label) {
  await page.keyboard.press('Home')
  for (let i = 0; i < 60; i++) {
    if ((await cursor(page)).includes(label)) return true
    await page.keyboard.press('ArrowRight')
  }
  return false
}
export async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => {}) }
export function save(name, data) { fs.writeFileSync(path.join(R3, name), JSON.stringify(data, null, 2)) }
export async function ws(page) { return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), LS_KEY) }
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
export async function paletteItems(page, q) {
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill(q)
  await sleep(10)
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.children[1]?.textContent ?? el.textContent))
  await page.keyboard.press('Escape')
  return items
}
export async function toastNow(page) {
  const t = page.getByTestId('toast-float'); if (await t.count()) return (await t.first().textContent()) ?? ''
  const t2 = page.getByTestId('toast'); return (await t2.count()) ? ((await t2.textContent()) ?? '') : ''
}
export async function confirmYes(page) {
  // 確認ダイアログ（既定「やめる」）で 確定側を選ぶ
  const p = await panel(page)
  if (p !== 'panel-confirm') return false
  const btns = await page.evaluate(() => [...document.querySelectorAll('[data-testid="panel-confirm"] button')].map((b) => b.textContent))
  return { p, btns }
}
export function dumpErrors(errors, tag) {
  const uniq = [...new Map(errors.map((e) => [e.type + e.text, e])).values()]
  console.log(`--- console/page errors (${tag}): ${errors.length} (uniq ${uniq.length})`)
  for (const e of uniq) console.log('  ', e.type, '|', e.where ?? '', '|', e.text.replace(/\n/g, ' ').slice(0, 300))
  return uniq
}
/** 表示中のカーソル行・セルが表の見える範囲にあるか（固定見出しの下〜下端） */
export async function cursorVisible(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.gridwrap')
    const w = wrap.getBoundingClientRect()
    const thead = wrap.querySelector('thead')
    const th = thead ? thead.getBoundingClientRect().height : 0
    const el = wrap.querySelector('td.cursor') ?? wrap.querySelector('tr.group.sel, tr.sel')
    if (!el) return { rendered: false }
    const r = el.getBoundingClientRect()
    return { rendered: true, top: Math.round(r.top), bottom: Math.round(r.bottom), wTop: Math.round(w.top + th), wBottom: Math.round(w.bottom), inView: r.top >= w.top + th - 1 && r.bottom <= w.bottom + 1, left: Math.round(r.left), right: Math.round(r.right), wLeft: Math.round(w.left), wRight: Math.round(w.right), hInView: r.left >= w.left - 1 && r.right <= w.right + 1 }
  })
}
export async function renderedRows(page) { return page.evaluate(() => document.querySelectorAll('.gridwrap tr.row').length) }
/** 300 行の BOM を作る（分類はまとまり順 / 交互） */
export function bom300(n = 300, interleave = false) {
  const cats = ['電源', '端子', '配線', '制御', '表示']
  const lines = ['分類\t部品名\t型式\tメーカ\t員数\t単位']
  for (let i = 1; i <= n; i++) {
    const c = interleave ? cats[i % cats.length] : cats[Math.floor((i - 1) / (n / cats.length))]
    lines.push(`${c}\t部品${i}\tMDL-${String(i).padStart(4, '0')}\tオムロン\t${(i % 7) + 1}\t個`)
  }
  return lines.join('\n')
}
/** ガイドで新しい案件を作る（貼り付け） */
export async function wizardCreate(page, id, text, { name = '案件' + id, due = '2027-03-31', members = '佐藤, 鈴木' } = {}) {
  await palette(page, '新しいBOM')
  await sleep(30)
  await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill(name); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill(due); await page.keyboard.press('Enter')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-buyer').fill(members); await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-paste').fill(text)
  await page.keyboard.press('Control+Enter'); await sleep(80)
  const preview = (await page.getByTestId('wizard-preview').textContent().catch(() => null)) ?? ''
  const t0 = Date.now()
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 15000 }).catch(() => {})
  const ms = Date.now() - t0
  await page.locator('.gridwrap').focus()
  return { preview: preview.slice(0, 200), ms }
}

/** 公開（Ctrl+Enter）。変更セットの理由は 2（設計起因）、Rev の選択は既定 */
export async function publish(page, reason = '2') {
  await page.keyboard.press('Control+Enter'); await sleep(60)
  for (let i = 0; i < 4; i++) {
    const p = await panel(page)
    if (!p) break
    const t = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => ''))
    if (/理由/.test(t)) await page.keyboard.press(reason)
    await page.keyboard.press('Enter'); await sleep(60)
  }
  return toastNow(page)
}
/** 列キー（data-col）までカーソルを動かす（開発サーバーのストアを読む） */
const STORE_URL = `(() => { const r = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/model/store.ts')); return r.at(-1) ?? '/src/model/store.ts' })()`
export async function appStore(page) { return page.evaluate((u) => eval(u), STORE_URL) }
export async function toColKey(page, key) {
  const cur = () => page.evaluate(async (u) => (await import(eval(u))).useStore.getState().cursorCol, STORE_URL)
  await page.keyboard.press('Home')
  for (let i = 0; i < 60; i++) { if ((await cur()) === key) return true; await page.keyboard.press('ArrowRight') }
  return false
}
export async function storeState(page, fn) { return page.evaluate(async ([f, u]) => { const s = (await import(eval(u))).useStore.getState(); return new Function('s', 'return (' + f + ')(s)')(s) }, [fn.toString(), STORE_URL]) }
export async function showColumn(page, label) {
  await page.keyboard.press('c')
  const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
  const i = cols.findIndex((c) => c.includes(label))
  if (i >= 0) { for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); if (cols[i].startsWith('○')) await page.keyboard.press('Space') }
  await page.keyboard.press('Escape')
  return i >= 0
}
