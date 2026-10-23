// ラウンド8: 保存容量がほぼ一杯のときの「読み込み前に戻す」（退避からの復元）と JSON 読み込み。
// 断ったときに退避の一覧・いまの内容が前のままか。読み込んだときに「置き換える前の内容は退避」の約束が守られるか
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib8.mjs'
const URL = `http://localhost:${process.env.PORT ?? 5176}/`
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1000)) }
const toast = () => page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
const panelText = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null)
const backups = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? '[]').map((b) => `${b.reason}:${b.raw.length}:${(/"currentProjectId":"([^"]+)"/.exec(b.raw) ?? [])[1]}`) } catch { return 'unreadable' } })
const main = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, projects: w.projects.map((x) => x.id), r010: p.rows.find((r) => r.id === 'R010')?.working?.name ?? p.rows.find((r) => r.id === 'R010')?.name } })
const used = () => page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) ?? '').length } return n })
async function pal(q) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await sleep(80); await page.keyboard.press('Enter'); await sleep(150) }
async function importJson(text) {
  await pal('JSON を読み込む')
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(150)
  const confirm = await panelText()
  await page.keyboard.press('2'); await sleep(50); if (await panelText()) { await page.keyboard.press('Enter'); await sleep(300) }
  const second = await panelText()
  if (second) { await page.keyboard.press('Escape'); await sleep(100) }
  return { confirm: confirm?.slice(0, 120), second, toast: await toast() }
}
async function restore() {
  await pal('読み込み前に戻す'); const p = await panelText()
  await page.keyboard.press('2'); await sleep(50); if (await panelText()) { await page.keyboard.press('Enter'); await sleep(300) }
  const second = await panelText(); if (second) { await page.keyboard.press('Escape'); await sleep(100) }
  return { panel: p?.slice(0, 120), second, toast: await toast() }
}
/** 同じオリジンの別のデータで空きを free 文字ほどまで詰める */
async function fillTo(free) {
  return page.evaluate((free) => {
    localStorage.removeItem('other-app-cache')
    let lo = 0, hi = 6_000_000
    while (hi - lo > 2000) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } }
    const cap = lo
    const n = Math.max(0, cap - free)
    try { localStorage.setItem('other-app-cache', 'y'.repeat(n)) } catch (e) { return 'fail ' + e }
    return { capBefore: cap, filled: n }
  }, free)
}
async function editR010(text) {
  await page.keyboard.press('Alt+1'); await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R010'); await page.keyboard.press('Enter')
  await page.keyboard.press('Home'); for (let i = 0; i < 30 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith('部品名'); i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(text); await page.keyboard.press('Enter'); await sleep(150)
}
async function fresh() {
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(URL)
  await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); await sleep(50)
}
await fresh()
const base = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
function big(id, noteLen) { const w = structuredClone(base); const p = w.projects[0]; p.id = id; p.name = '大型案件 ' + id; w.currentProjectId = id; for (let i = 0; i < 160; i++) { const r = structuredClone(p.rows[i % 70]); r.id = 'Z' + String(i).padStart(3, '0'); r.ref = 'Z' + i; p.rows.push(r) } p.rows.forEach((r, i) => { r.note = (id + ' ' + i + ' ').padEnd(noteLen, 'x') }); return JSON.stringify(w) }
function sized(id, target) { let lo = 100, hi = 20000; while (hi - lo > 5) { const m = (lo + hi) >> 1; if (big(id, m).length < target) lo = m; else hi = m } return big(id, lo) }
const PT = sized('P-T', 200000), PA = sized('P-A', 2000000), PS = sized('P-S', 120000)


for (const free of [300000]) {
  // R3: P-A（2M）→ 小さい P-S を読み込む（退避 P-A）→ 空きを詰める →「読み込み前に戻す」（P-A は入らないので断るはず）
  await fresh(); await importJson(PA); await page.evaluate(() => localStorage.removeItem('bom-pro.workspace.backup'))
  await importJson(PS)
  const f = await fillTo(free)
  const before = { main: await main(), backups: await backups() }
  const r = await restore()
  await page.reload(); await page.waitForSelector('[data-testid="grid"]')
  log({ case: `R3 空き ${free} 文字で大きい退避（P-A）へ「読み込み前に戻す」`, fill: f, before, result: r, after: { main: await main(), backups: await backups() } })
}
log({ errs: errs.slice(0, 8) })
saveJson('17b-storage-restore-big.json', out); await browser.close()
