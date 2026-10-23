// 再検証の続き: U2-12, U2-11b, U2-09, U2-02（各パネル）, U-04, U-17, U-14, N2-13, U2-07
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, proj, ui, palette, runPalette, setRole, clearToast, attachErrors, URL } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const { log, save } = makeLog('t07_reverify2')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const openWizard = async () => { await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor() }
await step('U2-12', async () => {
  await fresh(page); await page.keyboard.press('1')
  for (const q of ['r30', 'R30', '30', 'KA1', 'ka1', 'FX5U', 'ブザー', '表76', 'E-2026-041-04', 'Ｒ３０']) {
    await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(q); await page.keyboard.press('Enter'); await page.waitForTimeout(60)
    log(`U2-12 Ctrl+G "${q}" ->`, (await ui(page)).cursorRow, '| toast', await T.toast(page), '| panel', await T.panel(page))
    if (await T.panel(page)) await page.keyboard.press('Escape')
  }
})
await step('U2-11b', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, '必要数')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('abc')
  let dlg = null; const h = async (d) => { dlg = d.type() + ':' + d.message(); await d.dismiss().catch(() => {}) }; page.on('dialog', h)
  await page.reload({ timeout: 3000 }).catch((e) => log('  reload threw', String(e).slice(0, 80))); await page.waitForTimeout(400)
  page.off('dialog', h)
  log('U2-11b invalid value reload: dialog', dlg, 'mode', (await ui(page).catch(() => ({}))).mode, 'edit', (await ui(page).catch(() => ({}))).editValue)
})
await step('U2-09', async () => {
  await fresh(page); await openWizard()
  await page.getByTestId('wizard-id').fill('RELOAD-1'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('リロード案件'); await page.waitForTimeout(200)
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(300)
  log('U2-09 after reload panel', await T.panel(page), 'toast', await T.toast(page))
  if (!(await T.panel(page))) await openWizard()
  const h3 = await page.getByTestId('wizard').locator('h3').textContent()
  log('  wizard step', h3, 'id', await page.getByTestId('wizard-id').inputValue().catch(() => '-'), 'name', await page.getByTestId('wizard-name').inputValue().catch(() => '-'), 'toast', await T.toast(page))
  await page.keyboard.press('Escape')
})
await step('U2-02', async () => {
  const tries = [
    ['issue kind step', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+I') }],
    ['issue text step', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('q') }],
    ['adopt panel', async () => { await sel(page, 'R030'); await page.keyboard.press('Shift+A') }],
    ['columns panel', async () => { await sel(page, 'R030'); await page.keyboard.press('c') }],
    ['weights panel', async () => { await sel(page, 'R030'); await page.keyboard.press('w') }],
    ['quickfix', async () => { await sel(page, 'R009'); await page.keyboard.press('Control+.') }],
    ['export', async () => { await page.keyboard.press('Control+e') }],
    ['settings', async () => { await runPalette(page, '案件設定') }],
    ['help', async () => { await page.keyboard.press('?') }],
    ['inbox', async () => { await page.keyboard.press('Control+p') }],
    ['goto prompt', async () => { await page.keyboard.press('Control+g') }],
  ]
  for (const [label, open] of tries) {
    await fresh(page); await page.keyboard.press('1')
    await open(); await page.waitForTimeout(80)
    const p0 = await T.panel(page)
    await page.keyboard.press('Control+k'); await page.waitForTimeout(80)
    log(`U2-02 [${label}] ${p0} -> Ctrl+K -> ${await T.panel(page)}`)
  }
})
await step('U-04', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R016'); await page.keyboard.press(' '); await page.waitForTimeout(80)
  const li = page.getByTestId('issues').locator('li').first()
  await li.click(); await page.waitForTimeout(60)
  log('U-04 click issue in detail: detailIndex', await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); return (await import(u)).useStore.getState().detailIndex }))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', await T.panelText(page))
  await page.keyboard.press('Escape')
  // ステータスバーのヒントをクリック
  await sel(page, 'R030')
  const hints = await page.locator('.status .hints .clickable').allTextContents(); log('  hints', hints.join(' | '))
  await page.locator('.status .hints .clickable', { hasText: '開く' }).click(); await page.waitForTimeout(80)
  log('  click "Space 開く" -> detail open', await page.locator('[data-detail-for="R030"]').count())
  // U-17 番号の二重
  const qrow = page.locator('table.quotes tbody tr').first(); await qrow.dblclick(); await page.waitForTimeout(80)
  log('U-17 quote action panel', await T.panelText(page)); await page.keyboard.press('Escape')
  await sel(page, 'R016'); await page.keyboard.press(' '); await page.getByTestId('issues').locator('li').first().dblclick(); await page.waitForTimeout(80)
  log('U-17 issue action panel', await T.panelText(page)); await page.keyboard.press('Escape')
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R016'); await page.keyboard.press('Control+.'); await page.waitForTimeout(80)
  log('U-17 purchasing Ctrl+. panel', await T.panelText(page)); await page.keyboard.press('Escape')
})
await step('U-14', async () => {
  await fresh(page); await page.keyboard.press('5'); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, 'メーカ')
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('UNDOTEST'); await page.keyboard.press('Enter')
  await page.reload(); await page.getByTestId('grid').waitFor(); await page.waitForTimeout(300)
  const u = await ui(page); log('U-14 after reload view', u.view, 'cursor', u.cursorRow, u.cursorCol)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80)
  const r = await row(page, 'R040'); log('  Ctrl+Z after reload ->', await T.toast(page), 'R040', r.maker, JSON.stringify(r.working))
})
await step('N2-13', async () => {
  await fresh(page); await page.keyboard.press('1')
  const page2 = await context.newPage(); attachErrors(page2, errors, 'tab2'); await page2.goto(URL); await page2.getByTestId('grid').waitFor()
  await sel(page, 'R040'); await page.locator('[data-row-id="R040"] td.name').dblclick(); await page.keyboard.press('Control+a'); await page.keyboard.type('A案')
  await page2.locator('.gridwrap').focus(); await page2.keyboard.press('1'); await sel(page2, 'R040'); await gotoCol(page2, '部品名'); await page2.keyboard.press('Enter'); await page2.keyboard.press('Control+a'); await page2.keyboard.type('B案'); await page2.keyboard.press('Enter')
  await page.waitForTimeout(800)
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const r1 = await row(page, 'R040'); log('N2-13 tab A Enter: toast', await T.toast(page), 'editError', await page.getByTestId('edit-error').textContent().catch(() => null), 'R040', JSON.stringify(r1.working ?? r1.name))
  await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const r2 = await row(page, 'R040'); log('  second Enter: toast', await T.toast(page), 'R040', JSON.stringify(r2.working ?? r2.name))
  await page2.close()
})
save(errors)
await browser.close()
