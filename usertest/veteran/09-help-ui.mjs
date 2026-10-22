import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
import { parseKeymap } from './keymap-parse.mjs'
const KM = parseKeymap()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
let { browser, page, errors } = await launch()
await fresh(page)
await page.keyboard.press('?')
const help = await page.getByTestId('help').textContent()
const fmt = (k) => k === ' ' ? 'Space' : k.replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Escape', 'Esc')
const missingLabel = KM.filter((b) => !help.includes(b.label)).map((b) => b.id)
const missingKey = KM.flatMap((b) => b.keys.filter((k) => !help.includes(fmt(k))).map((k) => b.id + ':' + k))
log({ case: 'help coverage', bindings: KM.length, missingLabel, missingKey })
// commands in registry STATIC/palette-only (no key) — are they in help? e.g. Ctrl+. etc fine. Also panel-internal keys: Alt+←, Ctrl+Enter(import), J (issue), Tab (issue proposal), < >
const extras = ['Alt+←', 'Ctrl+Enter', 'J', 'Tab', 'Delete', '1〜9', 'y', 'Shift+Y']
log({ case: 'help mentions panel keys', present: Object.fromEntries(extras.map((e) => [e, help.includes(e)])) })
// does help list Ctrl+Y as redo? and duplicates: '右のセル' twice (→ and Tab)
log({ case: 'help label dup', dupLabels: [...new Set(KM.map((b) => b.label).filter((l, i, a) => a.indexOf(l) !== i))] })
await page.keyboard.press('Escape')
// keys bound twice in keymap (same key, same mode)
const seen = new Map(); const conflicts = []
for (const b of KM) for (const k of b.keys) { const key = k + '|' + b.mode; if (seen.has(key)) conflicts.push(k + ': ' + seen.get(key) + ' vs ' + b.id); else seen.set(key, b.id) }
log({ case: 'keymap conflicts', conflicts })
// palette: every STATIC command reachable; list items for empty query
await page.keyboard.press('Control+k'); const items = await page.locator('[data-testid="palette-list"] .item').allTextContents(); log({ case: 'palette empty query items', n: items.length, first: items.slice(0, 3) })
// keymap ids that are not in palette for query = label
const notInPalette = []
for (const b of KM) { await page.getByTestId('palette-input').fill(b.label.slice(0, 6)); await sleep(10); const t = await page.getByTestId('palette-list').textContent(); if (!t.includes(b.label)) notInPalette.push(b.id) }
log({ case: 'keymap labels searchable in palette', notInPalette })
await page.keyboard.press('Escape')
// status bar hints accuracy
const hints = async () => (await page.locator('[data-testid="status"] .hints').textContent()) ?? ''
await goto(page, 'R076'); log({ case: 'hints design on draft R076 (no quotes)', hints: await hints(), toastOnA: (await page.keyboard.press('a'), await toast(page)) })
await goto(page, 'R020'); await toCol(page, 'ID'); log({ case: 'hints design on ID col (not editable)', hints: await hints(), toastOnEnter: (await page.keyboard.press('Enter'), await toast(page)), mode: await mode(page) })
await setRole(page, 'purchasing'); await goto(page, 'R020'); log({ case: 'hints purchasing R020', hints: await hints() })
await goto(page, 'R016'); log({ case: 'hints purchasing R016 (open issue by buyer)', hints: await hints(), status: await page.getByTestId('status').textContent() })
await setRole(page, 'pm'); await page.keyboard.press('7'); await page.keyboard.press('ArrowDown'); log({ case: 'hints PM view7', cursor: await cursor(page), hints: await hints() })
await page.keyboard.press('1'); await goto(page, 'R020'); log({ case: 'hints PM on normal row', hints: await hints() })
// Enter for PM on row in view 1 → startEdit → 権限なし; but hint says Enter 編集
// mode label while panel open
await page.keyboard.press('Control+k'); log({ case: 'mode label palette', mode: await mode(page) }); await page.keyboard.press('Escape')
await page.keyboard.press('c'); log({ case: 'mode label panel', mode: await mode(page) }); await page.keyboard.press('Escape')
// sidebar counts vs rows for each view/role
for (const role of ['design', 'purchasing', 'pm']) { await setRole(page, role); const r = {}; for (const v of '123456789') { await page.keyboard.press(v); r[v] = [(await page.locator(`[data-testid="view-${v}"] .n`).textContent()), String(await page.getByTestId('row').count())] } log({ case: 'side count vs rows ' + role, r, mismatch: Object.entries(r).filter(([, [a, b]]) => a !== b).map(([v]) => v) }) }
// hidden rows: h on R030 as purchasing; counts in view 1 vs others
await setRole(page, 'purchasing'); await page.keyboard.press('1'); await goto(page, 'R030'); await page.keyboard.press('h')
const r1 = { side1: await page.locator('[data-testid="view-1"] .n').textContent(), rows1: await page.getByTestId('row').count(), r030hidden: await page.locator('[data-row-id="R030"]').getAttribute('class') }
await page.keyboard.press('2'); r1.side2 = await page.locator('[data-testid="view-2"] .n').textContent(); r1.rows2 = await page.getByTestId('row').count(); r1.r030inView2 = await page.locator('[data-row-id="R030"]').count()
log({ case: 'hidden row counts', ...r1 })
await page.keyboard.press('1'); await goto(page, 'R030'); await page.keyboard.press('h')
// header error/warn lamp vs view 4 count (design)
await setRole(page, 'design'); await page.keyboard.press('4'); log({ case: 'lamps vs view4', lamps: await page.getByTestId('lamps').textContent(), view4: await page.locator('[data-testid="view-4"] .n').textContent(), rows: await page.getByTestId('row').count() })
// dark / compact / theme persists
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダークモード'); await page.keyboard.press('Enter'); await sleep(100)
await shot(page, '09-dark')
log({ case: 'dark', theme: await page.evaluate(() => document.documentElement.dataset.theme), bodyBg: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) })
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('コンパクト'); await page.keyboard.press('Enter'); await sleep(100)
log({ case: 'compact', density: await page.evaluate(() => document.documentElement.dataset.density), rowH: await page.evaluate(() => document.querySelector('tr.row td')?.getBoundingClientRect().height) })
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
log({ case: 'after reload', theme: await page.evaluate(() => document.documentElement.dataset.theme), density: await page.evaluate(() => document.documentElement.dataset.density) })
await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダークモード'); await page.keyboard.press('Enter'); await sleep(50)
// detail panel in dark with open row
await goto(page, 'R022'); await page.keyboard.press('Space'); await shot(page, '09-detail-light')
// contrast check of status pill / chips in dark
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダークモード'); await page.keyboard.press('Enter'); await sleep(50); await shot(page, '09-detail-dark')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ダークモード'); await page.keyboard.press('Enter'); await sleep(50)
await browser.close()
// 1280x720
;({ browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } }))
await fresh(page)
const hdr = await page.evaluate(() => { const h = document.querySelector('[data-testid="header"]'); const r = h.getBoundingClientRect(); return [...h.children].map((c) => ({ cls: c.className, text: c.textContent.slice(0, 30), clipped: c.getBoundingClientRect().right > r.right + 1 || c.getBoundingClientRect().left < r.left, w: Math.round(c.getBoundingClientRect().width) })) })
log({ case: '1280x720 header', clipped: hdr.filter((c) => c.clipped), all: hdr.map((c) => c.cls + ':' + c.w) })
const st = await page.evaluate(() => { const h = document.querySelector('[data-testid="status"]'); return { scrollW: h.scrollWidth, clientW: h.clientWidth, hintsRight: document.querySelector('.status .hints').getBoundingClientRect().right } })
log({ case: '1280x720 status', st })
await shot(page, '09-1280x720')
await goto(page, 'R022'); await page.keyboard.press('Space'); await shot(page, '09-1280x720-detail')
await page.keyboard.press('7'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(50)
log({ case: '1280 detail quotes table overflow', quotesW: await page.evaluate(() => document.querySelector('table.quotes')?.scrollWidth), cellW: await page.evaluate(() => document.querySelector('tr.detail td')?.clientWidth) })
await page.keyboard.press('Escape')
// zoom 150%: emulate with CSS zoom on html
await page.keyboard.press('1')
await page.evaluate(() => { document.documentElement.style.zoom = '1.5' }); await sleep(100)
const hdr2 = await page.evaluate(() => { const h = document.querySelector('[data-testid="header"]'); const r = h.getBoundingClientRect(); return { headerRight: r.right, winW: innerWidth, children: [...h.children].map((c) => ({ cls: c.className, right: Math.round(c.getBoundingClientRect().right), visible: c.getBoundingClientRect().right <= r.right + 1 })) } })
log({ case: '1280 zoom150 header', hidden: hdr2.children.filter((c) => !c.visible).map((c) => c.cls), headerRight: hdr2.headerRight })
const st2 = await page.evaluate(() => { const h = document.querySelector('[data-testid="status"]'); return { scrollW: h.scrollWidth, clientW: h.clientWidth, overflow: h.scrollWidth > h.clientWidth, hints: [...document.querySelectorAll('.status .hints span')].map((s) => ({ t: s.textContent, right: Math.round(s.getBoundingClientRect().right) })) } })
log({ case: '1280 zoom150 status overflow', st2 })
await shot(page, '09-1280-zoom150')
await page.keyboard.press('Control+k'); await shot(page, '09-1280-zoom150-palette'); const dlg = await page.evaluate(() => { const d = document.querySelector('.dialog'); const r = d.getBoundingClientRect(); return { h: r.height, bottom: r.bottom, winH: innerHeight / 1.5 } }); log({ case: 'zoom150 palette dialog', dlg }); await page.keyboard.press('Escape')
await page.keyboard.press('?'); const hd = await page.evaluate(() => { const d = document.querySelector('.dialog'); const b = d.querySelector('.body'); return { bodyScroll: b.scrollHeight > b.clientHeight, dialogBottom: d.getBoundingClientRect().bottom, winH: innerHeight / 1.5 } }); log({ case: 'zoom150 help dialog', hd }); await shot(page, '09-1280-zoom150-help'); await page.keyboard.press('Escape')
// real page zoom via CDP device scale is not browser zoom; also try 1280 with deviceScaleFactor
save('09-help-ui.json', out)
dumpErrors(errors, 'help-ui')
await browser.close()
