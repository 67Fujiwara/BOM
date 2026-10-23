// U5-01 再検証: 入力中のダイアログで Ctrl+K → 案内どおり Esc
import { launch, fresh, T, makeLog, sel, gotoCol, ui, proj, sleep, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t13b_esc')
const val = async () => page.locator('.overlay textarea, .overlay input[type=text], .overlay input:not([type])').first().inputValue().catch(() => '-')
// 指摘の本文（購買）
await fresh(page, 'purchasing'); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('Home'); await page.keyboard.press('Shift+I'); await sleep(100); await page.keyboard.press('k'); await sleep(80)
await page.keyboard.insertText('型式の末尾（電圧）が抜けています'); await sleep(80)
await page.keyboard.press('Control+k'); await sleep(100); log('issue: Ctrl+K ->', await T.panel(page), '|', await T.toast(page))
await page.keyboard.press('Escape'); await sleep(100); log('issue: Esc#1 ->', await T.panel(page), '|', await T.toast(page), '| text', await val())
await shot(page, 't13b_issue_esc1')
await page.keyboard.press('Escape'); await sleep(100); log('issue: Esc#2 ->', await T.panel(page), '|', await T.toast(page))
// Esc 1 回 → 文字を打つ → Esc（武装が解ける）
await page.keyboard.press('Shift+I'); await sleep(80); await page.keyboard.press('q'); await sleep(80); await page.keyboard.insertText('質問です'); await page.keyboard.press('Escape'); await sleep(80); await page.keyboard.insertText('追記'); await page.keyboard.press('Escape'); await sleep(80)
log('issue2: Esc, type, Esc ->', await T.panel(page), '| text', await val())
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
// 置換の型式（設計）
await fresh(page); await page.keyboard.press('1'); await sel(page, 'R030'); await page.keyboard.press('Home'); await page.keyboard.press('r'); await sleep(100)
await page.getByTestId('prompt-text').fill('S-T21 AC200V'); await page.keyboard.press('Control+k'); await sleep(80); log('replace: Ctrl+K ->', await T.panel(page), '|', await T.toast(page))
await page.keyboard.press('Escape'); await sleep(80); log('replace: Esc#1 ->', await T.panel(page), '|', await T.toast(page), '| value', await val())
await page.keyboard.press('Enter'); await sleep(150); log('replace: Enter ->', await T.panel(page), '|', await T.toast(page))
const p = await proj(page); log('rows', p.rows.length, p.rows.slice(-1).map((r) => r.id + ' ' + r.model))
await page.keyboard.press('Control+z'); await sleep(150); log('Ctrl+Z', await T.toast(page), (await proj(page)).rows.length)
save(errors); await browser.close()
