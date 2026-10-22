import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
import { parseKeymap, toPress } from './keymap-parse.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
const proj = async () => { const ws = await state(page); return ws?.projects.find((x) => x.id === ws.currentProjectId) }
const row = async (id) => (await proj()).rows.find((r) => r.id === id)
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
async function wizard(id, name, modeKey = '3', paste = null) {
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill(name); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill('未定'); await page.keyboard.press('Enter')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  // step 7: textarea autofocused — need Tab to escape before pressing 1-3
  const a1 = await page.evaluate(() => document.activeElement?.tagName)
  await page.keyboard.press(modeKey); const typed = await page.getByTestId('wizard-paste').inputValue().catch(() => null)
  await page.keyboard.press('Enter'); const stepAfterEnter = await page.locator('.wizard .steps .on').textContent().catch(() => null)
  log({ case: 'wizard step7 key ' + modeKey + ' with textarea focused', active: a1, typedIntoTextarea: typed, stepAfterEnter })
  if (paste) { await page.getByTestId('wizard-paste').fill(paste) } else { await page.getByTestId('wizard-paste').fill('') }
  await page.keyboard.press('Tab'); await page.keyboard.press(modeKey); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(150)
}
// ---- E. 同じ ID で新規作成
await fresh(page)
for (let k = 0; k < 2; k++) {
  await wizard('P-2026-041', '重複' + k)
  const ws = await state(page)
  log({ case: 'dup project create #' + k, projects: ws?.projects.map((p) => p.id + ':' + p.name), current: ws?.currentProjectId, header: (await page.getByTestId('header').textContent()).slice(0, 40), errs: errors.filter((e) => !e.text.includes('404')).map((e) => e.text.slice(0, 160)) })
}
await shot(page, '05-dup-id')
await page.keyboard.press('Control+p'); await sleep(50); log({ case: 'inbox list', items: (await page.locator('[data-testid="inbox"] .item').allTextContents()).map((t) => t.slice(0, 40)) })
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'open 3rd inbox item', header: (await page.getByTestId('header').textContent()).slice(0, 40), current: (await state(page)).currentProjectId, sideCurrent: await page.locator('.side .view[aria-current="true"]').allTextContents() })
// ---- F. 空の案件で全キー
await fresh(page)
await wizard('P-EMPTY', '空')
log({ case: 'empty project created', projects: (await state(page))?.projects.map((p) => p.id), rows: (await proj())?.rows.length })
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Shift+Delete')
log({ case: 'empty project', rows: (await proj()).rows.length, grid: (await page.locator('table.grid tbody').textContent()).slice(0, 60) })
const KM = parseKeymap()
for (const role of ['design', 'purchasing', 'pm']) {
  await setRole(page, role)
  for (const b of KM) for (const k of b.keys) {
    const n = errors.length
    page._tag = `empty/${role}/${k}`
    await page.keyboard.press(toPress(k)).catch(() => {})
    await sleep(10)
    const ne = errors.slice(n).filter((e) => !e.text.includes('404'))
    if (ne.length) log({ case: `empty project key ${k} (${role})`, errors: ne.map((e) => e.text.slice(0, 200)) })
    for (let i = 0; i < 10 && (await panel()); i++) await page.keyboard.press('Escape')
    if ((await mode(page)) !== 'ナビ') await page.keyboard.press('Escape')
    await page.locator('.gridwrap').focus()
  }
}
log({ case: 'empty project all keys done', rows: (await proj()).rows.length, mode: await mode(page), cursor: await cursor(page), grid: await page.getByTestId('grid').count() })
await setRole(page, 'purchasing')
for (const cmd of ['概算見積を依頼', '正式見積を依頼', '商社を集約', '未採用を推奨で一括採用', '選定記録を出力', '見積回答を取り込む', '公開', '履歴', '案件設定']) {
  const n = errors.length
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(cmd); await page.keyboard.press('Enter'); await sleep(100)
  const pn = await panel()
  if (pn === 'panel-prompt' || pn === 'panel-import') { await page.keyboard.press('Control+Enter'); await sleep(100) }
  log({ case: 'empty project cmd ' + cmd, panel: await panel(), toast: await toast(page), errors: errors.slice(n).filter((e) => !e.text.includes('404')).map((e) => e.text.slice(0, 150)) })
  for (let i = 0; i < 5 && (await panel()); i++) await page.keyboard.press('Escape')
}
// Shift+Enter in empty project (design) then publish
await setRole(page, 'design'); await page.keyboard.press('Shift+Enter'); log({ case: 'Shift+Enter in empty', mode: await mode(page), cursor: await cursor(page), rows: (await proj()).rows.length }); await page.keyboard.press('Escape')
// ---- G. 商社 10 社
await fresh(page)
for (let i = 0; i < 10; i++) { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('商社を追加'); await page.keyboard.press('Enter'); await page.getByTestId('prompt-text').fill('商社' + (i + 1)); await page.keyboard.press('Enter'); await sleep(20) }
let ws = await state(page)
log({ case: '10 suppliers added', n: ws.suppliers.length, ids: ws.suppliers.map((s) => s.id), colorsDup: ws.suppliers.length - new Set(ws.suppliers.map((s) => s.color)).size, undoToast: (await page.keyboard.press('Control+z'), await toast(page)) })
await setRole(page, 'purchasing')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
const fields = await page.locator('[data-testid="settings"] .opt').allTextContents(); const si = fields.findIndex((f) => f.includes('相見積先'))
for (let i = 0; i < si; i++) await page.keyboard.press('ArrowDown')
await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill(ws.suppliers.map((s) => s.id).join(',')); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50)
log({ case: 'settings supplierIds prompt', panel: await panel() })
await page.getByTestId('prompt-text').fill('全社相見積').catch(() => {}); await page.keyboard.press('Enter'); await sleep(100)
ws = await state(page)
log({ case: 'supplierIds set', ids: ws.projects[0].supplierIds, toast: await toast(page) })
for (const v of ['6', '9']) { const t = Date.now(); await page.keyboard.press(v); await sleep(50); log({ case: 'view ' + v + ' with 15 suppliers', ms: Date.now() - t, ths: await page.locator('table.grid th').count(), width: await page.evaluate(() => document.querySelector('table.grid').scrollWidth) }) }
await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await sleep(50); log({ case: 'End in view 9', cursor: await cursor(page), scrollLeft: await page.evaluate(() => document.querySelector('.gridwrap').scrollLeft), cursorVisible: await page.locator('td.cursor').isVisible().catch(() => false) })
await shot(page, '05-15suppliers-view9')
await setRole(page, 'design'); await page.keyboard.press('1')
await goto(page, 'R030'); await page.keyboard.press('Shift+A'); log({ case: 'Shift+A opts count (3 quotes)', n: await page.locator('[data-testid="adopt"] .opt').count() }); await page.keyboard.press('Escape')
// Excel archive with 15 suppliers
const dlp = page.waitForEvent('download', { timeout: 10000 }).catch(() => null); await page.keyboard.press('Control+e'); await page.keyboard.press('3'); const dl = await dlp; log({ case: 'archive export 15 suppliers', ok: !!dl })
// ---- H. 役割切替・PM承認待ち行の編集・Undo
await fresh(page)
await goto(page, 'R030'); await page.keyboard.press('Shift+A'); const no = await page.locator('[data-testid="adopt"] .opt').count(); await page.keyboard.press(String(no)); await sleep(50); log({ case: 'reason prompt after Shift+A', panel: await panel(), hasText: await page.getByTestId('prompt-text').count() }); await page.keyboard.press('1'); await sleep(50)
log({ case: 'design Shift+A worst', toast: await toast(page), flags: (await row('R030')).flags, status: (await row('R030')).status, adopted: (await row('R030')).adoptedSupplierId })
await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
log({ case: 'design edit model on pmPending row', working: (await row('R030')).working, toast: await toast(page), flags: (await row('R030')).flags })
await setRole(page, 'purchasing')
await page.keyboard.press('Control+z'); log({ case: 'purchasing Ctrl+Z after design edit', toast: await toast(page), working: (await row('R030')).working })
await page.keyboard.press('9'); await goto(page, 'R030'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') }
await page.keyboard.press('Enter'); if ((await mode(page)) === '編集') { await page.keyboard.press('Control+a'); await page.keyboard.type('777'); await page.keyboard.press('Enter') }
log({ case: 'purchasing edit unitPrice on pmPending+working row', toast: await toast(page), q: (await proj()).quotes.find((q) => q.rowId === 'R030' && q.supplierId === 'S1' && !q.stale)?.unitPrice, status: (await row('R030')).status, view9has: await page.locator('[data-row-id="R030"]').count() })
await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R030'); await page.keyboard.press('y'); await sleep(50); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'PM approve R030 while design working', toast: await toast(page), flags: (await row('R030')).flags, status: (await row('R030')).status, working: (await row('R030')).working })
await setRole(page, 'design'); await page.keyboard.press('Control+z'); log({ case: 'design Ctrl+Z (own last = model edit)', toast: await toast(page), working: (await row('R030')).working, flags: (await row('R030')).flags, status: (await row('R030')).status })
await page.keyboard.press('Control+z'); log({ case: 'design Ctrl+Z again (adopt) after PM approved', toast: await toast(page), adopted: (await row('R030')).adoptedSupplierId, flags: (await row('R030')).flags, status: (await row('R030')).status, decisions: (await proj()).decisions.map((d) => d.kind) })
// ---- I. PM decision panel keys
await fresh(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'PM Enter decision panel R013', panel: await panel(), opts: await page.locator('[data-testid="quickfix"] .opt').allTextContents() })
await page.keyboard.press('g'); await sleep(50); log({ case: 'press g', panel: await panel(), title: await page.locator('.dialog h3').textContent().catch(() => null) })
await page.keyboard.type('再交渉して'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'after g reason', toast: await toast(page), status: (await row('R013')).status, flags: (await row('R013')).flags, view7rows: await page.getByTestId('row').count(), cursor: await cursor(page) })
await page.keyboard.press('Control+z'); log({ case: 'PM undo decision', toast: await toast(page), status: (await row('R013')).status, flags: (await row('R013')).flags, decisions: (await proj()).decisions.length })
await goto(page, 'R013'); await page.keyboard.press('Shift+Y'); log({ case: 'Shift+Y on 差分超過', toast: await toast(page), panel: await panel() }); for (let i = 0; i < 2 && (await panel()); i++) await page.keyboard.press('Escape')
await goto(page, 'R013'); await page.keyboard.press('Enter'); await page.keyboard.press('b'); await sleep(50); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'b 次点', toast: await toast(page), adopted: (await row('R013')).adoptedSupplierId, status: (await row('R013')).status, flags: (await row('R013')).flags })
await page.keyboard.press('Enter'); await sleep(50); log({ case: 'Enter on R013 after decision (view 7 still?)', panel: await panel(), mode: await mode(page), toast: await toast(page), cursor: await cursor(page) }); for (let i = 0; i < 2 && (await panel()); i++) await page.keyboard.press('Escape')
// ---- J. 購買: quotes.request deadline typing
await fresh(page, 'purchasing')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('概算見積を依頼'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'quotes.request prompt', panel: await panel(), options: await page.getByTestId('prompt-options').textContent().catch(() => null), hasText: await page.getByTestId('prompt-text').count() })
const dls = []
page.on('download', (d) => dls.push(d.suggestedFilename()))
await page.keyboard.type('2026-11-05'); await sleep(500)
log({ case: 'typed deadline 2026-11-05', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null), toast: await toast(page), downloads: dls, deadline: (await proj()).settings.quoteDeadline, quoting: (await proj()).rows.filter((r) => r.status === 'quoting').length })
for (let i = 0; i < 3; i++) await page.keyboard.press('Escape')
// settings reason prompt with options (needDateFixed row) + digits
await setRole(page, 'design'); await page.keyboard.press('c'); const cols = await page.locator('[data-testid="columns"] .opt').allTextContents(); const ci = cols.findIndex((c) => c.startsWith('必要日(固定)')); for (let i = 0; i < ci; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.keyboard.press('Escape')
await goto(page, 'R022'); await toCol(page, '必要日(固定)'); await page.keyboard.press('Enter'); await page.keyboard.type('2026-11-01'); await page.keyboard.press('Enter')
log({ case: 'needDateFixed set', v: (await row('R022')).working ?? (await row('R022')).needDateFixed })
await setRole(page, 'pm'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('2026-12-31'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'reason prompt (with fixedNeed options)', panel: await panel(), options: await page.getByTestId('prompt-options').textContent().catch(() => null), hasText: await page.getByTestId('prompt-text').count() })
await page.keyboard.type('納期を2週間延長'); await sleep(100)
log({ case: 'typed 納期を2週間延長', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null), toast: await toast(page), due: (await proj()).dueDate, lastDecision: (await proj()).decisions.at(-1) })
for (let i = 0; i < 4; i++) await page.keyboard.press('Escape')
save('05b-abnormal2.json', out)
dumpErrors(errors, 'abnormal2')
await browser.close()
