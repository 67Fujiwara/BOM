import { open, reset, gotoCell, snap, sleep } from './lib7.mjs'
const env = await open(5176); const pg = env.page
await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
await pg.keyboard.type('abc'); await sleep(50)
const st0 = await pg.evaluate(() => ({ top: document.querySelector('.gridwrap').scrollTop, win: document.scrollingElement.scrollTop, rows: document.querySelectorAll('.gridwrap tr.row').length }))
await pg.screenshot({ path: 'shots/81-before-altup.png' })
await pg.evaluate(() => { window.__ev = []; for (const t of ['keydown', 'blur', 'focusout', 'scroll']) window.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.target?.tagName ?? e.target?.constructor?.name) + ':' + (e.key ?? '') + ':' + e.defaultPrevented), true) })
await pg.keyboard.press('Alt+ArrowUp'); await sleep(150)
const st1 = await pg.evaluate(() => ({ top: document.querySelector('.gridwrap').scrollTop, win: document.scrollingElement.scrollTop, rows: document.querySelectorAll('.gridwrap tr.row').length, ev: window.__ev, visibleIds: [...document.querySelectorAll('.gridwrap tr.row')].map((tr) => tr.querySelector('td')?.textContent?.trim()).slice(0, 3) }))
await pg.screenshot({ path: 'shots/81-after-altup.png' })
console.log(JSON.stringify({ st0, st1 }))
await env.browser.close()
