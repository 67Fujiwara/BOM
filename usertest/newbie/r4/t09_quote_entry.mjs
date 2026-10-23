// 6・8 で Enter で入ってから Excel 風に 単価 Tab 納期 Tab MOQ Enter と続ける。途中で ↓ / Ctrl+Z / 数字 / クリック
import { launch, fresh, T, makeLog, shot, sel, row, proj, ui, runPalette, setRole, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t09_quote_entry')
const st = (id) => row(page, id).then((r) => r && `${r.id}:${r.status}${r.adoptedSupplierId ? '@' + r.adoptedSupplierId : ''}`)
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}${x.formalPrice != null ? ' F' + x.formalPrice + '/' + x.formalLeadDays : ''}`).join(' ')
const U = async (tag) => { const u = await ui(page); log(`  ${tag}: view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`) }
await fresh(page)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
await setRole(page, 'purchasing')
// 回答期限の誤り
await runPalette(page, '概算見積を依頼'); await page.keyboard.press('ArrowDown')
for (const v of ['2025-01-01', '11/31', 'あした', '未定', '来週']) {
  await page.getByTestId('prompt-text').fill(v); await page.keyboard.press('Enter'); await page.waitForTimeout(120)
  log(`  deadline "${v}" -> panel=${await T.panel(page)} val=${await page.getByTestId('prompt-text').inputValue().catch(() => '-')} sel=${(await T.panelText(page))?.match(/▶ [^·]+/)?.[0]} toast=${await T.toast(page)}`)
  if (!(await T.panel(page))) break
}
log('  R077', await st('R077'), 'deadline', JSON.stringify((await proj(page)).requests?.slice(-1)))
await clearToast(page)
await page.keyboard.press('6'); await page.waitForTimeout(100)
await sel(page, 'R077'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
await U('at')
await page.keyboard.press('Enter'); await page.keyboard.type('1500'); await page.keyboard.press('Tab'); await U('Enter 1500 Tab')
await page.keyboard.type('10'); await page.keyboard.press('Tab'); await U('10 Tab')
await page.keyboard.type('5'); await page.keyboard.press('Enter'); await U('5 Enter')
log('  R077', await quotes('R077'), '| R078', await quotes('R078'))
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await U('ArrowDown x2 while auto-edit')
await page.keyboard.press('Control+z'); await page.waitForTimeout(80); await U('Ctrl+Z while auto-edit'); log('  R077', await quotes('R077'))
await page.keyboard.press('7'); await U('pressed 7 while auto-edit')
await page.keyboard.press('Enter'); await page.waitForTimeout(80); await U('Enter (commit 7?)'); log('  quotes R078', await quotes('R078'), 'R079', await quotes('R079'))
await page.keyboard.press('Escape'); await U('Escape')
await page.keyboard.press('Control+z'); await page.waitForTimeout(80); await U('Ctrl+Z after Esc'); log('  R077', await quotes('R077'), 'R078', await quotes('R078'))
// 自動で始まった入力中に別のセルをクリック
await sel(page, 'R076'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
await page.keyboard.press('Enter'); await page.keyboard.type('999'); await page.keyboard.press('Enter'); await U('R076 999 Enter')
await page.locator('[data-row-id="R078"] td').nth(3).click(); await page.waitForTimeout(100); await U('clicked R078 part name while auto-edit')
await page.keyboard.press('Escape')
// 小数・カンマ・円記号・全角
await sel(page, 'R079'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
for (const v of ['1,234', '¥980', '１２３４', '12.5', '1万', '1.2k']) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await page.waitForTimeout(80); const u = await ui(page); log(`  price "${v}" -> R079 ${await quotes('R079')} mode=${u.mode} toast=${await T.toast(page)}`); if (u.mode === 'edit') await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sel(page, 'R079'); for (let i = 0; i < 20; i++) { const c = await T.cursor(page); if (/単価/.test(c)) break; await page.keyboard.press('ArrowRight') } }
await shot(page, 't09_view6')
// 8: 採用 → 正式依頼 → 正式単価
await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('a'); await sel(page, 'R031'); await page.keyboard.press('a'); await page.waitForTimeout(80)
await setRole(page, 'purchasing'); await runPalette(page, '正式見積を依頼'); await page.keyboard.press('2'); await page.waitForTimeout(150)
for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(300) }
await page.keyboard.press('8'); await page.waitForTimeout(100)
await sel(page, 'R030'); for (let i = 0; i < 25; i++) { const c = await T.cursor(page); if (/正式単価/.test(c)) break; await page.keyboard.press('ArrowRight') }
await U('8 at')
await page.keyboard.press('Enter'); await page.keyboard.type('20000'); await page.keyboard.press('Tab'); await U('Enter 20000 Tab')
await page.keyboard.type('20'); await page.keyboard.press('Enter'); await U('20 Enter')
log('  R030', await st('R030'), await quotes('R030'))
await page.keyboard.type('140'); await page.keyboard.press('Tab'); await page.keyboard.type('15'); await page.keyboard.press('Enter'); await U('140 Tab 15 Enter')
const r031 = (await proj(page)).rows.find((r) => r.id === 'R031'); log('  R031', await st('R031'), await quotes('R031'))
const rowsOrder = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(','))
log('  view8 rows', rowsOrder)
await shot(page, 't09_view8')
save(errors); await browser.close()
