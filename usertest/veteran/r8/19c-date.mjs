import { open, reset, gotoCell, snap, diffRows, sleep, state } from './lib8.mjs'
const env = await open(5176); const pg = env.page
await reset(env); await pg.keyboard.press('Alt+1'); await sleep(50)
console.log('view1 headers', await pg.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] thead th, .grid .th, [role="columnheader"]')].map((x) => x.textContent.trim()).join(' | ')))
await reset(env, { role: 'purchasing' })
for (const [view, row, col] of [[3, 'R054', '入荷予定']]) {
  const ok = await gotoCell(pg, view, row, col)
  await pg.keyboard.type('2026-12-01'); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp'); await sleep(80)
  const a = await snap(pg)
  for (const k of ['Enter', 'F2']) {
    await pg.keyboard.press(k); await sleep(80)
    const sel = await pg.evaluate(() => { const i = document.querySelector('[data-testid="cell-editor"]'); return i ? { v: i.value, s: i.selectionStart, e: i.selectionEnd } : null })
    await pg.keyboard.type('15'); await sleep(50); const s = await state(pg)
    await pg.keyboard.press('Enter'); await sleep(80); const b = await snap(pg)
    console.log(view, col, k, ok, JSON.stringify({ cursor: s.cursor, sel, afterType: s.edit, diff: diffRows(a, b), toast: b.toast.slice(0, 100) }))
    await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Control+z'); await sleep(50)
  }
}
await env.browser.close()
