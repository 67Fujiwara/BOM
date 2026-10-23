// 設計が取消（作業中）にした行は購買に「作業中●」と見えるが、正式見積依頼・発注の対象から外れるか
import { launch, fresh, T, makeLog, shot, sel, row, proj, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t17_removal_leak')
const st = (id) => row(page, id).then((r) => `${r.id}:${r.status}${r.removal ? ' removal=' + JSON.stringify(r.removal) : ''} ordered=${r.ordered}`)
await fresh(page); await page.keyboard.press('1')
const p0 = await proj(page)
const sel1 = p0.rows.filter((r) => r.status === 'selected').map((r) => r.id); const fq = p0.rows.filter((r) => r.status === 'formalQuoted').map((r) => r.id)
log('selected rows', sel1.join(','), '| formalQuoted', fq.join(','))
// 設計: 選定済の 1 行と正式見積済の 1 行を取消（作業中）
for (const id of [sel1[0], fq[0]]) { await sel(page, id); await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(80); log('design Shift+Delete', id, '->', await T.toast(page)) }
await setRole(page, 'purchasing'); await page.keyboard.press('1')
for (const id of [sel1[0], fq[0]]) { await sel(page, id); log('purchasing sees', (await page.locator(`[data-row-id="${id}"]`).innerText()).replace(/\s+/g, ' ').slice(0, 140)) }
await runPalette(page, '正式見積を依頼'); log('formal confirm', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('2'); await page.waitForTimeout(250)
log('formal ->', await T.toast(page), '|', await st(sel1[0]))
await page.keyboard.press('3'); await sel(page, fq[0]); await page.keyboard.press('o'); await page.waitForTimeout(100); log('o on', fq[0], '->', await T.toast(page), (await T.panelText(page))?.slice(0, 120), '|', await st(fq[0]))
if (await T.panel(page)) { await page.keyboard.press('2'); await page.waitForTimeout(100); log('  2 ->', await T.toast(page), await st(fq[0])) }
await setRole(page, 'design'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('  pub panel', (await T.panelText(page))?.slice(0, 120)); await page.keyboard.press(i === 0 ? '2' : 'Enter'); await page.waitForTimeout(120) }
log('design publish ->', await T.toast(page), '|', await st(sel1[0]), '|', await st(fq[0]))
await shot(page, 't17_removal_leak')
save(errors); await browser.close()
