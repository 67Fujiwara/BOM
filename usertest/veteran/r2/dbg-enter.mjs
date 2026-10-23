import { launch, fresh, goto, toCol, cursor, mode, sleep, proj, toastNow, shot2 } from './lib.mjs'
const { browser, page } = await launch()
await fresh(page)
// R001.. の分類
const p = await proj(page)
const cats = p.rows.slice(0, 20).map((r) => r.id + ':' + r.category).join(' ')
console.log(cats)
await goto(page, 'R001'); await toCol(page, '部品名')
const trace = []
for (let i = 0; i < 12; i++) {
  const c0 = await cursor(page)
  await page.keyboard.press('Enter'); const m1 = await mode(page)
  await page.keyboard.press('Control+a'); await page.keyboard.type('品' + i); await page.keyboard.press('Enter')
  trace.push(`${c0} [${m1}] → ${await cursor(page)} ${(await toastNow(page)).slice(0, 30)}`)
}
console.log(trace.join('\n'))
console.log('groups collapsed:', await page.evaluate(async () => (await import('/src/model/store.ts')).useStore.getState().collapsed))
await shot2(page, 'dbg-enter')
await browser.close()
