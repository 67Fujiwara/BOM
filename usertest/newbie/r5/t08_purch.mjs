// 購買の新人: 公開を受けて概算依頼（期限の誤り）→ 取り込み（読めない値）→ 6 で単価 Enter/Tab の連続入力 → 8 正式見積
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, runPalette, setRole, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t08_purch')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const st = (id) => row(page, id).then((r) => r && `${r.id}:${r.status}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}${r.working ? '*' + JSON.stringify(r.working) : ''}`)
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}${x.formalPrice != null ? ' F' + x.formalPrice + '/' + x.formalLeadDays : ''}`).join(' ')
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`) }
await fresh(page)
await step('design publish', async () => {
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { log('  publish panel', (await T.panelText(page))?.slice(0, 160)); await page.keyboard.press(i === 0 ? '2' : 'Enter'); await page.waitForTimeout(100) }
  log('  publish toast', await T.toast(page), await st('R076'))
})
await step('request deadline', async () => {
  await setRole(page, 'purchasing')
  await runPalette(page, '概算見積を依頼'); log('  request panel', (await T.panelText(page))?.slice(0, 300))
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(50)
  for (const v of ['来週', '再来週', '2025-01-01', 'あした', '11/31', '未定']) {
    await page.getByTestId('prompt-text').fill(v); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
    log(`  deadline "${v}" -> panel=${await T.panel(page)} val=${await page.getByTestId('prompt-text').inputValue().catch(() => '-')} toast=${await T.toast(page)}`)
    if (!(await T.panel(page))) break
  }
  log('  R076 after', await st('R076'))
})
await step('import', async () => {
  await clearToast(page)
  await runPalette(page, '見積回答を取り込む'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  const p = await proj(page); const m = (id) => p.rows.find((r) => r.id === id).model
  const tsv = [`行ID\t型式\t単価\t納期\tMOQ`, `R076\t${m('R076')}\t1200\t14\t1`, `R077\t${m('R077')}\tabc\t7\t1`, `R078\t${m('R078')}\t¥3,500\t2週間\t`, `R079\t${m('R079')}\t-50\t5\t1`, `R080\tWRONG-MODEL\t900\t3\t1`, `R999\tX\t1\t1\t1`].join('\n')
  await page.locator('.overlay textarea').fill(tsv); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150)
  log('  import toast:', await T.toast(page)); await shot(page, 't08_import')
  for (const id of ['R076', 'R077', 'R078', 'R079']) log('   ', id, await quotes(id))
})
await step('view 6 continuous entry', async () => {
  await page.keyboard.press('6'); await page.waitForTimeout(100)
  log('  thead', (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' ').slice(0, 260))
  await sel(page, 'R077'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
  await U('at')
  // Excel 風: 数字をいきなり → Tab → 数字 → Tab → 数字 → Enter
  await page.keyboard.type('1500'); await U('typed 1500 (no Enter)')
  await page.keyboard.press('Enter'); await U('Enter')
  await page.keyboard.press('Enter'); await U('Enter (start)')
  await page.keyboard.type('1500'); await page.keyboard.press('Tab'); await U('1500 Tab')
  await page.keyboard.type('10'); await page.keyboard.press('Tab'); await U('10 Tab')
  await page.keyboard.type('5'); await page.keyboard.press('Enter'); await U('5 Enter')
  log('  R077', await quotes('R077'), '| R078', await quotes('R078'))
  // 次の行で自動で始まった入力中に ↓ で下へ動きたい
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await U('ArrowDown x2 while auto-edit')
  // Ctrl+Z で今入れた MOQ を戻したい
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80); await U('Ctrl+Z while auto-edit'); log('  R077', await quotes('R077'))
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(80); await U('Esc, Ctrl+Z'); log('  R077', await quotes('R077'))
  // 数字でビューを変えたい
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await U('Enter Enter'); await page.keyboard.press('1'); await U('pressed 1 (wants view 1)')
  await page.keyboard.press('Escape'); await shot(page, 't08_view6')
})
await step('adopt & formal', async () => {
  await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('a'); await page.waitForTimeout(100); log('  a R030', await T.toast(page), await st('R030'))
  await sel(page, 'R031'); await page.keyboard.press('a'); await page.waitForTimeout(100); log('  a R031', await T.toast(page), await st('R031'))
  await setRole(page, 'purchasing')
  await runPalette(page, '正式見積を依頼'); log('  formal confirm', (await T.panelText(page))?.slice(0, 260))
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); log('  Enter (default) ->', await T.panel(page), await T.toast(page), await st('R030'))
  await runPalette(page, '正式見積を依頼'); await page.keyboard.press('2'); await page.waitForTimeout(150); log('  2 ->', (await T.panelText(page))?.slice(0, 200), await T.toast(page))
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); log('  Enter ->', (await T.panelText(page))?.slice(0, 200), await T.toast(page)) }
  log('  ', await st('R030'), await st('R031'))
  await page.keyboard.press('8'); await page.waitForTimeout(100)
  log('  view8 thead', (await page.locator('table.grid thead').innerText()).replace(/\s+/g, ' ').slice(0, 300), 'rows', await T.rows(page))
  await sel(page, 'R030'); for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/正式単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
  await U('cursor at')
  await page.keyboard.type('25000'); await page.keyboard.press('Tab'); await page.keyboard.type('20'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  await U('after 25000 Tab 20 Enter'); log('  R030', await st('R030'), await quotes('R030'))
  await page.keyboard.type('130'); await page.keyboard.press('Tab'); await page.keyboard.type('15'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  await U('after 130 Tab 15 Enter'); log('  R031', await st('R031'), await quotes('R031'))
  await shot(page, 't08_view8')
})
save(errors); await browser.close()
