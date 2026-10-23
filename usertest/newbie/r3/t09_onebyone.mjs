// ガイド「3 1 つずつ入力」で空の表から Excel 風に入れる新人
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t09_onebyone')
const dump = async (tag) => { const p = await proj(page); log(`${tag}: rows=${p.rows.length} ` + p.rows.map((r) => `${r.id}{${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}${r.unit}}`).join(' ')); const u = await ui(page); log(`   ui view=${u.view} cursor=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} toast=${await T.toast(page)}`) }
await fresh(page)
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
await page.getByTestId('wizard-id').fill('NEW-1'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
await dump('created')
// 日本語は IME なので Enter で編集に入ってから（insertText）。英数字は Excel 風にいきなり打つ
const jp = async (t) => { await page.keyboard.press('Enter'); await page.keyboard.insertText(t) }
await jp('リレー'); await page.keyboard.press('Tab')
await typeReal(page, 'MY4N-D2'); await page.keyboard.press('Tab')
await jp('オムロン'); await page.keyboard.press('Tab')
await dump('after maker Tab')
await page.keyboard.press('4'); await page.waitForTimeout(80)
await dump('pressed 4 on 必要数')
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('4'); await page.keyboard.press('Enter')
await dump('Enter 4 Enter (last row)')
// Excel の習慣: 最後の行で Enter → 次の部品名をそのまま打つ
await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await dump('Home →')
await jp('タイマ'); await page.keyboard.press('Enter')
await dump('typed タイマ + Enter as 2nd part (overwrites?)')
await page.keyboard.press('Control+z'); await dump('Ctrl+Z')
await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80); await dump('Shift+Enter')
await page.keyboard.insertText('タイマ'); await page.keyboard.press('Tab'); await typeReal(page, 'H3CR-A8'); await page.keyboard.press('Tab'); await jp('オムロン'); await page.keyboard.press('Enter')
await dump('2nd row typed')
// 編集中の Shift+Enter
await page.keyboard.press('Enter'); await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80); await dump('Shift+Enter while editing'); await page.keyboard.press('Escape')
// 3 行目は英字の部品名（Sensor）・メーカ（Omron）をいきなり打つ
await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80); await page.keyboard.press('Escape')
await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
await typeReal(page, 'Sensor', 80); await page.keyboard.press('Tab'); await typeReal(page, 'E2E-X5ME1', 80); await page.keyboard.press('Tab'); await typeReal(page, 'Omron', 80); await page.keyboard.press('Enter')
await dump('3rd row typed (Sensor / E2E-X5ME1 / Omron)')
// 単位に pcs
await sel(page, 'R002'); await gotoCol(page, '単位'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('pcs'); await page.keyboard.press('Enter')
await dump('unit pcs')
// n で問題を直す
await page.keyboard.press('4'); await page.keyboard.press('n'); await dump('n')
await page.keyboard.press('Control+.'); await page.waitForTimeout(80); log('Ctrl+. panel', await T.panelText(page)); if (await T.panel(page)) await page.keyboard.press('Escape')
// 公開
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); log('publish panel', await T.panelText(page), 'toast', await T.toast(page))
for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), await T.toast(page)) }
await dump('after publish')
await shot(page, 't09_onebyone')
save(errors)
await browser.close()
