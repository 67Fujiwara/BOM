// 購買の新人が指摘を起票（Shift+I → 頭文字 → 本文 → Enter → J → …）→ 発行。設計が 4 → n → 直す → 公開（指摘対応＋設計変更の混在）→ Ctrl+Z
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t19_issues')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} panel=${u.panel} | ${(await T.panelText(page))?.slice(0, 140)} | toast=${await T.toast(page)}`) }
const iss = async () => (await proj(page)).issues.map((i) => `${i.id}:${i.rowId}/${i.field ?? '-'}/${i.kind}/${i.status}`).join(' ')
await fresh(page)
await step('raise', async () => {
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R040'); await gotoCol(page, '型式')
  await page.keyboard.press('Shift+I'); await U('Shift+I'); await page.keyboard.press('k'); await U('k')
  await page.keyboard.insertText('末尾の仕様が抜けています'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); await U('Enter')
  await page.keyboard.press('Shift+J'); await U('Shift+J (J で次の行へ)')
  await page.keyboard.press('Shift+I'); await page.keyboard.press('m'); await page.keyboard.insertText('メーカを書いてください'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80); await U('m + Ctrl+Enter (起票して次の行へ)')
  await page.keyboard.insertText('ここも'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); await U('typed + Enter')
  log('  issues', await iss())
  // Enter 連打（新人）
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); await U('Enter Enter'); if (await T.panel(page)) await page.keyboard.press('Escape'); if ((await ui(page)).mode === 'edit') await page.keyboard.press('Escape')
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await U('Ctrl+Enter publish')
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); await U('Enter') }
  log('  issues', await iss())
})
await step('design fix', async () => {
  await setRole(page, 'design'); await U('design start'); await page.keyboard.press('n'); await U('n')
  for (let i = 0; i < 6; i++) { const u = await ui(page); if (u.cursorRow === 'R040') break; await page.keyboard.press('n') }
  await U('at R040?')
  await page.keyboard.press('Enter'); await page.keyboard.press('End'); await page.keyboard.type(' 2M'); await page.keyboard.press('Enter'); await page.waitForTimeout(80); await U('fixed R040 model')
  // ついでに別の行の必要数も変える（設計変更）
  await sel(page, 'R044'); await gotoCol(page, '必要数'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('3'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { await U('publish panel'); await page.keyboard.press(i === 0 ? '2' : 'Enter'); await page.waitForTimeout(120) }
  await U('after publish'); log('  issues', await iss())
  log('  R040', JSON.stringify((await row(page, 'R040')).model), 'R044 qty', (await row(page, 'R044')).qtyNeeded)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); await U('Ctrl+Z after publish')
  const r40 = await row(page, 'R040'), r44 = await row(page, 'R044'); log('  R040', r40.model, JSON.stringify(r40.working), '| R044', r44.qtyNeeded, JSON.stringify(r44.working))
  log('  status', (await T.status(page)).replace(/\s+/g, ' ').slice(0, 160))
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); await U('Ctrl+Z again')
  const r40b = await row(page, 'R040'), r44b = await row(page, 'R044'); log('  R040', r40b.model, JSON.stringify(r40b.working), '| R044', r44b.qtyNeeded, JSON.stringify(r44b.working))
})
await step('purchasing confirm', async () => {
  await setRole(page, 'purchasing'); await page.keyboard.press('5'); await U('purchasing 5'); log('  5 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(',')))
  await sel(page, 'R040'); log('  hints', await T.hints(page)); await page.keyboard.press('x'); await page.waitForTimeout(80); await U('x'); log('  issues', await iss())
})
await shot(page, 't19_issues')
save(errors); await browser.close()
