import { open, reset, sleep, gotoCell, state } from './lib10.mjs'
const env = await open(5176); const page = env.page
await reset(env)
const w = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
const p = w.projects[0]; p.rows[3].qtyNeeded = '12'; p.rows[4].qtyNeeded = -5; p.rows[5].qtyNeeded = 'Infinity'; p.rows[6].qtyNeeded = null; p.rows[7].needDateFixed = '2026-02-30'; p.rows[8].needDateFixed = '明日'; p.rows[9].needDateFixed = 20261201
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150)
await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(w))
await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('2'); await sleep(100); await page.keyboard.press('Enter'); await sleep(400)
const after = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects[0]; return p.rows.slice(3, 10).map((r) => [r.id, JSON.stringify(r.qtyNeeded), JSON.stringify(r.needDateFixed)]) })
console.log(JSON.stringify(after))
// 4 にいくつ出るか・各行の表示
await page.locator('.gridwrap').focus(); await page.keyboard.press('Alt+4'); await sleep(100)
const v4 = await page.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] [data-row-id]')].map((e) => e.dataset.rowId).filter((x, i, a) => a.indexOf(x) === i).slice(0, 14))
console.log('view4', v4.join(','))
for (const [id, col] of [['R004', '必要数'], ['R005', '必要数'], ['R006', '必要数'], ['R008', '必要日'], ['R009', '必要日'], ['R010', '必要日']]) { await gotoCell(page, 1, id, col); const t = await page.evaluate(() => document.querySelector('.cell.cursor, [aria-selected="true"]')?.textContent ?? ''); const sb = await page.evaluate(() => document.querySelector('[data-testid="statusbar"]')?.textContent?.slice(0, 200) ?? ''); console.log(id, col, JSON.stringify(t), sb.slice(0, 160)) }
console.log(env.errs); await env.browser.close()
