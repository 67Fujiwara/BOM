// ラウンド10: 保存容量がほぼ一杯のとき。①大きい JSON（5,000 行・約 2.5MB）を空き 2MB で読み込む ②空き 0 で編集 → 知らせ → リロード ③空き 0 で 2,500 行の貼り付け
import { open, reset, sleep, logger, state, gotoCell } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const page = env.page; const log = logger(`10-storage-full-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const panelText = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 300) ?? null)
const toast = () => page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 260) ?? '')
const main = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, rows: p.rows.length, r010: p.rows.find((r) => r.id === 'R010')?.working?.name ?? p.rows.find((r) => r.id === 'R010')?.name, backups: (() => { try { return JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? '[]').map((b) => b.reason + ':' + b.raw.length) } catch { return 'x' } })() } })
const fillTo = (free) => page.evaluate((free) => { localStorage.removeItem('other-app-cache'); let lo = 0, hi = 6_000_000; while (hi - lo > 2000) { const m = (lo + hi) >> 1; try { localStorage.setItem('probe', 'x'.repeat(m)); localStorage.removeItem('probe'); lo = m } catch { hi = m } } const n = Math.max(0, lo - free); try { localStorage.setItem('other-app-cache', 'y'.repeat(n)) } catch (e) { return 'fail' } return { cap: lo, filled: n } }, free)
async function pal(q) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await sleep(80); await page.keyboard.press('Enter'); await sleep(150) }
await reset(env)
const base = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
const bigW = structuredClone(base); { const p = bigW.projects[0]; p.id = 'P-BIG'; bigW.currentProjectId = 'P-BIG'; const b = p.rows.filter((r) => r.status === 'draft' || r.status === 'quoting'); for (let i = 0; p.rows.length < 5000; i++) { const r = structuredClone(b[i % b.length]); r.id = 'Y' + String(i).padStart(5, '0'); p.rows.push(r) } }
const BIG = JSON.stringify(bigW)
// ①
{
  await reset(env); const f = await fillTo(2_000_000); const before = await main()
  await pal('JSON を読み込む')
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, BIG)
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(300)
  const c1 = await panelText(); await page.keyboard.press('2'); await sleep(500); const c2 = await panelText(); const t2 = await toast()
  let c3 = null; if (c2) { await page.keyboard.press('2'); await sleep(500); c3 = await panelText(); if (c3) await page.keyboard.press('Escape') }
  await sleep(300); const after = await main(); const shown = await page.evaluate(() => document.querySelectorAll('[data-testid="grid"] tr[data-row-id]').length)
  const t3 = await toast()
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(300); const afterReload = await main(); const t4 = await toast()
  log({ case: '① 空き 2MB で 2.5MB の JSON を読み込む', size: BIG.length, fill: f, before, c1: c1?.slice(0, 120), c2, t2, c3, t3, after, afterReload, t4 })
}
// ② 空き 0 で編集 → リロード
{
  await reset(env); await gotoCell(page, 1, 'R010', '部品名'); const f = await fillTo(0)
  await page.keyboard.type('FULL-EDIT'); await page.keyboard.press('Enter'); await sleep(300); const t1 = await toast()
  const stored = await main()
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(300); const afterReload = await main(); const t2 = await toast()
  log({ case: '② 空き 0 で R010 部品名を編集 → リロード', fill: f, t1, stored, afterReload, t2 })
}
// ③ 空き 0 で 300 行の貼り付け
{
  await reset(env); await gotoCell(page, 1, 'R080', '部品名'); const f = await fillTo(0)
  await page.evaluate((t) => navigator.clipboard.writeText(t), Array.from({ length: 300 }, (_, i) => `貼付${i}\tPM-${i}\tオムロン\t1`).join('\n'))
  await page.keyboard.press('Control+v'); await sleep(800); const t1 = await toast(); const shown = await page.evaluate(() => document.querySelector('[data-testid="cursor"]')?.textContent)
  const stored = await main()
  log({ case: '③ 空き 0 で 300 行を貼り付け', fill: f, t1, storedRows: stored.rows, cursor: shown })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
