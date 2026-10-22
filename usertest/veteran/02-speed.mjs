import { launch, fresh, goto, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
// --- j x200
await page.keyboard.press('ArrowDown')
let t0 = Date.now()
for (let i = 0; i < 200; i++) await page.keyboard.press('j', { delay: 0 })
out.j200 = { ms: Date.now() - t0, cursor: await cursor(page), mode: await mode(page), scrollTop: await page.evaluate(() => document.querySelector('.gridwrap').scrollTop), cursorVisible: await page.locator('td.cursor').isVisible().catch(() => false) }
console.log('j200', out.j200)
// in-page latency j with 80 rows
await page.keyboard.press('Control+ArrowUp')
out.latency80 = await page.evaluate(async () => {
  const res = []
  const c = () => document.querySelector('[data-testid="cursor"]').textContent
  for (let i = 0; i < 40; i++) {
    const b = c(); const t = performance.now()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    await new Promise((r) => { const chk = () => (c() !== b ? r() : requestAnimationFrame(chk)); requestAnimationFrame(chk) })
    res.push(performance.now() - t)
  }
  return { median: res.sort((a, b) => a - b)[20].toFixed(1), max: Math.max(...res).toFixed(1) }
})
console.log('latency80', out.latency80)
// --- Enter -> char -> Enter x50 (overwrite name cells with 'z')
await goto(page, 'R001')
t0 = Date.now()
for (let i = 0; i < 50; i++) { await page.keyboard.press('Enter'); await page.keyboard.type('z' + i); await page.keyboard.press('Enter') }
const after = { ms: Date.now() - t0, cursor: await cursor(page), mode: await mode(page) }
const ws = await state(page)
const p = ws.projects[0]
const names = p.rows.slice(0, 50).map((r) => (r.working?.name ?? r.name))
after.okCount = names.filter((n, i) => n === 'z' + i).length
after.sample = names.slice(0, 5)
out.enter50 = after
console.log('enter50', after)
await shot(page, '02-enter50')
// --- Ctrl+Z / Ctrl+Shift+Z alternately x50
const snapBefore = JSON.stringify((await state(page)).projects[0].rows.slice(0, 50).map((r) => r.working?.name ?? r.name))
t0 = Date.now()
for (let i = 0; i < 50; i++) { await page.keyboard.press('Control+z'); await page.keyboard.press('Control+Shift+z') }
const snapAfter = JSON.stringify((await state(page)).projects[0].rows.slice(0, 50).map((r) => r.working?.name ?? r.name))
out.undoRedo50 = { ms: Date.now() - t0, same: snapBefore === snapAfter, mode: await mode(page), cursor: await cursor(page), toast: await toast(page) }
console.log('undoRedo50', out.undoRedo50)
// undo 50 straight -> all names restored?
for (let i = 0; i < 50; i++) await page.keyboard.press('Control+z')
const ws2 = await state(page)
out.undo50 = { restored: ws2.projects[0].rows.slice(0, 50).filter((r) => !r.working).length, events: ws2.projects[0].events.length }
console.log('undo50', out.undo50)
// --- 1..9 x100
t0 = Date.now()
for (let i = 0; i < 100; i++) for (const k of '123456789') await page.keyboard.press(k)
out.views900 = { ms: Date.now() - t0, view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid), cursor: await cursor(page), rows: await page.getByTestId('row').count() }
console.log('views900', out.views900)
// --- Space toggle x50 on an open row (detail)
await page.keyboard.press('1')
await goto(page, 'R020')
t0 = Date.now()
for (let i = 0; i < 50; i++) await page.keyboard.press('Space')
out.space50 = { ms: Date.now() - t0, detailOpen: await page.getByTestId('detail').count(), cursor: await cursor(page) }
console.log('space50', out.space50)
// --- rapid typing into edit: Enter then 200 chars then Esc
await page.keyboard.press('Enter')
t0 = Date.now()
await page.keyboard.type('a'.repeat(200))
out.type200 = { ms: Date.now() - t0, len: (await page.getByTestId('cell-editor').inputValue()).length }
await page.keyboard.press('Escape')
console.log('type200', out.type200)
// --- Shift+Enter x30 (insert rows) then Shift+Delete x30
await goto(page, 'R080')
t0 = Date.now()
for (let i = 0; i < 30; i++) { await page.keyboard.press('Shift+Enter'); await page.keyboard.type('n' + i); await page.keyboard.press('Escape') }
out.insert30 = { ms: Date.now() - t0, rows: (await state(page)).projects[0].rows.length, cursor: await cursor(page), mode: await mode(page) }
console.log('insert30', out.insert30)
save('02-speed.json', out)
dumpErrors(errors, 'speed')
await browser.close()
