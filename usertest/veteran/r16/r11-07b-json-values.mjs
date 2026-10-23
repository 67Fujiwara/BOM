import { open, reset, sleep, gotoCell, state } from './lib16.mjs'
const env = await open(5176); const page = env.page
await reset(env)
const w = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2')))
const p = w.projects[0]; p.rows[4].qtyNeeded = -5; p.rows[5].qtyNeeded = 'Infinity'; delete p.rows[6].qtyNeeded; p.rows[7].needDateFixed = '2026-02-30'; p.rows[8].needDateFixed = '明日'
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await page.keyboard.press('Enter'); await sleep(150)
await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(w))
await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('2'); await sleep(100); await page.keyboard.press('Enter'); await sleep(400)
console.log(await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent))
const cells = await page.evaluate(() => ['R005', 'R006', 'R007', 'R008', 'R009'].map((id) => { const tr = document.querySelector(`tr[data-row-id="${id}"]`); if (!tr) return id + ' -'; const g = (c) => tr.querySelector(`[data-col="${c}"]`)?.textContent ?? '?'; return `${id} 必要数=${g('qtyNeeded')} 固定=${g('needDateFixed')} 必要日=${g('needDate')} 期限=${g('due')} 金額=${g('amount')}` }))
console.log(cells.join('\n'))
await page.keyboard.press('Alt+4'); await sleep(100)
for (const id of ['R005', 'R008', 'R009']) { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(id); await page.keyboard.press('Enter'); await sleep(100); console.log(id, (await state(page)).view, await page.evaluate(() => document.querySelector('.statusbar, [data-testid="statusbar"], footer')?.textContent?.slice(0, 220))) }
console.log(env.errs); await env.browser.close()
