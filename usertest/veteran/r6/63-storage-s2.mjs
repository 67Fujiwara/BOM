// ラウンド6: V6（容量ぎりぎりの JSON 読み込みで「読み込み前」の退避が消える）を証跡つきで取り直す。
// 現 P-A（2.3M 文字・編集 1 か所）→ P-B（3.2M 文字）を読み込む。確認文・完了の通知・退避の一覧・「読み込み前に戻す」の結果を記録しスクリーンショット
// あわせて V5-08（退避の書き出しのファイル名の時刻）を Asia/Tokyo で確かめる
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { saveJson } from './lib6.mjs'
const URL = `http://localhost:${process.env.PORT ?? 5173}/`
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const toast = () => page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
const panelText = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null)
const backups = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? '[]').map((b) => `${b.reason}:${b.raw.length}:${(/"currentProjectId":"([^"]+)"/.exec(b.raw) ?? [])[1]}`) } catch { return 'unreadable' } })
const main = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, r010: p.rows.find((r) => r.id === 'R010')?.working?.name ?? p.rows.find((r) => r.id === 'R010')?.name } })
async function pal(q) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await sleep(80); await page.keyboard.press('Enter'); await sleep(150) }
async function importJson(text) {
  await pal('JSON を読み込む')
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(150)
  const confirm = await panelText()
  await page.keyboard.press('2'); await sleep(50); if (await panelText()) { await page.keyboard.press('Enter'); await sleep(200) }
  const second = await panelText()
  if (second) { await page.keyboard.press('Escape'); await sleep(100) }
  return { confirm, second, toast: await toast() }
}
await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} }); await page.goto(URL)
await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
const base = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
function big(id, noteLen) { const w = structuredClone(base); const p = w.projects[0]; p.id = id; p.name = '大型案件 ' + id; w.currentProjectId = id; for (let i = 0; i < 160; i++) { const r = structuredClone(p.rows[i % 70]); r.id = 'Z' + String(i).padStart(3, '0'); r.ref = 'Z' + i; p.rows.push(r) } p.rows.forEach((r, i) => { r.note = (id + ' ' + i + ' ').padEnd(noteLen, 'x') }); return JSON.stringify(w) }
function sized(id, target) { let lo = 100, hi = 20000; while (hi - lo > 5) { const m = (lo + hi) >> 1; if (big(id, m).length < target) lo = m; else hi = m } return big(id, lo) }
// V5-08: 退避の書き出しのファイル名
{
  await importJson(sized('P-T', 200000))
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await pal('退避したデータを書き出す'); await sleep(100)
  if (await panelText()) { await page.keyboard.press('Enter'); await sleep(100) }
  const d = await dl
  log({ case: 'V5-08 書き出しのファイル名（Asia/Tokyo）', now: await page.evaluate(() => new Date().toString()), file: d?.suggestedFilename() ?? null, toast: await toast() })
}
await page.evaluate(() => { localStorage.removeItem('bom-pro.workspace.backup') })
const A = sized('P-A', 2300000), B = sized('P-B', 3200000)
let r = await importJson(A)
log({ step: 'P-A を読み込む', len: A.length, ...r, backups: await backups(), main: await main() })
await page.keyboard.press('1'); await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R010'); await page.keyboard.press('Enter')
await page.keyboard.press('Home'); for (let i = 0; i < 30 && !((await page.getByTestId('cursor').textContent()) ?? '').endsWith('部品名'); i++) await page.keyboard.press('ArrowRight')
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('P-A important edit'); await page.keyboard.press('Enter'); await sleep(100)
log({ step: 'P-A の R010 を編集', main: await main(), backups: await backups() })
r = await importJson(B)
await page.screenshot({ path: '/home/user/BOM/usertest/veteran/r6/shots/63-import-PB.png' })
log({ step: 'P-B を読み込む', len: B.length, ...r, backups: await backups(), main: await main() })
await pal('読み込み前に戻す')
const p1 = await panelText(); const t1 = await toast()
await page.screenshot({ path: '/home/user/BOM/usertest/veteran/r6/shots/63-restore.png' })
log({ step: '「読み込み前に戻す」', panel: p1, toast: t1 })
if (p1) { await page.keyboard.press('Enter'); await sleep(200); log({ step: '選ぶ', panel: await panelText(), toast: await toast() }); if (await panelText()) { await page.keyboard.press('2'); await sleep(50); await page.keyboard.press('Enter'); await sleep(300) } }
log({ step: '結果', main: await main(), toast: await toast(), backups: await backups() })
log({ errs })
saveJson('63-storage-s2.json', out)
await browser.close()
