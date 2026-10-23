// ラウンド7: ダイアログの中の Esc / Ctrl+K、指摘・置換・取消・決定パネル・ガイドの下書き
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, row, proj, sleep, setRole, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t57_dialogs')
const state = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | toast: ${await T.toast(page)} | ptext: ${(await T.panelText(page))?.slice(0, 160)}`) }
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
await step('A. 設計: 型式で Alt+Shift+I → q → 本文 → Ctrl+K → Esc → Esc', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '型式')
  const n0 = (await proj(page)).issues.length
  await page.keyboard.press('Alt+Shift+KeyI'); await sleep(120); await state('Alt+Shift+I')
  await page.keyboard.press('q'); await sleep(120); await state('q')
  await page.keyboard.insertText('この型式で合っていますか'); await sleep(80); await state('body')
  await page.keyboard.press('Control+k'); await sleep(120); await state('Ctrl+K')
  await page.keyboard.press('Escape'); await sleep(120); await state('Esc1')
  await page.keyboard.press('Escape'); await sleep(120); await state('Esc2')
  log('  issues', n0, '->', (await proj(page)).issues.length)
})
await step('A2. 同じ: 本文 → Enter で起票 → Ctrl+Z', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await gotoCol(page, '型式')
  const n0 = (await proj(page)).issues.length
  await page.keyboard.press('Alt+Shift+KeyI'); await page.keyboard.press('q'); await sleep(80); await page.keyboard.insertText('確認'); await page.keyboard.press('Enter'); await sleep(150); await state('Enter')
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(120); await state('Enter2') }
  log('  issues', n0, '->', (await proj(page)).issues.length)
  await page.keyboard.press('Control+z'); await sleep(120); await state('Ctrl+Z'); log('  issues after undo', (await proj(page)).issues.length)
})
await step('B. 置換: 部品名で Alt+r → 型式 → Esc → Esc / Enter 連打', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, '部品名')
  await page.keyboard.press('Alt+KeyR'); await sleep(120); await state('Alt+r')
  await typeReal(page, 'M22N-NEW', 30); await state('typed'); await page.keyboard.press('Escape'); await sleep(100); await state('Esc1'); await page.keyboard.press('Escape'); await sleep(100); await state('Esc2')
  log('  rows', (await proj(page)).rows.length)
  await page.keyboard.press('Alt+KeyR'); await sleep(100); await page.keyboard.press('Enter'); await sleep(100); await state('Alt+r Enter (空)')
  await page.keyboard.press('Enter'); await sleep(100); await state('Enter again'); await page.keyboard.press('Escape'); await sleep(80); await page.keyboard.press('Escape')
})
await step('C. 取消: 公開済の行で Shift+Delete → ダイアログ → Esc / Ctrl+K', async () => {
  await fresh(page); await page.keyboard.press('1'); await sel(page, 'R031'); await gotoCol(page, '部品名')
  await page.keyboard.press('Shift+Delete'); await sleep(120); await state('Shift+Delete')
  await page.keyboard.press('Control+k'); await sleep(120); await state('Ctrl+K')
  await page.keyboard.press('Escape'); await sleep(100); await state('Esc')
  log('  R031', (await row(page, 'R031')).status, JSON.stringify((await row(page, 'R031')).removal ?? null))
})
await step('D. PM: 決定パネル → Ctrl+K → Esc → Enter', async () => {
  await fresh(page, 'pm'); await sleep(150); await page.keyboard.press('Enter'); await sleep(120); await state('Enter (決定パネル)')
  await page.keyboard.press('Control+k'); await sleep(120); await state('Ctrl+K'); await page.keyboard.press('Escape'); await sleep(100); await state('Esc')
  await page.keyboard.press('Enter'); await sleep(120); await state('Enter again')
  await page.keyboard.press('Enter'); await sleep(120); await state('Enter 3'); await shot(page, 't57_D_pm')
  if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(120); await state('Enter 4') }
  const p = await proj(page); log('  decisions', JSON.stringify((p.decisions ?? []).map((d) => [d.rowId, d.kind, d.choice])), 'R003', (await row(page, 'R003')).status)
})
await step('E. ガイドの途中で Ctrl+K → Esc → もう一度「新しいBOM」', async () => {
  await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
  await page.getByTestId('wizard-id').fill('DRAFT-7'); await page.keyboard.press('Enter'); await page.keyboard.insertText('下書き案件'); await page.keyboard.press('Enter'); await sleep(80); await state('step3')
  await page.keyboard.press('Control+k'); await sleep(120); await state('Ctrl+K'); await page.keyboard.press('Escape'); await sleep(100); await state('Esc')
  await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await sleep(200); await state('reopen')
})
await step('F. 購買: Alt+8 → 正式単価に打つ', async () => {
  await fresh(page, 'purchasing'); await page.keyboard.press('Alt+8'); await sleep(150); await state('Alt+8')
  const ids = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('  rows', ids.join(','))
  await page.keyboard.press('ArrowDown'); await sleep(60); await state('↓')
  for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/正式|単価/.test(c)) break; await page.keyboard.press('ArrowRight') } await state('at formal')
  await typeReal(page, '1500', 50); await page.keyboard.press('Tab'); await typeReal(page, '10', 50); await page.keyboard.press('Enter'); await sleep(150); await state('typed')
  await shot(page, 't57_F_formal')
})
save(errors); await browser.close()
