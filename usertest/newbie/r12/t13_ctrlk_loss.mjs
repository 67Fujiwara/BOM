// 入力途中のダイアログで迷って Ctrl+K → Esc → 開き直したら、入れた内容は残っているか
import { launch, fresh, T, makeLog, sel, ui, proj, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t13_ctrlk_loss')
// 指摘の本文
await fresh(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.waitForTimeout(80)
await page.keyboard.insertText('型式の末尾（電圧）が抜けています。AC200V か DC24V か教えてください'); await page.waitForTimeout(80)
log('issue text before', (await T.panelText(page))?.slice(0, 160))
await page.keyboard.press('Control+k'); await page.waitForTimeout(80); log('Ctrl+K ->', await T.panel(page))
await page.keyboard.press('Escape'); await page.waitForTimeout(80); log('Esc ->', await T.panel(page), await T.toast(page))
await page.keyboard.press('Shift+I'); await page.waitForTimeout(80); log('reopen Shift+I ->', (await T.panelText(page))?.slice(0, 200))
await page.keyboard.press('k'); await page.waitForTimeout(80); log('k ->', (await T.panelText(page))?.slice(0, 200), 'textarea', await page.locator('.overlay textarea, .overlay input').first().inputValue().catch(() => '-'))
log('draft issues', (await proj(page)).issues.filter((i) => i.status === 'draft').map((i) => i.rowId + ':' + i.text).join(' | '))
await page.keyboard.press('Escape')
// 案件設定（PM）
await setRole(page, 'pm'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
log('settings', (await T.panelText(page))?.slice(0, 300))
await page.keyboard.press('Enter'); await page.waitForTimeout(80); await page.keyboard.press('Control+a'); await page.keyboard.type('2026-12-25'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
log('edited', (await T.panelText(page))?.slice(0, 300))
await page.keyboard.press('Control+k'); await page.waitForTimeout(80); log('Ctrl+K ->', await T.panel(page), await T.toast(page))
await page.keyboard.press('Escape'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
log('reopen settings', (await T.panelText(page))?.slice(0, 300))
log('project due', (await proj(page)).settings?.due ?? JSON.stringify((await proj(page)).settings).slice(0, 200))
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
// 置き換え品（r）の型式入力
await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('r'); await page.waitForTimeout(80)
await page.getByTestId('prompt-text').fill('S-T21 AC200V'); await page.keyboard.press('Control+k'); await page.keyboard.press('Escape'); await page.keyboard.press('r'); await page.waitForTimeout(80)
log('replace reopen value', await page.getByTestId('prompt-text').inputValue().catch(() => '-'))
save(errors); await browser.close()
