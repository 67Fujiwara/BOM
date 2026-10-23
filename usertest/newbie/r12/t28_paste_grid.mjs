// Excel からコピーして表に Ctrl+V（購買 6 の 単価/納期/MOQ、設計の 部品名/型式/メーカ、回路記号の列に 1 列）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole, sleep, diff } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t28_paste_grid')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}`).join(' ')
const clip = (t) => page.evaluate((t) => navigator.clipboard.writeText(t), t)
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
const snap = async () => JSON.parse(JSON.stringify((await proj(page)).rows))
const changes = async (r0) => { const p = await proj(page); const ch = []; for (const r of p.rows) { const o = r0.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } } return ch.join(' | ') || '(なし)' }
await fresh(page)
await step('purchasing 6 paste 3x3', async () => {
  await page.keyboard.press('Control+Enter'); await sleep(150); for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press(i === 0 ? '2' : 'Enter'); await sleep(150) }
  await setRole(page, 'purchasing'); await runPalette(page, '概算見積を依頼'); await page.keyboard.press('Enter'); await sleep(250)
  await page.keyboard.press('6'); await sleep(150); await sel(page, 'R076'); for (let i = 0; i < 20; i++) { if (/単価/.test(await T.cursor(page))) break; await page.keyboard.press('ArrowRight') }
  await clip('1,200\t14\t1\n800\t7日\t10\n¥450\t即納\t100\n')
  await page.keyboard.press('Control+v'); await sleep(300)
  log('  toast', await T.toast(page), '| panel', (await T.panelText(page))?.slice(0, 160))
  for (const id of ['R076', 'R077', 'R078', 'R079']) log('   ', id, await quotes(id))
  await shot(page, 't28_view6_paste')
  await page.keyboard.press('Control+z'); await sleep(200); log('  Ctrl+Z', await T.toast(page)); for (const id of ['R076', 'R077', 'R078']) log('   ', id, await quotes(id))
})
await step('design paste names/models/makers', async () => {
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, '部品名'); const r0 = await snap()
  await clip('近接センサ\tE2E-X5ME1 2M\tオムロン\n光電センサ\tE3Z-D61\tオムロン\n')
  await page.keyboard.press('Control+v'); await sleep(300)
  log('  toast', await T.toast(page), '| panel', (await T.panelText(page))?.slice(0, 160)); log('  changes', await changes(r0))
  await sel(page, 'R050'); await gotoCol(page, '回路記号'); const r1 = await snap()
  await clip('K1\nK2\nK3\nK4\nK5\n'); await page.keyboard.press('Control+v'); await sleep(300)
  log('  ref paste toast', await T.toast(page)); log('  changes', await changes(r1))
})
save(errors); await browser.close()
