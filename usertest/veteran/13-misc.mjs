import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, sleep } from './lib.mjs'
import { stateSafe } from './lib2.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
const proj = async () => { const ws = await stateSafe(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
const row = async (id) => (await proj()).rows.find((r) => r.id === id)
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
// ---- empty project: '>' crash?
await fresh(page)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-id').fill('P-E2'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('空2'); await page.keyboard.press('Enter'); for (let i = 0; i < 5; i++) await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Shift+Delete')
for (const role of ['design', 'purchasing', 'pm']) { await setRole(page, role); for (const k of ['<', '>', 'n', 'Shift+N', 'x', 'Control+Period', 'Control+Shift+F', 'Shift+ArrowRight', 'Control+Enter', 'a', 'Space', 'End', 'Home', ']', '[']) { const n = errors.length; await page.keyboard.press(k); await sleep(20); const ne = errors.slice(n).filter((e) => e.type === 'pageerror'); if (ne.length) log({ case: `empty ${role} ${k}`, err: ne.map((e) => e.text + ' | ' + e.stack.split('\n').slice(0, 3).join(' / ')) }); for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape') } }
await setRole(page, 'purchasing'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('見積回答を取り込む'); await page.keyboard.press('Enter'); await sleep(50); log({ case: 'quotes.import empty supplierIds prompt', panel: await panel(), opts: await page.getByTestId('prompt-options').textContent().catch(() => null) }); const n0 = errors.length; await page.keyboard.press('Enter'); await sleep(50); log({ case: 'Enter', panel: await panel(), err: errors.slice(n0).filter((e) => e.type === 'pageerror').map((e) => e.text + ' | ' + e.stack.split('\n').slice(0, 2).join(' / ')) })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
// ---- cross-user project-level undo
await fresh(page)
await goto(page, 'R030'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('設計の編集'); await page.keyboard.press('Enter')
await setRole(page, 'pm'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('5000000'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('予算増額'); await page.keyboard.press('Enter'); await sleep(100)
await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(50); await page.keyboard.type('受入OK'); await page.keyboard.press('Enter'); await sleep(50)
const before = await proj()
log({ case: 'PM changed budget + decided R013', budget: before.settings.budget, decisions: before.decisions.map((d) => d.kind), r013: before.rows.find((r) => r.id === 'R013').flags })
await setRole(page, 'purchasing'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('商社を追加'); await page.keyboard.press('Enter'); await page.getByTestId('prompt-text').fill('新商社'); await page.keyboard.press('Enter'); await sleep(30)
await page.keyboard.press('9'); await goto(page, 'R030'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('5555'); await page.keyboard.press('Enter'); await sleep(30)
await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(50)
const after = await proj()
log({ case: 'design Ctrl+Z after PM/purchasing changes', toast: await toast(page), budget: after.settings.budget, decisions: after.decisions.map((d) => d.kind), r013: after.rows.find((r) => r.id === 'R013').flags, r030working: after.rows.find((r) => r.id === 'R030').working, q30: after.quotes.find((q) => q.rowId === 'R030' && q.supplierId === 'S1' && !q.stale)?.unitPrice, events: after.events.slice(-4).map((e) => e.by.name + ':' + e.text) })
await shot(page, '13-cross-user-undo')
// publish by design, then purchasing acks diff (5 view x), then design Ctrl+Z (own publish) → acked lost? and submission removed while purchasing quotes exist
await fresh(page)
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('M76'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('N76'); await page.keyboard.press('Enter')
for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete') }
await page.keyboard.press('Control+Enter'); await sleep(50); if (await page.getByTestId('prompt-options').count()) await page.keyboard.press('1'); await sleep(100)
log({ case: 'design published', toast: await toast(page), subs: (await proj()).submissions.length, r076: (await row('R076')).status })
await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R076'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.type('100'); await page.keyboard.press('Enter'); await sleep(30)
log({ case: 'purchasing quoted R076', status: (await row('R076')).status, q: (await proj()).quotes.filter((q) => q.rowId === 'R076').length })
await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(50)
const p3 = await proj()
log({ case: 'design Ctrl+Z (undo publish) after purchasing quoted', toast: await toast(page), subs: p3.submissions.length, r076: p3.rows.find((r) => r.id === 'R076').status, r076pub: p3.rows.find((r) => r.id === 'R076').publishedRev, quotes76: p3.quotes.filter((q) => q.rowId === 'R076').map((q) => q.supplierId + ':' + q.unitPrice), revInfo: await page.getByTestId('rev-info').textContent().catch(() => null) })
// ---- PM decision '再交渉' no-op confirm + 'e' / 'd' options
await fresh(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('Enter'); await page.keyboard.press('g'); await page.keyboard.type('再交渉'); await page.keyboard.press('Enter'); await sleep(50)
const r13 = await row('R013'); const q13 = (await proj()).quotes.find((q) => q.rowId === 'R013' && q.supplierId === 'S1')
log({ case: '再交渉 result', status: r13.status, flags: r13.flags, formalPrice: q13.formalPrice, stillInView7: await page.locator('[data-row-id="R013"]').count(), ball: await page.locator('[data-row-id="R013"] td[data-col="ball"]').textContent().catch(() => null), decisions: (await proj()).decisions.map((d) => d.kind) })
await goto(page, 'R013'); await page.keyboard.press('Enter'); await page.keyboard.press('d'); await page.keyboard.type('代替検討'); await page.keyboard.press('Enter'); await sleep(50)
const r13b = await row('R013'); log({ case: 'd 設計へ代替依頼', status: r13b.status, flags: r13b.flags, issues: (await proj()).issues.filter((i) => i.rowId === 'R013').map((i) => i.kind + ':' + i.status), inView7: await page.locator('[data-row-id="R013"]').count() })
// ---- hidden rows in view 1 and n / Ctrl+Enter; hidden row still counted in header totals
await setRole(page, 'purchasing'); await page.keyboard.press('1'); await goto(page, 'R001'); await page.keyboard.press('h'); log({ case: 'hide adopted row R001', money: await page.getByTestId('money').textContent(), hidden: (await row('R001')).hidden })
await page.keyboard.press('h')
// ---- Space on cancelled row, detail of replaced row
await setRole(page, 'design'); await goto(page, 'R040'); await page.keyboard.press('r'); await page.keyboard.press('Escape'); await goto(page, 'R040'); await page.keyboard.press('Space'); await sleep(30); log({ case: 'detail of replaced row', detail: (await page.getByTestId('detail').textContent()).slice(0, 160) })
await page.keyboard.press('Space')
// ---- Shift+Enter inside filtered view / sorted view: where does the new row go?
await page.keyboard.press('/'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter'); await page.keyboard.press('Shift+Enter'); log({ case: 'Shift+Enter under filter', cursor: await cursor(page), mode: await mode(page), rowsShown: await page.getByTestId('row').count(), filter: await page.getByTestId('filter').inputValue() }); await page.keyboard.type('新行'); await page.keyboard.press('Enter'); log({ case: 'after commit', cursor: await cursor(page), rowsShown: await page.getByTestId('row').count(), newRowVisible: await page.locator('td.cursor').count() })
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
await goto(page, 'R010'); await toCol(page, '部品名'); await page.keyboard.press('s'); await goto(page, 'R010'); await page.keyboard.press('Shift+Enter'); const cu = await cursor(page); const pj = await proj(); log({ case: 'Shift+Enter under sort', cursor: cu, mode: await mode(page), idxInProject: pj.rows.findIndex((r) => r.id === cu.slice(0, 4)) }); await page.keyboard.press('Escape'); await page.keyboard.press('s')
// ---- Delete key on bool col as purchasing; Delete on 発注 for ordered row
await setRole(page, 'purchasing'); await page.keyboard.press('3'); await goto(page, 'R013'); await toCol(page, '発注'); await page.keyboard.press('Enter'); log({ case: 'Enter on bool cell', mode: await mode(page), val: await page.getByTestId('cell-editor').inputValue().catch(() => null), cands: await page.getByTestId('candidates').count() }); await page.keyboard.type('y'); await page.keyboard.press('Enter'); log({ case: 'typed y on 発注', ordered: (await row('R013')).ordered, status: (await row('R013')).status, toast: await toast(page) })
await goto(page, 'R013'); await toCol(page, '発注'); await page.keyboard.press('Delete'); log({ case: 'Delete on 発注 (ordered)', ordered: (await row('R013')).ordered, received: (await row('R013')).received, status: (await row('R013')).status })
await goto(page, 'R013'); await toCol(page, '入荷予定'); await page.keyboard.press('Enter'); await page.keyboard.type('2026/13/45'); await page.keyboard.press('Enter'); log({ case: 'promisedDate 2026/13/45', v: (await row('R013')).promisedDate, cell: await page.locator('[data-row-id="R013"] td[data-col="promisedDate"]').textContent(), flags: (await row('R013')).flags })
// ---- w: weights panel bounds
await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('w'); for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight'); for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft'); log({ case: 'weights panel extremes', w: (await proj()).rowWeights['R020'], events: (await proj()).events.length }); await page.keyboard.press('Delete'); log({ case: 'weights Delete', w: (await proj()).rowWeights['R020'] }); await page.keyboard.press('Escape')
await page.keyboard.press('w'); for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowLeft']) await page.keyboard.press(k); for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowLeft'); log({ case: 'all weights to 0?', w: (await proj()).rowWeights['R020'] }); await page.keyboard.press('Escape')
await page.keyboard.press('Space'); await sleep(30); log({ case: 'detail scores with weights', scores: (await page.locator('table.quotes tbody tr').allTextContents()).slice(0, 2), errs: errors.filter((e) => e.type === 'pageerror').length })
let undos = 0; for (let i = 0; i < 60; i++) { await page.keyboard.press('Control+z'); if ((await toast(page)).includes('ありません')) break; undos++ } log({ case: 'undo entries from weight panel', undos })
save('13-misc.json', out)
dumpErrors(errors, 'misc')
await browser.close()
