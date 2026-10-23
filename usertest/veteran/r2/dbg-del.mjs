import { launch, fresh, setRole, goto, sleep, row, toastNow, ws, cursor } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await page.keyboard.press('Control+s')
{ const w = await ws(page); const rr = w.projects[0].rows.find((x) => x.id === 'R001'); rr.status = 'ordered'; rr.ordered = true; await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w)); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus() }
await page.keyboard.press('1'); await goto(page, 'R001'); console.log(await cursor(page))
await page.evaluate(() => { window.__k = []; window.addEventListener('keydown', (e) => window.__k.push(e.key + ':' + e.shiftKey + ':' + e.defaultPrevented)) })
await page.keyboard.press('Shift+Delete'); await sleep(50)
console.log(await page.evaluate(() => window.__k), JSON.stringify(await toastNow(page)), await page.evaluate(async () => { const m = await import('/src/model/store.ts'); return m.useStore.getState().toast }))
await goto(page, 'R005'); await page.keyboard.press('Shift+Delete'); await sleep(50)
console.log(JSON.stringify(await toastNow(page)), (await row(page, 'R005')).status)
await browser.close()
