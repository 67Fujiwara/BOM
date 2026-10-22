import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
import { stateSafe } from "./lib2.mjs"
const proj = async () => { const ws = await stateSafe(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
const row = async (id) => (await proj()).rows.find((r) => r.id === id)
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
await fresh(page)
// ---- h. commit latency 80 rows in-page
await fresh(page); await goto(page, 'R040')
const lat = await page.evaluate(async () => {
  const res = []
  for (let i = 0; i < 10; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((r) => { const chk = () => (document.querySelector('[data-testid="cell-editor"]') ? r() : requestAnimationFrame(chk)); requestAnimationFrame(chk) })
    const inp = document.querySelector('[data-testid="cell-editor"]')
    inp.value = 'lat' + i; inp.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => requestAnimationFrame(r))
    const t = performance.now()
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((r) => { const chk = () => (document.querySelector('[data-testid="mode"]').textContent === 'ナビ' && !document.querySelector('[data-testid="cell-editor"]') ? r() : requestAnimationFrame(chk)); requestAnimationFrame(chk) })
    res.push(performance.now() - t)
  }
  return res.map((x) => x.toFixed(0))
})
log({ case: 'edit commit latency 80 rows (ms)', lat })
const vlat = await page.evaluate(async () => {
  const res = {}
  for (const v of '234567891') {
    const t = performance.now()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: v, bubbles: true }))
    await new Promise((r) => { const chk = () => (document.querySelector(`[data-testid="view-${v}"]`).getAttribute('aria-current') === 'true' ? r() : requestAnimationFrame(chk)); requestAnimationFrame(chk) })
    res[v] = (performance.now() - t).toFixed(0)
  }
  return res
})
log({ case: 'view switch latency 80 rows (ms)', vlat })
const spaceLat = await page.evaluate(async () => {
  const t = performance.now()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
  await new Promise((r) => { const chk = () => (document.querySelector('[data-testid="detail"]') ? r() : requestAnimationFrame(chk)); requestAnimationFrame(chk) })
  return (performance.now() - t).toFixed(0)
})
log({ case: 'Space open detail latency', spaceLat })
// ---- j. hide current column via c panel
await fresh(page); await goto(page, 'R020'); await toCol(page, 'メーカ'); await page.keyboard.press('c'); const cols = await page.locator('[data-testid="columns"] .opt').allTextContents(); const mi = cols.findIndex((c) => c.startsWith('メーカ')); for (let i = 0; i < mi; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('Escape')
log({ case: 'hid cursor column', cursor: await cursor(page), cursorCellVisible: await page.locator('td.cursor').count() })
await page.keyboard.press('j'); log({ case: 'j after hiding cursor col', cursor: await cursor(page), cursorCell: await page.locator('td.cursor').count() })
await page.keyboard.press('Enter'); log({ case: 'Enter on hidden col', mode: await mode(page), cursor: await cursor(page), editorVisible: await page.getByTestId('cell-editor').count() }); await page.keyboard.press('Escape')
await page.keyboard.press('s'); log({ case: 's sort on hidden col', chip: await page.locator('.toolbar .chip.muted').textContent().catch(() => null) }); await page.keyboard.press('s')
await page.keyboard.press('ArrowRight'); log({ case: 'ArrowRight from hidden col', cursor: await cursor(page) })
// view 2 (fixed cols) then back: cursorCol persists?
await toCol(page, '備考'); await page.keyboard.press('2'); log({ case: 'view2 cursor', cursor: await cursor(page), cell: await page.locator('td.cursor').count() }); await page.keyboard.press('1')
// ---- k. replace then Esc leaves duplicate
await goto(page, 'R030'); await page.keyboard.press('r'); await page.keyboard.press('Escape'); const p3 = await proj(); const nr = p3.rows.find((r) => r.replaces === 'R030')
log({ case: 'r then Esc', newRow: nr && { id: nr.id, model: nr.model, status: nr.status, flags: nr.flags }, old: (await row('R030')).status, statusCell: await page.locator('[data-row-id="R030"] td[data-col="status"]').textContent(), quotesCopied: p3.quotes.filter((q) => q.rowId === nr?.id).length })
await page.keyboard.press('Control+z'); log({ case: 'undo replace', rows: (await proj()).rows.length, old: (await row('R030')).status, toast: await toast(page) })
// ---- l. Ctrl+V multi-cell paste
await page.evaluate(() => navigator.clipboard.writeText('リレーA\tMY-A\tオムロン\t3\nリレーB\tMY-B\tオムロン\t4\nリレーC\tMY-C\tオムロン\t5'))
await goto(page, 'R079'); await toCol(page, '部品名'); await page.keyboard.press('Control+v'); await sleep(300)
const p4 = await proj()
log({ case: 'Ctrl+V 3x4 at R079 name', toast: await toast(page), rows: p4.rows.length, r79: [p4.rows.find((r) => r.id === 'R079')].map((r) => [r.name, r.model, r.maker, r.qtyNeeded])[0], r80: [p4.rows.find((r) => r.id === 'R080')].map((r) => [r.name, r.model, r.maker, r.qtyNeeded])[0], r81: [p4.rows.find((r) => r.id === 'R081')].map((r) => r && [r.name, r.model, r.maker, r.qtyNeeded])[0], events: p4.events.slice(-3).map((e) => e.text) })
await page.keyboard.press('Control+z'); log({ case: 'undo after multi paste (one Ctrl+Z)', r79name: (await row('R079')).name, rows: (await proj()).rows.length })
// paste starting at a non-editable col (ID)
await page.evaluate(() => navigator.clipboard.writeText('X1\tX2\tX3'))
await goto(page, 'R078'); await toCol(page, 'ID'); await page.keyboard.press('Control+v'); await sleep(200); log({ case: 'paste at ID col', toast: await toast(page), r78: [(await row('R078'))].map((r) => [r.id, r.ref, r.category, r.name])[0] })
// paste into published row → working
await page.evaluate(() => navigator.clipboard.writeText('P1\tP2'))
await goto(page, 'R040'); await toCol(page, '部品名'); await page.keyboard.press('Control+v'); await sleep(200); log({ case: 'paste into published row', working: (await row('R040')).working, toast: await toast(page) })
// ---- m. Ctrl+G edge
for (const q of ['', '34', 'r34', 'fx5u', 'ZZZ', ' R010 ']) { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter'); await sleep(30); log({ case: 'Ctrl+G ' + JSON.stringify(q), cursor: await cursor(page), toast: await toast(page), view: await page.evaluate(() => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid) }) }
// Ctrl+G to a hidden row / row filtered out
await page.keyboard.press('/'); await page.keyboard.type('zzzzz'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R010'); await page.keyboard.press('Enter'); await sleep(30); log({ case: 'Ctrl+G while filter excludes row', cursor: await cursor(page), filter: await page.getByTestId('filter').inputValue(), rows: await page.getByTestId('row').count() })
// ---- n. rev < > in view 5; '<' with no submissions
await page.keyboard.press('5'); await page.keyboard.press('<'); log({ case: 'view5 <', chip: await page.getByTestId('rev-filter').textContent(), rows: await page.getByTestId('row').count() }); await page.keyboard.press('<'); log({ case: 'view5 < again', chip: await page.getByTestId('rev-filter').textContent() }); await page.keyboard.press('>'); await page.keyboard.press('>'); log({ case: 'view5 >>', chip: await page.getByTestId('rev-filter').textContent() })
await page.keyboard.press('1'); await page.keyboard.press('<'); log({ case: '< in view 1', chip: await page.locator('.toolbar').textContent() })
// ---- t. sequence mode
await page.keyboard.press('Control+Shift+F'); await sleep(50); log({ case: 'Ctrl+Shift+F', panel: await panel(), cursor: await cursor(page), opts: (await page.locator('[data-testid="quickfix"] .opt').allTextContents()).slice(0, 3) })
let steps = 0; while ((await panel()) === 'panel-quickfix' && steps < 40) { await page.keyboard.press('Enter'); await sleep(60); steps++ }
log({ case: 'sequence Enter x', steps, panel: await panel(), cursor: await cursor(page), toast: await toast(page), lamps: await page.getByTestId('lamps').textContent(), mode: await mode(page) })
await page.keyboard.press('Control+z'); log({ case: 'undo after sequence', toast: await toast(page) })
// ---- Ctrl+V in edit mode with multiline clipboard
await page.evaluate(() => navigator.clipboard.writeText('L1\tL2\nL3'))
await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+v'); await sleep(100); log({ case: 'Ctrl+V in edit mode multiline', val: await page.getByTestId('cell-editor').inputValue().catch(() => null), mode: await mode(page) }); await page.keyboard.press('Escape')
// ---- Space on a row while filter active, then Esc order
await page.keyboard.press('/'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter'); await page.keyboard.press('Space'); const esc = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); esc.push({ detail: await page.getByTestId('detail').count(), filter: await page.getByTestId('filter').inputValue(), cursor: await cursor(page) }) } log({ case: 'Esc order with filter+detail', esc })
// ---- status label of replaced row and '置換済 →R0xx'
save('10d-focused.json', out)
dumpErrors(errors, 'focused')
await browser.close()
