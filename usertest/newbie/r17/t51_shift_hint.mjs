// ラウンド7: Shift 付きのコマンドを打てないセルで押したときの「例: Alt+○」（Shift が落ちる）どおりに押す
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, row, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t51_shift_hint')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} sort=${JSON.stringify(u.sort)} | toast: ${await T.toast(page)}`) }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const decisions = async () => { const p = await proj(page); return JSON.stringify((p.decisions ?? []).slice(-2).map((d) => ({ row: d.rowId, kind: d.kind, choice: d.choice ?? d.decision, by: d.by, reason: d.reason }))) }

await step('A. PM: 7 の要決定の行で Shift+Y（却下のつもり）→ 案内「例: Alt+y」→ Alt+y', async () => {
  await fresh(page, 'pm'); await sleep(200); await state('open')
  const p0 = await proj(page); const r0 = await row(page, (await ui(page)).cursorRow); log('  before', r0.id, r0.status, 'decisions', (p0.decisions ?? []).length)
  await page.keyboard.press('Shift+KeyY'); await sleep(150); await state('Shift+Y')
  await page.keyboard.press('Alt+KeyY'); await sleep(200); await state('Alt+y (案内どおり)')
  if (await T.panel(page)) { log('  panel:', await T.panelText(page)); await shot(page, 't51_A_panel') }
  const p1 = await proj(page); const r1 = await row(page, r0.id); log('  after', r1.id, r1.status, 'decisions', (p1.decisions ?? []).length, await decisions())
})
await step('A2. PM: 7 で別の行（承認系）を探して Shift+Y → Alt+y', async () => {
  await fresh(page, 'pm'); await sleep(150)
  const vrows = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
  log('  7 rows', vrows.join(','))
  for (const id of vrows) {
    await sel(page, id); await gotoCol(page, '部品名'); await sleep(50)
    const r0 = await row(page, id)
    await page.keyboard.press('Shift+KeyY'); await sleep(120); const t1 = await T.toast(page)
    await page.keyboard.press('Alt+KeyY'); await sleep(200); const t2 = await T.toast(page); const pn = await T.panelText(page)
    const r1 = await row(page, id)
    log(`  ${id}: ${r0.status} -> ${r1.status} | Shift+Y: ${t1} | Alt+y: ${t2} | panel: ${pn?.slice(0, 200)}`)
    if (pn) { await shot(page, `t51_A2_${id}`); await page.keyboard.press('Escape'); await sleep(80); if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(80) } }
  }
})
await step('B. 設計: 単価で Shift+R（指摘に返信のつもり）→ Alt+r', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await gotoCol(page, '単価')
  await page.keyboard.press('Shift+KeyR'); await sleep(120); await state('Shift+R')
  await page.keyboard.press('Alt+KeyR'); await sleep(150); await state('Alt+r'); log('  panel:', await T.panelText(page))
  await page.keyboard.press('Escape'); await sleep(80)
})
await step('C. 設計: 金額で Shift+S（降順のつもり）→ Alt+s', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await gotoCol(page, '金額')
  await page.keyboard.press('Shift+KeyS'); await sleep(120); await state('Shift+S')
  await page.keyboard.press('Alt+KeyS'); await sleep(150); await state('Alt+s')
})
await step('D. 設計: スコアで Shift+A（商社を選んで）→ Alt+a', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R005'); await gotoCol(page, 'スコア'); const r0 = await row(page, 'R005')
  await page.keyboard.press('Shift+KeyA'); await sleep(120); await state('Shift+A')
  await page.keyboard.press('Alt+KeyA'); await sleep(150); await state('Alt+a'); const r1 = await row(page, 'R005'); log(`  R005 ${r0.status}/${r0.adoptedSupplierId} -> ${r1.status}/${r1.adoptedSupplierId}`)
})
save(errors); await browser.close()
