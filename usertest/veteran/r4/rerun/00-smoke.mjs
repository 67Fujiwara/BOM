import { launch, fresh, wizardCreate, bom300, sleep, proj, cursor, toastNow, dumpErrors, renderedRows, cursorVisible, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
const r = await wizardCreate(page, 'P-300', bom300())
const p = await proj(page)
console.log(r, p.id, p.rows.length, await cursor(page), (await toastNow(page)).slice(0, 100), 'rendered', await renderedRows(page), await cursorVisible(page))
await shot(page, '00-smoke-300')
dumpErrors(errors, 'smoke')
await browser.close()
