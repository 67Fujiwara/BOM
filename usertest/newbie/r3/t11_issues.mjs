// 購買の新人が指摘を連続起票 → 発行 → 設計が直す（n / Enter / Ctrl+.）・回答 → 購買が x で確認
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, setRole, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t11_issues')
const iss = async (ids) => (await proj(page)).issues.filter((i) => !ids || ids.includes(i.rowId)).map((i) => `${i.id}:${i.rowId}:${i.field}:${i.kind}:${i.status}`).join(' ')
await fresh(page, 'purchasing'); await page.keyboard.press('1')
await sel(page, 'R030'); await gotoCol(page, '型式')
// Shift+I → k → 本文 → Ctrl+Enter（次の行へ続ける）×3 → Enter
await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.keyboard.insertText('定格が不明'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80)
log('after Ctrl+Enter 1:', await T.panelText(page), '|', await T.toast(page))
await page.keyboard.insertText('定格が不明2'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(80)
log('after Ctrl+Enter 2:', await T.panelText(page), '|', await T.toast(page))
await page.keyboard.insertText('定格が不明3'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
log('after Enter 3:', await T.panelText(page), '|', await T.toast(page))
log('drafts', await iss(['R030', 'R031', 'R032', 'R033']))
// 新人は J で次の行（大文字）を押して続ける
await page.keyboard.press('Shift+J'); await page.keyboard.press('Shift+I'); await page.keyboard.press('m'); await page.keyboard.insertText('メーカは?'); await page.keyboard.press('Enter')
log('J + Shift+I m:', await T.toast(page), await iss(['R033', 'R034']))
// 本文が空のまま Enter
await page.keyboard.press('Shift+I'); await page.keyboard.press('q'); await page.keyboard.press('Enter'); log('empty body Enter:', await T.toast(page), await T.panel(page)); await page.keyboard.press('Escape')
// Ctrl+Enter で発行
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); log('publish:', await T.panelText(page), '|', await T.toast(page))
if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), '|', await T.toast(page)) }
log('after publish', await iss(['R030', 'R031', 'R032', 'R033', 'R034']))
// 発行後 Ctrl+Z
await page.keyboard.press('Control+z'); await page.waitForTimeout(80); log('Ctrl+Z after publish:', await T.toast(page), await iss(['R030', 'R031', 'R032']))
await page.keyboard.press('Control+y'); await page.waitForTimeout(80); log('Ctrl+Y:', await T.toast(page), await iss(['R030', 'R031', 'R032']))
// 設計: 4 → n → 直す
await setRole(page, 'design'); log('design view', (await ui(page)).view, 'status', await T.status(page))
for (let i = 0; i < 4; i++) { await page.keyboard.press('n'); const u = await ui(page); log(`  n#${i + 1} ->`, u.cursorRow, u.cursorCol, '| status', (await T.status(page)).slice(0, 120)) }
await sel(page, 'R030'); await gotoCol(page, '型式')
await typeReal(page, 'S-T21 AC200V', 40); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
log('  R030 model typed ->', JSON.stringify((await row(page, 'R030')).working), '| toast', await T.toast(page))
// 回答で閉じる: R031 → Space → ↓ → Enter → 2 直さず回答
await sel(page, 'R031'); await page.keyboard.press(' '); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
log('  R031 issue action', await T.panelText(page))
await page.keyboard.press('2'); await page.waitForTimeout(80); log('  2 ->', await T.panelText(page))
await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter(empty) ->', await T.panelText(page), '|', await T.toast(page))
if (await T.panel(page)) { await page.keyboard.insertText('AC200V 版で確定です'); await page.keyboard.press('Enter'); await page.waitForTimeout(80) }
log('  answered:', await T.toast(page), await iss(['R031']))
await page.keyboard.press('Escape')
// Ctrl+. on R032
await sel(page, 'R032'); await gotoCol(page, '型式'); await page.keyboard.press('Control+.'); await page.waitForTimeout(80); log('  Ctrl+. R032', await T.panelText(page)); await page.keyboard.press('Escape')
// 公開
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
for (let i = 0; i < 4 && (await T.panel(page)); i++) { log('  publish panel', (await T.panelText(page)).slice(0, 160)); await page.keyboard.press(i === 0 ? '2' : 'Enter'); await page.waitForTimeout(100) }
log('  publish toast', await T.toast(page), await iss(['R030', 'R031', 'R032', 'R033']))
// 購買: x で確認
await setRole(page, 'purchasing'); log('purch view', (await ui(page)).view, 'rows', await T.rows(page))
await sel(page, 'R030'); log('  hints', await T.hints(page)); await page.keyboard.press('x'); await page.waitForTimeout(80); log('  x R030', await T.toast(page), await iss(['R030']))
await sel(page, 'R031'); log('  hints', await T.hints(page)); await page.keyboard.press('x'); await page.waitForTimeout(80); log('  x R031', await T.toast(page), await iss(['R031']))
await page.keyboard.press('x'); await page.waitForTimeout(80); log('  x again R031', await T.toast(page), await iss(['R031']))
await shot(page, 't11_end')
save(errors)
await browser.close()
