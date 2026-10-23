import { open, reset, gotoCell, snap, diffRows, sleep, state } from './lib8.mjs'
const env = await open(5176); const pg = env.page
for (const col of ['必要日(固定)', '必要数', '入数', '必要日(前倒し)']) {
  await reset(env); await gotoCell(pg, 1, 'R040', col)
  const a = await snap(pg)
  if (col === '必要日(固定)') { await pg.keyboard.type('2026-12-01'); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp'); await sleep(80) }
  const b = await snap(pg)
  await pg.keyboard.press('Enter'); await sleep(80)
  const sel = await pg.evaluate(() => { const i = document.querySelector('[data-testid="cell-editor"]'); return i ? { v: i.value, s: i.selectionStart, e: i.selectionEnd, type: i.type, active: document.activeElement === i } : null })
  await pg.keyboard.type('7'); await sleep(50)
  const s = await state(pg)
  await pg.keyboard.press('Escape')
  console.log(col, JSON.stringify({ setupDiff: diffRows(a, b), sel, afterType: s.edit }))
}
await env.browser.close()
