import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, sleep } from './lib.mjs'
import { stateSafe, showCol } from './lib2.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
const proj = async () => { const ws = await stateSafe(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
const row = async (id) => (await proj()).rows.find((r) => r.id === id)
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
await fresh(page)
log({ case: 'show cols', packQty: await showCol(page, '入数'), ndf: await showCol(page, '必要日(固定)'), oq: await showCol(page, '発注数') })
async function edit(rid, col, v) {
  await goto(page, rid); const ok = await toCol(page, col); if (!ok) return { err: 'no col ' + col }
  await page.keyboard.press('Enter'); if ((await mode(page)) !== '編集') return { err: 'not edit ' + (await toast(page)) }
  await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
  const r = await row(rid)
  return { r, cell: await page.locator(`[data-row-id="${rid}"] td.cursor, [data-row-id="${rid}"] td`).first().textContent() }
}
for (const [rid, col, v, key] of [['R076', '入数', '0', 'packQty'], ['R076', '入数', '-3', 'packQty'], ['R076', '入数', '2.5', 'packQty'], ['R076', '必要日(固定)', '2026/13/45', 'needDateFixed'], ['R076', '必要日(固定)', '未定', 'needDateFixed'], ['R076', '必要日(固定)', '昨日', 'needDateFixed'], ['R076', '必要日(固定)', '2026-2-30', 'needDateFixed'], ['R076', '必要日(固定)', '13/45', 'needDateFixed'], ['R076', '必要日(固定)', '2026-11-01', 'needDateFixed'], ['R076', '必要日(固定)', '20261101', 'needDateFixed'], ['R076', '必要日(固定)', '2025-01-01', 'needDateFixed']]) {
  const r = await edit(rid, col, v)
  log({ case: `${col} ${rid} ${JSON.stringify(v)}`, value: r.r?.working?.[key] ?? r.r?.[key], needDate: await page.locator(`[data-row-id="${rid}"] td[data-col="needDate"]`).textContent().catch(() => null), ndfCell: await page.locator(`[data-row-id="${rid}"] td[data-col="needDateFixed"]`).textContent().catch(() => null), lamps: (await page.getByTestId('lamps').textContent()).slice(-20), err: r.err })
}
// packQty with パック unit → packMultiple warn
await edit('R076', '単位', 'パック'); await edit('R076', '入数', '100'); await edit('R076', '必要数', '150')
log({ case: 'pack 100 qty 150', lamps: await page.getByTestId('lamps').textContent(), prs: await page.locator('[data-row-id="R076"] td.warn').count() })
await goto(page, 'R076'); await toCol(page, '必要数'); await page.keyboard.press('Control+Period'); log({ case: 'quickfix opts', opts: await page.locator('[data-testid="quickfix"] .opt').allTextContents() }); await page.keyboard.press('1'); await sleep(30); log({ case: 'after fix', qty: (await row('R076')).qtyNeeded })
// validUntil in view 6 as purchasing
await setRole(page, 'purchasing'); await page.keyboard.press('6')
async function editSup(rid, label, v) {
  await goto(page, rid); await page.keyboard.press('Home'); let found = false
  for (let i = 0; i < 80; i++) { if ((await cursor(page)).endsWith(label)) { found = true; break }; await page.keyboard.press('ArrowRight') }
  if (!found) return { err: 'no col' }
  await page.keyboard.press('Enter'); if ((await mode(page)) !== '編集') return { err: 'not edit: ' + (await toast(page)) }
  await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
  const p = await proj(); const q = p.quotes.find((x) => x.rowId === rid && x.supplierId === 'S1' && !x.stale)
  return { validUntil: q?.validUntil, cellSev: await page.locator(`[data-row-id="${rid}"] td.warn`).count(), inScore: true }
}
for (const v of ['2026/13/45', '昨日', '2020-01-01', '未定', '12/31', '2026-12-31']) {
  const r = await editSup('R020', '有効期限', v)
  const p = await proj(); const r20 = p.rows.find((x) => x.id === 'R020')
  log({ case: `validUntil ${JSON.stringify(v)}`, ...r, detailBest: null })
}
// does expired quote drop from adopt list?
await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('Shift+A'); log({ case: 'adopt list after validUntil 2026-12-31 (S1)', opts: await page.locator('[data-testid="adopt"] .opt').allTextContents() }); await page.keyboard.press('Escape')
await setRole(page, 'purchasing'); await page.keyboard.press('6'); await editSup('R020', '有効期限', '2026/13/45'); await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('Shift+A'); log({ case: 'adopt list with validUntil 2026/13/45 (S1)', opts: (await page.locator('[data-testid="adopt"] .opt').allTextContents()).map((t) => t.slice(0, 30)) }); await page.keyboard.press('Escape')
await setRole(page, 'purchasing'); await page.keyboard.press('6'); await editSup('R020', '有効期限', '2020-01-01'); await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('Shift+A'); log({ case: 'adopt list with validUntil 2020-01-01 (S1 expired)', opts: (await page.locator('[data-testid="adopt"] .opt').allTextContents()).map((t) => t.slice(0, 30)), statusCell: await page.locator('[data-row-id="R020"] td[data-col="status"]').textContent() }); await page.keyboard.press('Escape')
// settings reason prompt WITH options (needDateFixed on R022) + digits
await goto(page, 'R022'); await toCol(page, '必要日(固定)'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('2026-11-01'); await page.keyboard.press('Enter'); log({ case: 'R022 needDateFixed', v: (await row('R022')).working })
await setRole(page, 'pm'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('2026-12-31'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); log({ case: 'impact', lines: await page.getByTestId('impact').textContent().catch(() => null) }); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'reason prompt', panel: await panel(), options: await page.getByTestId('prompt-options').textContent().catch(() => null), hasText: await page.getByTestId('prompt-text').count() })
await page.keyboard.type('納期を2週間延長'); await sleep(100)
log({ case: 'typed 納期を2週間延長', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null), toast: await toast(page), due: (await proj()).dueDate, lastDecision: (await proj()).decisions.at(-1)?.reason, r022: (await row('R022')).needDateFixed })
for (let i = 0; i < 4; i++) await page.keyboard.press('Escape')
// budget '百万' / negative
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('百万'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('予算').catch(() => {}); await page.keyboard.press('Enter'); await sleep(100)
log({ case: 'budget 百万', budget: (await proj()).settings.budget, header: (await page.getByTestId('money').textContent()), panel: await panel() })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('abc'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('重み').catch(() => {}); await page.keyboard.press('Enter'); await sleep(100)
log({ case: 'weights abc', weights: (await proj()).weights, panel: await panel(), errs: errors.filter((e) => e.type === 'pageerror').map((e) => e.text) })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('Space'); await sleep(50); log({ case: 'detail with NaN weights', detail: (await page.getByTestId('detail').textContent()).slice(0, 200), errs: errors.filter((e) => e.type === 'pageerror').length })
await shot(page, '03b-nan-weights')
save('03b-boundary2.json', out)
dumpErrors(errors, 'boundary2')
await browser.close()
