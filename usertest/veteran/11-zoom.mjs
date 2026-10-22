import { launch, fresh, goto, cursor, toast, dumpErrors, shot, save, sleep } from './lib.mjs'
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
// browser zoom 150% at 1280x720 == css viewport 853x480 with dsf 1.5
const { browser, page, errors } = await launch({ viewport: { width: 853, height: 480 }, dsf: 1.5 })
await fresh(page)
const hdr = await page.evaluate(() => { const h = document.querySelector('[data-testid="header"]'); const r = h.getBoundingClientRect(); return [...h.children].map((c) => ({ cls: c.className.split(' ')[0], text: c.textContent.slice(0, 20), right: Math.round(c.getBoundingClientRect().right), clipped: c.getBoundingClientRect().right > r.right + 1 })) })
log({ case: 'zoom150 header children', clipped: hdr.filter((c) => c.clipped), all: hdr })
const st = await page.evaluate(() => { const h = document.querySelector('[data-testid="status"]'); return { scrollW: h.scrollWidth, clientW: h.clientWidth, hints: [...document.querySelectorAll('.status .hints span')].map((s) => s.textContent + '@' + Math.round(s.getBoundingClientRect().right)), overflow: [...h.children].some((c) => c.getBoundingClientRect().right > h.getBoundingClientRect().right + 1) } })
log({ case: 'zoom150 status', st })
await shot(page, '11-zoom150')
await page.keyboard.press('ArrowDown')
await page.keyboard.press('Control+k'); await sleep(50); const dlg = await page.evaluate(() => { const d = document.querySelector('.dialog'); const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, winH: innerHeight, listScroll: d.querySelector('.list')?.scrollHeight } }); log({ case: 'zoom150 palette', dlg }); await shot(page, '11-zoom150-palette'); await page.keyboard.press('Escape')
await page.keyboard.press('?'); await sleep(50); const hd = await page.evaluate(() => { const d = document.querySelector('.dialog'); const b = d.querySelector('.body'); return { bottom: d.getBoundingClientRect().bottom, winH: innerHeight, bodyScrollable: b.scrollHeight > b.clientHeight, cols: getComputedStyle(document.querySelector('.help-cols')).columnCount } }); log({ case: 'zoom150 help', hd }); await shot(page, '11-zoom150-help'); await page.keyboard.press('Escape')
await goto(page, 'R022'); await page.keyboard.press('Space'); await sleep(50)
const det = await page.evaluate(() => { const d = document.querySelector('[data-testid="detail"]'); const q = d.querySelector('table.quotes'); return { detailW: d.clientWidth, quotesW: q.scrollWidth, overflow: q.scrollWidth > d.clientWidth, gridScrollW: document.querySelector('.gridwrap').scrollWidth, gridClientW: document.querySelector('.gridwrap').clientWidth } })
log({ case: 'zoom150 detail', det }); await shot(page, '11-zoom150-detail')
// side nav visible? project list etc
const side = await page.evaluate(() => { const s = document.querySelector('.side'); return { scrollH: s.scrollHeight, clientH: s.clientHeight } }); log({ case: 'zoom150 side', side })
// wizard at this size
await page.keyboard.press('Escape'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter'); await sleep(50)
const wz = await page.evaluate(() => { const d = document.querySelector('.dialog'); return { bottom: d.getBoundingClientRect().bottom, winH: innerHeight, stepsW: document.querySelector('.wizard .steps').scrollWidth, stepsClient: document.querySelector('.wizard .steps').clientWidth } }); log({ case: 'zoom150 wizard', wz }); await shot(page, '11-zoom150-wizard')
// settings panel (wide, 23 rows)
for (let i = 0; i < 3; i++) await page.keyboard.press('Escape')
await page.locator('.role button', { hasText: 'PM' }).click(); await page.locator('.gridwrap').focus()
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 22; i++) await page.keyboard.press('ArrowDown')
const sp = await page.evaluate(() => { const sel = document.querySelector('[data-testid="settings"] .opt[aria-selected="true"]'); const b = document.querySelector('.dialog .body'); const r = sel.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { selVisible: r.top >= br.top && r.bottom <= br.bottom, selTop: r.top, bodyBottom: br.bottom } }); log({ case: 'zoom150 settings last item visible after ArrowDown x22', sp }); await shot(page, '11-zoom150-settings')
await browser.close()
// also 1440x900: settings panel last row visible? columns panel 37 items
const b2 = await launch(); await fresh(b2.page); await b2.page.keyboard.press('c'); for (let i = 0; i < 36; i++) await b2.page.keyboard.press('ArrowDown')
const cp = await b2.page.evaluate(() => { const sel = document.querySelector('[data-testid="columns"] .opt[aria-selected="true"]'); const b = document.querySelector('.dialog .body'); const r = sel.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { selVisible: r.top >= br.top && r.bottom <= br.bottom, text: sel.textContent } }); log({ case: '1440 columns panel last item visible after ArrowDown x36', cp }); await shot(b2.page, '11-columns-panel-bottom')
await b2.page.keyboard.press('Escape'); await b2.page.keyboard.press('Control+k'); for (let i = 0; i < 33; i++) await b2.page.keyboard.press('ArrowDown')
const pp = await b2.page.evaluate(() => { const sel = document.querySelector('[data-testid="palette-list"] .item[aria-selected="true"]'); const b = document.querySelector('.dialog .list'); const r = sel.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { selVisible: r.top >= br.top && r.bottom <= br.bottom, text: sel.textContent.slice(0, 30) } }); log({ case: 'palette ArrowDown x33 selection visible', pp }); await shot(b2.page, '11-palette-bottom')
save('11-zoom.json', out)
dumpErrors(errors, 'zoom')
await b2.browser.close()
