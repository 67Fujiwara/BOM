import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 400)) }
const proj = async () => { const ws = await state(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
const row = async (id) => (await proj()).rows.find((r) => r.id === id)
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
// ---- A. 置換済の行を置換 / 取消した行を編集・削除
await fresh(page)
await goto(page, 'R020'); await page.keyboard.press('r'); await sleep(50)
let a = { case: 'r on R020', cursor: await cursor(page), mode: await mode(page) }
await page.keyboard.press('Escape')
a.r020 = (await row('R020')).status; a.new = (await proj()).rows.length
log(a)
await goto(page, 'R020'); await page.keyboard.press('r'); await sleep(50)
log({ case: 'r on replaced R020 again', toast: await toast(page), cursor: await cursor(page), mode: await mode(page), rows: (await proj()).rows.length, r020: await row('R020').then((r) => ({ status: r.status, replacedBy: r.replacedBy })) })
await page.keyboard.press('Escape')
await goto(page, 'R020'); await page.keyboard.press('Enter'); log({ case: 'Enter on replaced row', mode: await mode(page), toast: await toast(page) })
await page.keyboard.press('Escape')
await goto(page, 'R020'); await page.keyboard.press('Shift+Delete'); log({ case: 'Shift+Delete replaced row', status: (await row('R020')).status, toast: await toast(page) })
await goto(page, 'R020'); await page.keyboard.press('Shift+D'); log({ case: 'Shift+D replaced row', rows: (await proj()).rows.length, cursor: await cursor(page), toast: await toast(page) })
await goto(page, 'R020'); await page.keyboard.press('Alt+ArrowDown'); log({ case: 'Alt+Down replaced row', idx: (await proj()).rows.findIndex((r) => r.id === 'R020'), toast: await toast(page) })
await goto(page, 'R020'); await page.keyboard.press('Shift+I'); log({ case: 'Shift+I on replaced row (design)', panel: await panel() }); await page.keyboard.press('Escape')
await goto(page, 'R020'); await page.keyboard.press('a'); log({ case: 'a on replaced row', toast: await toast(page) })
await goto(page, 'R020'); await page.keyboard.press('Delete'); log({ case: 'Delete on replaced row', toast: await toast(page), name: (await row('R020')).name })
// cancel R021 then edit
await goto(page, 'R021'); await page.keyboard.press('Shift+Delete'); log({ case: 'Shift+Delete R021 (published)', status: (await row('R021')).status })
await goto(page, 'R021'); await page.keyboard.press('Enter'); log({ case: 'Enter on cancelled', mode: await mode(page), toast: await toast(page) }); await page.keyboard.press('Escape')
await goto(page, 'R021'); await page.keyboard.type('Q'); log({ case: 'type on cancelled', mode: await mode(page), toast: await toast(page) }); await page.keyboard.press('Escape')
await goto(page, 'R021'); await page.keyboard.press('Shift+Delete'); log({ case: 'Shift+Delete cancelled again', status: (await row('R021')).status, events: (await proj()).events.slice(-1)[0]?.text })
await goto(page, 'R021'); await page.keyboard.press('r'); log({ case: 'r on cancelled', rows: (await proj()).rows.length, cursor: await cursor(page), mode: await mode(page) }); await page.keyboard.press('Escape')
await goto(page, 'R021'); await page.keyboard.press('h'); log({ case: 'h on cancelled', hidden: (await row('R021')).hidden })
await page.keyboard.press('Control+z'); log({ case: 'undo h', hidden: (await row('R021')).hidden, toast: await toast(page) })
// Shift+A on row without quotes (R076 draft), Alt+A, a
await goto(page, 'R076'); await page.keyboard.press('Shift+A'); log({ case: 'Shift+A R076 (draft, no quotes)', panel: await panel(), toast: await toast(page) }); await page.keyboard.press('Escape')
await goto(page, 'R076'); await page.keyboard.press('Alt+A'); log({ case: 'Alt+A R076', toast: await toast(page) })
await goto(page, 'R076'); await page.keyboard.press('a'); log({ case: 'a R076', toast: await toast(page) })
// Shift+A on quoted row with only one valid quote? R005 etc. Find row with 0 valid quotes but status quoted
const p1 = await proj()
const noQuote = p1.rows.find((r) => r.status === 'quoted' && !p1.quotes.some((q) => q.rowId === r.id && q.unitPrice != null))
log({ case: 'rows quoted w/o valid quotes', id: noQuote?.id })
if (noQuote) { await goto(page, noQuote.id); await page.keyboard.press('Shift+A'); log({ case: 'Shift+A no-valid-quote', panel: await panel(), toast: await toast(page) }); await page.keyboard.press('Escape'); await page.keyboard.press('a'); log({ case: 'a no-valid-quote', toast: await toast(page) }) }
// ---- B. 発注済の行を削除（purchasing o on formalQuoted R013)
await setRole(page, 'purchasing')
await goto(page, 'R013'); await page.keyboard.press('o'); log({ case: 'purchasing o R013', status: (await row('R013')).status, ordered: (await row('R013')).ordered, toast: await toast(page) })
await page.keyboard.press('i'); log({ case: 'purchasing i R013', status: (await row('R013')).status, received: (await row('R013')).received })
await page.keyboard.press('o'); log({ case: 'purchasing o again (received row) ', status: (await row('R013')).status, ordered: (await row('R013')).ordered, received: (await row('R013')).received })
await page.keyboard.press('i'); await page.keyboard.press('o'); log({ case: 'i off then o on', status: (await row('R013')).status, ordered: (await row('R013')).ordered, received: (await row('R013')).received })
await setRole(page, 'design')
await goto(page, 'R013'); await page.keyboard.press('Shift+Delete'); log({ case: 'design Shift+Delete ordered row', status: (await row('R013')).status, toast: await toast(page) })
await page.keyboard.press('r'); log({ case: 'design r ordered row', toast: await toast(page), rows: (await proj()).rows.length, mode: await mode(page) }); await page.keyboard.press('Escape')
await goto(page, 'R013'); await page.keyboard.press('Enter'); if ((await mode(page)) === '編集') { await page.keyboard.type('X'); await page.keyboard.press('Enter') } log({ case: 'design edit ordered row name', toast: await toast(page), working: (await row('R013')).working, mode: await mode(page) })
await page.keyboard.press('Escape')
// ---- C. prompt digit-in-text bug: 変更セット reason / role switch prompt text input
await goto(page, 'R030'); await toCol(page, '必要数'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('5'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await sleep(50)
log({ case: 'Ctrl+Enter with non-issue change', panel: await panel(), hasTextInput: await page.getByTestId('prompt-text').count(), options: await page.getByTestId('prompt-options').textContent().catch(() => null), toast: await toast(page) })
await page.keyboard.press('Escape')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('役割を切り替え'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'role.switch prompt', panel: await panel(), hasTextInput: await page.getByTestId('prompt-text').count(), options: await page.getByTestId('prompt-options').textContent().catch(() => null) })
await page.keyboard.press('Escape')
// Shift+A reason prompt text?
await goto(page, 'R030'); await page.keyboard.press('Shift+A'); const nOpt = await page.locator('[data-testid="adopt"] .opt').count(); if (nOpt > 1) { await page.keyboard.press(String(nOpt)); await sleep(50); log({ case: 'Shift+A non-top reason prompt', panel: await panel(), hasTextInput: await page.getByTestId('prompt-text').count(), options: await page.getByTestId('prompt-options').textContent().catch(() => null) }); await page.keyboard.press('Escape') } else await page.keyboard.press('Escape')
// ---- D. PM: settings change reason prompt with options+requireText, type digits
await setRole(page, 'pm')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); // dueDate
await page.getByTestId('settings-input').fill('2026-12-31'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100)
log({ case: 'settings due change → impact', panel: await panel(), impact: await page.getByTestId('impact').textContent().catch(() => null) })
await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'reason prompt', panel: await panel(), options: await page.getByTestId('prompt-options').textContent().catch(() => null), hasTextInput: await page.getByTestId('prompt-text').count() })
await page.keyboard.type('納期を2週間'); await sleep(50)
log({ case: 'typed 納期を2週間 in reason', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null), toast: await toast(page), due: (await proj()).dueDate })
for (let i = 0; i < 4; i++) await page.keyboard.press('Escape')
// digits in 却下 reason (requireText no options) fine; try decideWithReason on R013 (差分超過) with 'y' then extra fields
await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(50)
log({ case: 'PM y on R013', panel: await panel(), title: await page.locator('.dialog h3').textContent().catch(() => null), extra: await page.locator('.dialog label').allTextContents().catch(() => []) })
await page.keyboard.type('価格差1万'); log({ case: 'typed digits in y reason', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null) })
await page.keyboard.press('Enter'); await sleep(50); log({ case: 'Enter y reason', toast: await toast(page), flags: (await row('R013')).flags, status: (await row('R013')).status, decisions: (await proj()).decisions.length })
for (let i = 0; i < 3; i++) await page.keyboard.press('Escape')
// PM Enter decision panel keys b/g/d/q/e on a 差分超過 row: reset by fresh later
// ---- E. 同じ ID で新規作成
await fresh(page)
for (let k = 0; k < 2; k++) {
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-id').fill('P-2026-041'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill('重複' + k); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill('未定'); await page.keyboard.press('Enter')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
  const ws = await state(page)
  log({ case: 'dup project create #' + k, projects: ws.projects.map((p) => p.id + ':' + p.name), current: ws.currentProjectId, header: await page.getByTestId('header').textContent(), errs: errors.filter((e) => e.type !== 'error' || !e.text.includes('404')).length })
}
await shot(page, '05-dup-id')
// switch between same-id projects via Ctrl+P
await page.keyboard.press('Control+p'); await sleep(50); log({ case: 'inbox list', items: await page.locator('[data-testid="inbox"] .item').allTextContents() }); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'open 3rd inbox item', header: await page.getByTestId('header').textContent(), current: (await state(page)).currentProjectId })
// ---- F. 空の案件で全キー（R001 1行の空行 → 削除して 0 行）
await fresh(page)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-id').fill('P-EMPTY'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('空'); await page.keyboard.press('Enter')
for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')
await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Shift+Delete')
log({ case: 'empty project', rows: (await proj()).rows.length, grid: await page.locator('table.grid tbody').textContent() })
const { parseKeymap, toPress } = await import('./keymap-parse.mjs')
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
log({ case: 'empty project all keys done', rows: (await proj()).rows.length, mode: await mode(page), cursor: await cursor(page) })
// Ctrl+Enter publish empty, bulk adopt, consolidate, export, formal
await setRole(page, 'purchasing')
for (const cmd of ['概算見積を依頼', '正式見積を依頼', '商社を集約', '未採用を推奨で一括採用', '選定記録を出力', '見積回答を取り込む']) {
  const n = errors.length
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(cmd); await page.keyboard.press('Enter'); await sleep(100)
  const pn = await panel()
  if (pn === 'panel-prompt' || pn === 'panel-import') { await page.keyboard.press('Control+Enter'); await sleep(100) }
  log({ case: 'empty project cmd ' + cmd, panel: await panel(), toast: await toast(page), errors: errors.slice(n).filter((e) => !e.text.includes('404')).map((e) => e.text.slice(0, 150)) })
  for (let i = 0; i < 5 && (await panel()); i++) await page.keyboard.press('Escape')
}
// ---- G. 商社を 10 社追加 → supplierIds を全部 → 6/9 ビュー
await fresh(page)
for (let i = 0; i < 10; i++) { await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('商社を追加'); await page.keyboard.press('Enter'); await page.getByTestId('prompt-text').fill('商社' + (i + 1)); await page.keyboard.press('Enter'); await sleep(20) }
let ws = await state(page)
log({ case: '10 suppliers added', n: ws.suppliers.length, ids: ws.suppliers.map((s) => s.id), colorsDup: ws.suppliers.length - new Set(ws.suppliers.map((s) => s.color)).size })
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
await page.keyboard.press('End'); log({ case: 'End in view 9', cursor: await cursor(page), scrollLeft: await page.evaluate(() => document.querySelector('.gridwrap').scrollLeft) })
await shot(page, '05-15suppliers-view9')
// Shift+A with >9 quotes: can key 10+ be chosen?
await setRole(page, 'design')
await goto(page, 'R030'); await page.keyboard.press('Shift+A'); log({ case: 'Shift+A opts count', n: await page.locator('[data-testid="adopt"] .opt').count() }); await page.keyboard.press('Escape')
// ---- H. 役割を切り替えながら同じ行を編集 / PM承認待ちの行を設計が編集 / Undo 他人
await fresh(page)
await goto(page, 'R030'); await page.keyboard.press('Shift+A'); const no = await page.locator('[data-testid="adopt"] .opt').count(); await page.keyboard.press(String(no)); await sleep(50); await page.keyboard.press('1'); await sleep(50)
log({ case: 'design Shift+A worst', toast: await toast(page), flags: (await row('R030')).flags, status: (await row('R030')).status })
await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL'); await page.keyboard.press('Enter')
log({ case: 'design edit model on pmPending row', working: (await row('R030')).working, toast: await toast(page), flags: (await row('R030')).flags })
await setRole(page, 'purchasing')
await page.keyboard.press('Control+z'); log({ case: 'purchasing Ctrl+Z after design edit', toast: await toast(page), working: (await row('R030')).working })
await page.keyboard.press('9'); await goto(page, 'R030'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') }
await page.keyboard.press('Enter'); if ((await mode(page)) === '編集') { await page.keyboard.press('Control+a'); await page.keyboard.type('777'); await page.keyboard.press('Enter') }
log({ case: 'purchasing edit unitPrice on pmPending+working row', toast: await toast(page), q: (await proj()).quotes.find((q) => q.rowId === 'R030' && q.supplierId === 'S1' && !q.stale)?.unitPrice, status: (await row('R030')).status })
await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R030'); await page.keyboard.press('y'); await sleep(50); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'PM approve R030 while design working', toast: await toast(page), flags: (await row('R030')).flags, status: (await row('R030')).status, working: (await row('R030')).working })
await setRole(page, 'design'); await page.keyboard.press('Control+z'); log({ case: 'design Ctrl+Z after PM decision (own last = model edit)', toast: await toast(page), working: (await row('R030')).working, flags: (await row('R030')).flags, status: (await row('R030')).status })
await page.keyboard.press('Control+z'); log({ case: 'design Ctrl+Z again (adopt)', toast: await toast(page), adopted: (await row('R030')).adoptedSupplierId, flags: (await row('R030')).flags, status: (await row('R030')).status, decisions: (await proj()).decisions.length })
// Undo after role switch by same user name? roles share name? Switch role via header: name changes to member name
// ---- I. PM decision panel keys
await fresh(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'PM Enter decision panel R013', panel: await panel(), opts: await page.locator('[data-testid="quickfix"] .opt').allTextContents() })
await page.keyboard.press('g'); await sleep(50); log({ case: 'press g', panel: await panel(), title: await page.locator('.dialog h3').textContent().catch(() => null) })
await page.keyboard.type('再交渉して'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'after g reason', toast: await toast(page), status: (await row('R013')).status, flags: (await row('R013')).flags, view7rows: await page.getByTestId('row').count(), cursor: await cursor(page) })
await page.keyboard.press('Control+z'); log({ case: 'PM undo decision', toast: await toast(page), status: (await row('R013')).status, flags: (await row('R013')).flags, decisions: (await proj()).decisions.length })
// y on R013 → requires external? budget; check requireText
await goto(page, 'R013'); await page.keyboard.press('Shift+Y'); log({ case: 'Shift+Y on 差分超過', toast: await toast(page), panel: await panel() }); await page.keyboard.press('Escape')
await page.keyboard.press('Enter'); await page.keyboard.press('b'); await sleep(50); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'b 次点', toast: await toast(page), adopted: (await row('R013')).adoptedSupplierId, status: (await row('R013')).status, flags: (await row('R013')).flags })
// ---- J. 購買: quotes.request deadline typing bug
await fresh(page, 'purchasing')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('概算見積を依頼'); await page.keyboard.press('Enter'); await sleep(50)
log({ case: 'quotes.request prompt', panel: await panel(), options: await page.getByTestId('prompt-options').textContent().catch(() => null) })
const dls = []
page.on('download', (d) => dls.push(d.suggestedFilename()))
await page.keyboard.type('2026-11-05'); await sleep(300)
log({ case: 'typed deadline 2026-11-05', panel: await panel(), text: await page.getByTestId('prompt-text').inputValue().catch(() => null), toast: await toast(page), downloads: dls, deadline: (await proj()).settings.quoteDeadline, supplierIds: (await proj()).supplierIds })
for (let i = 0; i < 3; i++) await page.keyboard.press('Escape')
save('05-abnormal.json', out)
dumpErrors(errors, 'abnormal')
await browser.close()
