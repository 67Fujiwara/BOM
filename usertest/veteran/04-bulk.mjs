import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
await fresh(page)
// 300-row paste via wizard
const cats = ['制御', '電源', '操作', '表示', '配線']
const lines = []
for (let i = 1; i <= 300; i++) lines.push([cats[i % 5], `部品${i}`, `MODEL-${String(i).padStart(3, '0')}${i % 9 === 0 ? ' ' : ''}`, i % 11 === 0 ? '' : 'オムロン', i % 13 === 0 ? 0 : (i % 7) + 1, i % 17 === 0 ? 'パック' : '個', `K${i}`].join('\t'))
await page.keyboard.press('Control+k')
await page.getByTestId('palette-input').fill('新しいBOM')
await page.keyboard.press('Enter')
await page.getByTestId('wizard-id').fill('P-2026-300')
await page.keyboard.press('Enter')
await page.getByTestId('wizard-name').fill('大型盤300')
await page.keyboard.press('Enter')
await page.getByTestId('wizard-due').fill('2026-12-25')
await page.keyboard.press('Enter')
await page.getByTestId('wizard-processDays').fill('10')
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await page.getByTestId('wizard-buyer').fill('佐藤')
await page.keyboard.press('Enter')
await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space')
await page.keyboard.press('Enter')
await page.keyboard.press('1')
await page.getByTestId('wizard-paste').fill(lines.join('\n'))
let t0 = Date.now()
await page.keyboard.press('Control+Enter')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.querySelector('[data-testid="header"]')?.textContent?.includes('大型盤300'))
out.create = { ms: Date.now() - t0, view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid), toast: await toast(page) }
console.log('create', out.create)
await page.keyboard.press('1')
out.rows = await page.getByTestId('row').count()
out.counts = await page.locator('[data-testid^="view-"] .n').allTextContents()
console.log('rows', out.rows, 'counts', out.counts)
await shot(page, '04-300rows')
// wizard picks check: which suppliers were set? (sel index reuse bug?)
const ws0 = await state(page)
const p0 = ws0.projects.find((x) => x.id === 'P-2026-300')
out.project = { supplierIds: p0.supplierIds, preferred: p0.preferredSupplierIds, rows: p0.rows.length, qty0: p0.rows.filter((r) => r.qtyNeeded === 0).length, pasteFirst: p0.rows[0], due: p0.dueDate }
console.log('project', out.project)
// view switching timing
out.views = {}
for (const v of '123456789') { const t = Date.now(); await page.keyboard.press(v); await page.waitForFunction((v) => document.querySelector(`[data-testid="view-${v}"]`)?.getAttribute('aria-current') === 'true', v); out.views[v] = { ms: Date.now() - t, rows: await page.getByTestId('row').count() } }
console.log('views', out.views)
await page.keyboard.press('1')
// latency j with 300 rows
await page.keyboard.press('Control+ArrowUp')
out.latency300 = await page.evaluate(async () => {
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
console.log('latency300', out.latency300)
// edit latency with 300 rows (commit)
await goto(page, 'R150')
const te = await page.evaluate(async () => {
  const t = performance.now()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await new Promise((r) => requestAnimationFrame(r))
  const inp = document.querySelector('[data-testid="cell-editor"]')
  const t1 = performance.now()
  return { toEdit: (t1 - t).toFixed(1), hasInput: !!inp }
})
await page.keyboard.type('編集済')
t0 = Date.now()
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.querySelector('[data-testid="mode"]')?.textContent === 'ナビ')
out.editCommit300 = { ...te, commitMs: Date.now() - t0 }
console.log('editCommit300', out.editCommit300)
// sort each column asc/desc
out.sort = []
await page.keyboard.press('Home')
const colCount = await page.locator('table.grid th').count()
for (let i = 0; i < colCount; i++) {
  const col = await cursor(page)
  let t = Date.now(); await page.keyboard.press('s'); const a = Date.now() - t
  const first = await page.locator('[data-testid="row"]').first().getAttribute('data-row-id')
  t = Date.now(); await page.keyboard.press('Shift+S'); const d = Date.now() - t
  const firstD = await page.locator('[data-testid="row"]').first().getAttribute('data-row-id')
  await page.keyboard.press('Shift+S') // clear
  const cleared = await page.evaluate(() => !document.querySelector('.chip.muted')?.textContent?.includes('並び替え'))
  out.sort.push({ col, ascMs: a, descMs: d, firstAsc: first, firstDesc: firstD, cleared, cursorAfter: await cursor(page) })
  await page.keyboard.press('ArrowRight')
}
console.log('sort', out.sort.map((s) => `${s.col}:${s.ascMs}/${s.descMs}${s.cleared ? '' : ' NOT-CLEARED'} ${s.firstAsc}/${s.firstDesc} cur=${s.cursorAfter}`).join('\n'))
// text filter
await page.keyboard.press('/')
t0 = Date.now()
await page.keyboard.type('部品2')
await sleep(100)
out.filter = { ms: Date.now() - t0, rows: await page.getByTestId('row').count(), cursor: await cursor(page) }
await page.keyboard.press('Enter')
out.filter.cursorAfterEnter = await cursor(page)
out.filter.active = await page.evaluate(() => document.activeElement?.className)
console.log('filter', out.filter)
await page.keyboard.press('Escape')
out.filter.afterEsc = { rows: await page.getByTestId('row').count(), filter: await page.getByTestId('filter').inputValue() }
// f cell filter on maker
await goto(page, 'R011')
await toCol(page, 'メーカ')
await page.keyboard.press('f')
out.cellFilter = { chip: await page.locator('.chip').first().textContent().catch(() => null), rows: await page.getByTestId('row').count(), expected: p0.rows.filter((r) => r.maker === '').length }
await page.keyboard.press('f')
out.cellFilter.afterToggle = await page.getByTestId('row').count()
console.log('cellFilter', out.cellFilter)
// columns panel: toggle ALL columns off
await page.keyboard.press('c')
const n = await page.locator('[data-testid="columns"] .opt').count()
for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Escape')
out.allColsOff = { ths: await page.locator('table.grid th').count(), cursor: await cursor(page), rows: await page.getByTestId('row').count(), mode: await mode(page) }
// try to edit / move with no columns
await page.keyboard.press('j'); await page.keyboard.press('Enter'); out.allColsOff.afterEnter = { mode: await mode(page), toast: await toast(page), cursor: await cursor(page) }
await page.keyboard.press('Escape')
await page.keyboard.press('End'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
out.allColsOff.afterMoves = { cursor: await cursor(page), errs: errors.length }
await shot(page, '04-allcols-off')
console.log('allColsOff', out.allColsOff)
// restore cols
await page.keyboard.press('c')
for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Escape')
// category [ ] navigation
await page.keyboard.press('Control+ArrowUp')
const seq = []
for (let i = 0; i < 8; i++) { await page.keyboard.press(']'); seq.push(await cursor(page)) }
for (let i = 0; i < 3; i++) { await page.keyboard.press('['); seq.push(await cursor(page)) }
out.category = { seq, spaceOnGroup: null }
await page.keyboard.press('Space')
out.category.spaceOnGroup = { rowsAfterCollapse: await page.getByTestId('row').count(), cursor: await cursor(page) }
await page.keyboard.press('j')
out.category.jAfterCollapse = await cursor(page)
await page.keyboard.press('k'); await page.keyboard.press('Space')
console.log('category', out.category)
// Paging / Home / End / Ctrl arrows
await page.keyboard.press('Control+ArrowUp'); const top = await cursor(page)
await page.keyboard.press('PageDown'); const pd = await cursor(page)
await page.keyboard.press('PageDown'); const pd2 = await cursor(page)
await page.keyboard.press('PageUp'); const pu = await cursor(page)
await page.keyboard.press('Control+ArrowDown'); const bot = await cursor(page)
const visibleRowsPerScreen = await page.evaluate(() => Math.floor(document.querySelector('.gridwrap').clientHeight / 34))
await page.keyboard.press('End'); const end = await cursor(page)
await page.keyboard.press('Home'); const home = await cursor(page)
out.paging = { top, pd, pd2, pu, bot, end, home, visibleRowsPerScreen, scrollTopAtBottom: await page.evaluate(() => document.querySelector('.gridwrap').scrollTop) }
console.log('paging', out.paging)
await shot(page, '04-bottom')
// Status bar count vs header: view 4 count vs rows shown
await page.keyboard.press('4')
out.view4 = { sideCount: (await page.locator('[data-testid="view-4"] .n').textContent()), rows: await page.getByTestId('row').count(), lamps: await page.getByTestId('lamps').textContent() }
console.log('view4', out.view4)
// n through problems: how many jumps until wrap
await page.keyboard.press('1')
const seen = new Set(); let first = null
for (let i = 0; i < 400; i++) { await page.keyboard.press('n'); const c = await cursor(page); if (first === null) first = c; else if (c === first) break; seen.add(c) }
out.nCycle = { distinct: seen.size, first }
console.log('nCycle', out.nCycle)
// publish 300 rows (errors exist -> blocked?)
await page.keyboard.press('Control+Enter')
await sleep(100)
out.publish = { toast: await toast(page), panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid) }
await page.keyboard.press('Escape')
console.log('publish', out.publish)
// Excel export with 300 rows timing
const dlP = page.waitForEvent('download', { timeout: 20000 }).catch(() => null)
await page.keyboard.press('Control+e'); await page.keyboard.press('3')
t0 = Date.now()
const dl = await dlP
out.excel300 = { ms: Date.now() - t0, file: dl?.suggestedFilename() }
console.log('excel300', out.excel300)
save('04-bulk.json', out)
dumpErrors(errors, 'bulk')
await browser.close()
