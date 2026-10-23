import { launch, fresh, goto, toCol, sleep } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('X'); await page.keyboard.press('Enter')
const d = await page.evaluate(async () => { const m = await import('/src/model/store.ts'); const e = Object.values(m.useStore.getState().undo)[0][0]; return e.rows.map((c) => { const keys = Object.keys({ ...c.before, ...c.after }).filter((k) => JSON.stringify(c.before?.[k]) !== JSON.stringify(c.after?.[k])); return c.key + ': ' + keys.map((k) => `${k} ${JSON.stringify(c.before?.[k])}→${JSON.stringify(c.after?.[k])}`).join(', ') }) })
console.log(d.join('\n'))
await browser.close()
