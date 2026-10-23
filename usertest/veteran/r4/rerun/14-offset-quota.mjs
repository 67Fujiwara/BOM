// V2-21 の残り（前倒し日数の範囲）と、容量（大きいワークスペース＋退避で 5MB を超えるとき）
import { launch, fresh, goto, toColKey, showColumn, sleep, save, proj, panel, closeAll, palette, toastNow, ws, mode, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
await showColumn(page, '前倒し')
const res = {}
for (const v of ['-10', '400', '-400', '365', '3.5']) {
  await goto(page, 'R030'); if (!(await toColKey(page, 'needOffset'))) { res.err = 'no col'; break }
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(20)
  const m = await mode(page); const err = await page.getByTestId('edit-error').textContent().catch(() => null)
  await closeAll(page)
  const r = (await proj(page)).rows.find((x) => x.id === 'R030')
  res[v] = { mode: m, err: err?.slice(0, 60), stored: r.working?.needOffset ?? r.needOffset }
}
out.needOffset = res
console.log('needOffset', JSON.stringify(res))
// 容量: 約 2.4MB のワークスペース → 同じくらいの JSON を読み込む（退避 2.4MB ＋ 本体 2.4MB）
await fresh(page)
await page.keyboard.press('Control+s')
const w = await ws(page)
const p0 = w.projects[0]
const big = structuredClone(w); big.projects = []
for (let i = 0; i < 20; i++) { const p = structuredClone(p0); p.id = 'P-BIG-' + i; big.projects.push(p) }
const txt = JSON.stringify(big)
const okSet = await page.evaluate(([k, s]) => { try { localStorage.setItem(k, s); return true } catch (e) { return e.message } }, [LS_KEY, txt])
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
const big2 = structuredClone(big); big2.projects.forEach((p) => (p.name += '（新）'))
await palette(page, 'JSON を読み込む'); await sleep(40)
await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(big2))
await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(80)
if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(300) }
const t1 = await toastNow(page)
await closeAll(page); await palette(page, '読み込み前に戻す'); await sleep(60); const restoreMsg = (await toastNow(page)).slice(0, 120) + ' / panel:' + (await panel(page)); await closeAll(page)
const sizes = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])))
const savedNew = await page.evaluate((k) => (localStorage.getItem(k) ?? '').includes('（新）'), LS_KEY)
await goto(page, 'R030'); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('容量'); await page.keyboard.press('Enter'); await sleep(80)
const t2 = await toastNow(page)
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(100)
const after = await page.evaluate((k) => { const s = localStorage.getItem(k) ?? ''; return { hasNew: s.includes('（新）'), hasEdit: s.includes('容量') } }, LS_KEY)
out.quota = { restoreMsg, bytes: txt.length, initialSet: okSet, importToast: t1.slice(0, 200), sizes, savedNew, editToast: t2.slice(0, 120), afterReload: after }
console.log('quota', JSON.stringify(out.quota))
save('14-offset-quota.json', out)
await browser.close()
