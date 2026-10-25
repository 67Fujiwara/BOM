// ガイド「3 1 つずつ入力」→ 4 要確認 で Home → から英字の部品を打つ（1 キーずつ記録）
import { launch, fresh, T, makeLog, shot, ui, palette, typeReal, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y08_onebyone')
const dump = async (tag) => { const p = await proj(page); const u = await ui(page); log(`  [${tag}] view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} edit=${JSON.stringify(u.editValue)} panel=${u.panel} | rows=${p.rows.map((r) => `${r.id}{${r.name}|${r.model}|${r.maker}|${r.ref}|${r.hidden ? 'H' : ''}}`).join(' ')} | toast=${await T.toast(page)}`) }
await fresh(page)
await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
await page.getByTestId('wizard-id').fill('NEW-1'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(150)
await dump('created')
log('  cols: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
await typeReal(page, 'Relay'); await page.keyboard.press('Tab'); await typeReal(page, 'MY4N'); await page.keyboard.press('Tab'); await typeReal(page, 'Omron'); await page.keyboard.press('Enter'); await sleep(80)
await dump('row1 typed')
await page.keyboard.press('Shift+Enter'); await sleep(80); await dump('Shift+Enter')
await page.keyboard.press('Escape'); await dump('Esc')
await page.keyboard.press('Home'); await dump('Home')
await page.keyboard.press('ArrowRight'); await dump('→')
for (const ch of 'Sensor') { await typeReal(page, ch, 0); await sleep(30); await dump(ch) }
await page.keyboard.press('Tab'); await dump('Tab')
for (const ch of 'E2E-X5ME1') { await typeReal(page, ch, 0); await sleep(30); await dump(ch) }
await shot(page, 'y08_after_model')
save(errors); await browser.close()
